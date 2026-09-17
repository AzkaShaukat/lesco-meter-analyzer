"""
LESCO Load Profile gap finder.

Reads a raw "Custom Load Profile" export (the messy portal Excel format) and,
for every meter (MSN) in the file, reports every time window where interval
readings are missing: gap start, gap end, duration, and how many readings
were skipped.

Usage:
    python gap_finder.py <load_profile.xlsx> [output.xlsx]

If output.xlsx is omitted, it's written next to the input file as
"<input_name>_gaps.xlsx".
"""

import sys
from pathlib import Path

import pandas as pd

from lesco_common import load_portal_export, autofit_columns, build_meter_info, add_ref_no

# Meter category, from the 3rd-4th digit of the MSN (e.g. 29-99-013904 -> "99")
CATEGORY_INTERVAL_MIN = {
    "97": ("Single Phase", 30),
    "98": ("Three Phase", 30),
    "99": ("LT / HT Industrial", 15),
}

GAP_TOLERANCE = 1.5  # a step is a "gap" once it's more than 1.5x the expected interval


def load_lp_file(path: Path) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    df, from_dt, to_dt = load_portal_export(path)
    time_col = next(c for c in df.columns if c.strip().lower().startswith("date"))

    df = df[df[time_col].notna()].copy()
    df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
    df = df.dropna(subset=[time_col])

    return df[["MSN", time_col]].rename(columns={time_col: "Timestamp"}), from_dt, to_dt


def classify_meter(msn: str, timestamps: pd.Series) -> tuple[str, int]:
    # The MSN-suffix rule (##97/##98/##99) is a hint, not ground truth: testing
    # showed some ##99 meters actually report every 30 min, not 15. So we always
    # check what the data itself shows, and only trust the suffix rule when it
    # agrees with the observed reporting rate.
    code = msn[2:4] if len(msn) >= 4 else ""
    suffix_hint = CATEGORY_INTERVAL_MIN.get(code)

    diffs = timestamps.sort_values().diff().dropna().dt.total_seconds() / 60
    diffs = diffs[(diffs > 0) & (diffs <= 60)]  # exclude actual gaps, keep plausible single-step diffs
    observed_min = None
    if not diffs.empty:
        mode = diffs.mode()
        observed_min = mode.iloc[0] if not mode.empty else diffs.median()

    observed_rounded = None
    if observed_min is not None:
        observed_rounded = 15 if observed_min <= 22.5 else 30

    if suffix_hint is not None:
        category_name, suffix_interval = suffix_hint
        if observed_rounded is not None and observed_rounded != suffix_interval:
            return (f"{category_name} - MSN suggests {suffix_interval}min but data shows "
                     f"{observed_rounded}min, using observed"), observed_rounded
        return category_name, suffix_interval

    if observed_rounded is not None:
        return f"Auto-detected (observed {observed_min:.0f} min)", observed_rounded

    return "Unknown (insufficient data)", 30


def find_gaps_for_meter(msn: str, timestamps: pd.Series) -> tuple[list[dict], dict]:
    # NOTE: we deliberately do NOT compare against the file's declared From/To
    # header dates here. Testing showed the raw Load Profile export actually
    # contains readings through 23:45 of the "To" date (not just up to its
    # midnight), while the separate Missing-Load-Profile summary's "Expected"
    # count for the *same* From/To does not include that extra day. The two
    # report types disagree on what the date range means, so the header dates
    # aren't a trustworthy boundary. Everything below only trusts gaps between
    # readings that actually exist in this file.
    category, interval_min = classify_meter(msn, timestamps)
    ts = timestamps.sort_values().drop_duplicates().reset_index(drop=True)

    gaps = []
    interval = pd.Timedelta(minutes=interval_min)
    threshold = interval * GAP_TOLERANCE

    for i in range(1, len(ts)):
        diff = ts.iloc[i] - ts.iloc[i - 1]
        if diff > threshold:
            missing = int(round(diff / interval)) - 1
            gaps.append({
                "MSN": msn, "Category": category, "Interval (min)": interval_min,
                "Break Start (last good reading)": ts.iloc[i - 1],
                "Break End (next good reading)": ts.iloc[i],
                "Duration (hours)": round(diff.total_seconds() / 3600, 2),
                "Missing Readings": missing,
            })

    total_missing = sum(g["Missing Readings"] for g in gaps)
    expected = len(ts) + total_missing

    summary = {
        "MSN": msn,
        "Category": category,
        "Interval (min)": interval_min,
        "Readings Received": len(ts),
        "Readings Expected (received + detected gaps)": expected,
        "Readings Missed": total_missing,
        "Missing %": round(100 * total_missing / expected, 2) if expected else None,
        "Break Count": len(gaps),
    }
    return gaps, summary


def build_gap_sheets(input_path: Path, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI (main(), below) and gui_app.py."""
    df, from_dt, to_dt = load_lp_file(input_path)
    log(f"Loaded {len(df)} readings for {df['MSN'].nunique()} meter(s).")
    log(f"File header declares From={from_dt} To={to_dt} (informational only).")

    all_gaps = []
    all_summaries = []
    for msn, group in df.groupby("MSN"):
        gaps, summary = find_gaps_for_meter(msn, group["Timestamp"])
        all_gaps.extend(gaps)
        all_summaries.append(summary)

    gaps_df = pd.DataFrame(all_gaps).sort_values(["MSN", "Break Start (last good reading)"]) if all_gaps else pd.DataFrame(
        columns=["MSN", "Category", "Interval (min)", "Break Start (last good reading)",
                 "Break End (next good reading)", "Duration (hours)", "Missing Readings"])
    summary_df = pd.DataFrame(all_summaries).sort_values("MSN")

    meter_info = build_meter_info([input_path])
    gaps_df = add_ref_no(gaps_df, meter_info)
    summary_df = add_ref_no(summary_df, meter_info)

    log(f"Found {len(gaps_df)} gap(s) across {len(summary_df)} meter(s).")
    return {"Meter Info": meter_info, "Load Profile Breaks": gaps_df, "Meter Summary": summary_df}


def main():
    if len(sys.argv) < 2:
        print("Usage: python gap_finder.py <load_profile.xlsx> [output.xlsx]")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.with_name(input_path.stem + "_gaps.xlsx")

    sheets = build_gap_sheets(input_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for name, sheet_df in sheets.items():
            sheet_df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, sheet_df, name)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()

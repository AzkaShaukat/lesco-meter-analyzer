"""
LESCO daily-consumption trend checker.

Standalone - only needs a Daily Reads file. For every (meter, date) in the
file, compares that day's consumption against a trailing baseline from that
same meter's own recent history, flagging:
  - SUSPICIOUS_LOW_CONSUMPTION: consumption dropped hard vs. baseline
    (default: 50%+ below) - worth investigating (bypass/tampering, or a
    real reason - engineers make the final call).
  - NORMAL_CONSUMPTION_TREND: in line with (or above) the recent baseline.
  - INSUFFICIENT_BASELINE_DATA / NEGATIVE_CONSUMPTION_FOR_DAY /
    BASELINE_NOT_POSITIVE_CANT_ASSESS: says "can't judge" rather than
    guessing, for the cases where the numbers don't support a clean verdict.

Deliberately independent of gap detection / event correlation - a day can
have completely normal Load Profile coverage and still show suspiciously
low consumption (e.g. a real bypass reduces consumption without necessarily
breaking communication). Tying this check to gap-affected dates was tried
and confirmed to silently skip perfectly fine-communicating days that still
deserved a look (see lesco_data_findings memory) - don't reintroduce that
coupling.

Uses the Daily Reads file's own "Adv. (kWh)" column as the daily consumption
figure - verified this equals MF x (day's Net Import - previous day's Net
Import), so it's trustworthy as-is.

IMPORTANT date-attribution fix: a Daily Reads row timestamped e.g.
"2026-07-27 00:00:00" is captured AT midnight, so its Adv.(kWh) value is the
delta since the previous day's midnight reading - i.e. it's the consumption
that accumulated DURING 2026-07-26, not 2026-07-27. Verified directly
against real data. load_daily_reads() attributes each row's consumption to
(raw date - 1 day) to correct for this - do not remove that shift without
re-verifying against real data first.

The baseline window (14 days), minimum baseline days required (5), and the
"suspicious" drop threshold (50%) below are starting defaults, not numbers
confirmed by engineers yet - treat BASELINE_WINDOW_DAYS / MIN_BASELINE_DAYS
/ SUSPICIOUS_DROP_PCT as the first thing to tune once real cases are
reviewed.

Usage:
    python daily_trend.py <daily_reads.xlsx> [output.xlsx]
"""

import sys
from pathlib import Path

import pandas as pd

from lesco_common import load_portal_export, autofit_columns, build_meter_info, add_ref_no

BASELINE_WINDOW_DAYS = 14
MIN_BASELINE_DAYS = 5
SUSPICIOUS_DROP_PCT = 50.0


def load_daily_reads(path: Path) -> pd.DataFrame:
    df, _, _ = load_portal_export(path)
    time_col = next(c for c in df.columns if c.strip().lower().startswith("date"))
    adv_col = next(c for c in df.columns if c.strip().lower().startswith("adv"))

    df = df[df[time_col].notna()].copy()
    df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
    df[adv_col] = pd.to_numeric(df[adv_col], errors="coerce")
    df = df.dropna(subset=[time_col])
    # a row timestamped "day D 00:00:00" reports the delta since the previous
    # midnight reading, i.e. consumption that happened DURING day D-1 - see
    # module docstring, verified against real data.
    df["Date"] = df[time_col].dt.normalize() - pd.Timedelta(days=1)
    return df[["MSN", "Date", adv_col]].rename(columns={adv_col: "Daily kWh"}).drop_duplicates(subset=["MSN", "Date"])


def evaluate_date(meter_dr: pd.DataFrame, date) -> dict:
    same_day = meter_dr[meter_dr["Date"] == date]
    if same_day.empty:
        return {"date": date, "consumption": None, "baseline": None, "deviation_pct": None,
                "flag": "NO_DAILY_READ_FOR_DATE"}

    actual = same_day["Daily kWh"].iloc[0]
    window_start = date - pd.Timedelta(days=BASELINE_WINDOW_DAYS)
    baseline_rows = meter_dr[(meter_dr["Date"] >= window_start) & (meter_dr["Date"] < date)]
    if len(baseline_rows) < MIN_BASELINE_DAYS:
        return {"date": date, "consumption": round(actual, 2), "baseline": None, "deviation_pct": None,
                "flag": "INSUFFICIENT_BASELINE_DATA"}

    baseline = baseline_rows["Daily kWh"].mean()
    if baseline <= 0:
        # meter's own recent trend isn't a clean positive-consumption baseline (e.g. net
        # export activity dominating) - a "% below normal" comparison isn't meaningful here.
        return {"date": date, "consumption": round(actual, 2), "baseline": round(baseline, 2),
                "deviation_pct": None, "flag": "BASELINE_NOT_POSITIVE_CANT_ASSESS"}

    if actual < 0:
        # net negative for the whole day is a different situation than "low" - flag it
        # distinctly rather than reporting a >100% "drop", which reads as an underestimate.
        return {"date": date, "consumption": round(actual, 2), "baseline": round(baseline, 2),
                "deviation_pct": None, "flag": "NEGATIVE_CONSUMPTION_FOR_DAY"}

    deviation_pct = round(100 * (baseline - actual) / baseline, 1)
    flag = "SUSPICIOUS_LOW_CONSUMPTION" if deviation_pct >= SUSPICIOUS_DROP_PCT else "NORMAL_CONSUMPTION_TREND"
    return {"date": date, "consumption": round(actual, 2), "baseline": round(baseline, 2),
             "deviation_pct": deviation_pct, "flag": flag}


def build_trend_sheet(dr_df: pd.DataFrame) -> pd.DataFrame:
    """One row per (meter, date) present in the Daily Reads file."""
    rows = []
    for msn, meter_dr in dr_df.groupby("MSN"):
        for date in sorted(meter_dr["Date"].unique()):
            date = pd.Timestamp(date)
            ev = evaluate_date(meter_dr, date)
            rows.append({
                "MSN": msn,
                "Date": ev["date"].strftime("%Y-%m-%d"),
                "Daily Consumption (kWh)": ev["consumption"],
                "Baseline Avg (kWh)": ev["baseline"],
                "Deviation %": ev["deviation_pct"],
                "Trend Flag": ev["flag"],
            })

    return pd.DataFrame(rows)


def build_trend_sheets(dr_path: Path, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI (main(), below) and gui_app.py."""
    dr_df = load_daily_reads(dr_path)
    trend_df = build_trend_sheet(dr_df)

    meter_info = build_meter_info([dr_path])
    trend_df = add_ref_no(trend_df, meter_info)

    if not trend_df.empty:
        log("Trend Flag counts:")
        log(trend_df["Trend Flag"].value_counts().to_string())

    return {"Meter Info": meter_info, "Daily Trend Analysis": trend_df}


def main():
    if len(sys.argv) < 2:
        print("Usage: python daily_trend.py <daily_reads.xlsx> [output.xlsx]")
        sys.exit(1)

    dr_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else dr_path.with_name(dr_path.stem + "_trend.xlsx")

    sheets = build_trend_sheets(dr_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for name, sheet_df in sheets.items():
            sheet_df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, sheet_df, name)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()

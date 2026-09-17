"""
LESCO gap <-> outage-event correlator.

Takes a Load Profile file and its matching Events file, finds the missing-
reading gaps (same logic as gap_finder.py), and checks each gap against the
meter's "Power Fail Start"/"Power Fail End" event pairs to see whether the
gap lines up with a genuine power outage.

Classification per gap:
  - ALIGNS_WITH_POWER_OUTAGE: a logged outage window overlaps the gap
    (within a tolerance = the meter's own reading interval, since gap edges
    and event timestamps won't line up to the second) AND covers at least
    50% of the gap's duration (see Outage Coverage % below - threshold
    confirmed with the user's engineers, not invented here).
  - ALIGNS_WITH_POWER_OUTAGE_LOW_COVERAGE: the gap and outage overlap, but
    the outage covers less than 50% of the gap - still mostly unexplained.
    Found by testing on real data: a 144.5-hour gap "aligned" with an
    outage that lasted only 27 minutes (0.3% coverage) before this split
    existed - that would have read as a clean, confirmed match despite 99.7%
    of the gap being unaccounted for. Worth reviewing like NO_MATCHING_OUTAGE_EVENT,
    just with a partial explanation attached.
  - NO_MATCHING_OUTAGE_EVENT: no outage event covers this gap at all -
    worth a closer look (comm fault, or something else).

(A cross-meter "widespread outage" check - if OTHER meters logged an outage
overlapping a gap that this meter's own log didn't - was tried and reverted:
with a 63-meter fleet, almost any gap coincides with SOME other meter's
outage window somewhere, so it reclassified the large majority of gaps and
gutted the "needs review" list rather than sharpening it. Don't re-add this
without a much stricter condition - e.g. requiring the confirming meters to
share the same feeder/transformer as the gapped meter, not just "any meter
in the whole file" - and re-validating that it doesn't over-match again.)

Other event types (e.g. "Reverse Energy...") are NOT used to decide the
classification - they're just listed per gap as extra context, since what
they mean is for the engineers to judge, not for this script to guess.

Usage:
    python event_correlator.py <load_profile.xlsx> <events.xlsx> [output.xlsx]
"""

import sys
from pathlib import Path

import pandas as pd

from lesco_common import load_portal_export, autofit_columns, build_meter_info, add_ref_no
from gap_finder import load_lp_file, find_gaps_for_meter

OUTAGE_START_EVENTS = {"power fail start"}
OUTAGE_END_EVENTS = {"power fail end"}


def load_events_file(path: Path) -> pd.DataFrame:
    df, _, _ = load_portal_export(path)
    time_col = next(c for c in df.columns if c.strip().lower().startswith("reporting"))
    name_col = next(c for c in df.columns if c.strip().lower() == "event name")

    df = df[df[time_col].notna()].copy()
    df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
    df = df.dropna(subset=[time_col])
    return df[["MSN", time_col, name_col]].rename(columns={time_col: "Time", name_col: "Event Name"})


def build_outage_windows(meter_events: pd.DataFrame) -> list[tuple]:
    """Pairs Power Fail Start -> Power Fail End events chronologically per meter."""
    events = meter_events.sort_values("Time")
    windows = []
    pending_start = None
    for _, ev in events.iterrows():
        name = str(ev["Event Name"]).strip().lower()
        if name in OUTAGE_START_EVENTS:
            if pending_start is not None:
                # two Starts with no End between them - close the first as open-ended
                windows.append((pending_start, None))
            pending_start = ev["Time"]
        elif name in OUTAGE_END_EVENTS:
            windows.append((pending_start, ev["Time"]))  # pending_start may be None
            pending_start = None
    if pending_start is not None:
        windows.append((pending_start, None))
    return windows


def windows_overlap(gap_start, gap_end, tolerance, outage_start, outage_end) -> bool:
    gs = gap_start - tolerance
    ge = gap_end + tolerance
    if outage_start is not None and outage_start > ge:
        return False
    if outage_end is not None and outage_end < gs:
        return False
    return True


def outage_coverage_pct(gap_start, gap_end, outage_start, outage_end) -> float:
    """What fraction of the gap does the matched outage actually cover, 0-100.

    An open-ended outage window (start or end is None, meaning the paired
    Power Fail event wasn't found in the file) is treated as extending to
    the gap's own boundary on that side - the safest assumption given we
    don't know when it really started/ended.
    """
    overlap_start = max(gap_start, outage_start) if outage_start is not None else gap_start
    overlap_end = min(gap_end, outage_end) if outage_end is not None else gap_end
    overlap = (overlap_end - overlap_start).total_seconds()
    gap_seconds = (gap_end - gap_start).total_seconds()
    if gap_seconds <= 0:
        return 0.0
    return round(max(0.0, overlap) / gap_seconds * 100, 1)


def other_events_in_window(meter_events: pd.DataFrame, gap_start, gap_end, tolerance) -> str:
    # same widened window as windows_overlap() uses for outage matching, so an event
    # timestamped just before/after the gap's exact edges still shows up as context
    gs = gap_start - tolerance
    ge = gap_end + tolerance
    mask = (meter_events["Time"] >= gs) & (meter_events["Time"] <= ge)
    names = meter_events.loc[mask, "Event Name"]
    if names.empty:
        return ""
    counts = names.value_counts()
    return "; ".join(f"{name} x{n}" for name, n in counts.items())


def correlate(lp_path: Path, events_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    lp_df, _, _ = load_lp_file(lp_path)
    events_df = load_events_file(events_path)

    all_gaps = []
    for msn, group in lp_df.groupby("MSN"):
        gaps, _ = find_gaps_for_meter(msn, group["Timestamp"])
        all_gaps.extend(gaps)
    gaps_df = pd.DataFrame(all_gaps)
    if gaps_df.empty:
        return gaps_df, pd.DataFrame()

    classifications = []
    matched_starts = []
    matched_ends = []
    coverages = []
    other_events = []

    for msn, meter_events in events_df.groupby("MSN"):
        windows = build_outage_windows(meter_events)
        meter_gaps = gaps_df[gaps_df["MSN"] == msn]
        for idx, gap in meter_gaps.iterrows():
            tolerance = pd.Timedelta(minutes=gap["Interval (min)"])
            gap_start = gap["Break Start (last good reading)"]
            gap_end = gap["Break End (next good reading)"]
            match = None
            for os_, oe_ in windows:
                if windows_overlap(gap_start, gap_end, tolerance, os_, oe_):
                    match = (os_, oe_)
                    break
            if match:
                classifications.append((idx, "ALIGNS_WITH_POWER_OUTAGE"))
                matched_starts.append((idx, match[0]))
                matched_ends.append((idx, match[1]))
                coverages.append((idx, outage_coverage_pct(gap_start, gap_end, match[0], match[1])))
            else:
                classifications.append((idx, "NO_MATCHING_OUTAGE_EVENT"))
                matched_starts.append((idx, None))
                matched_ends.append((idx, None))
                coverages.append((idx, None))
            other_events.append((idx, other_events_in_window(
                meter_events, gap_start, gap_end, tolerance)))

    # meters with gaps but no events file coverage at all
    covered_idx = {i for i, _ in classifications}
    for idx in gaps_df.index:
        if idx not in covered_idx:
            classifications.append((idx, "NO_EVENT_DATA_FOR_METER"))
            matched_starts.append((idx, None))
            matched_ends.append((idx, None))
            coverages.append((idx, None))
            other_events.append((idx, ""))

    cls_map = dict(classifications)
    start_map = dict(matched_starts)
    end_map = dict(matched_ends)
    coverage_map = dict(coverages)
    other_map = dict(other_events)

    gaps_df["Classification"] = gaps_df.index.map(cls_map)
    gaps_df["Matched Outage Start"] = gaps_df.index.map(start_map)
    gaps_df["Matched Outage End"] = gaps_df.index.map(end_map)
    gaps_df["Outage Coverage %"] = gaps_df.index.map(coverage_map)
    gaps_df["Other Events In Window"] = gaps_df.index.map(other_map)
    gaps_df = gaps_df.sort_values(["MSN", "Break Start (last good reading)"]).reset_index(drop=True)

    # A gap that "aligns" with an outage covering only a sliver of it is still
    # mostly unexplained - user confirmed with engineers that 50% coverage is
    # the right cutoff for "genuinely explained" vs "needs a second look".
    # Below that, split it into its own bucket rather than letting it hide
    # inside ALIGNS_WITH_POWER_OUTAGE. Outage Coverage % itself is fully
    # deterministic either way (computed straight from the same outage
    # timestamps already shown in Matched Outage Start/End) - only this
    # cutoff was a judgment call, and it's now a confirmed one, not invented.
    LOW_COVERAGE_THRESHOLD = 50.0
    low_coverage = (gaps_df["Classification"] == "ALIGNS_WITH_POWER_OUTAGE") & \
                   (gaps_df["Outage Coverage %"] < LOW_COVERAGE_THRESHOLD)
    gaps_df.loc[low_coverage, "Classification"] = "ALIGNS_WITH_POWER_OUTAGE_LOW_COVERAGE"

    summary = gaps_df.groupby(["MSN", "Category"]).agg(
        Gap_Count=("Classification", "count"),
        Aligns_With_Outage=("Classification", lambda s: (s == "ALIGNS_WITH_POWER_OUTAGE").sum()),
        Aligns_Low_Coverage=("Classification", lambda s: (s == "ALIGNS_WITH_POWER_OUTAGE_LOW_COVERAGE").sum()),
        Needs_Review=("Classification", lambda s: (s == "NO_MATCHING_OUTAGE_EVENT").sum()),
        No_Event_Data=("Classification", lambda s: (s == "NO_EVENT_DATA_FOR_METER").sum()),
    ).reset_index()

    return gaps_df, summary


def build_correlation_sheets(lp_path: Path, events_path: Path, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI (main(), below) and gui_app.py."""
    gaps_df, summary_df = correlate(lp_path, events_path)

    meter_info = build_meter_info([lp_path, events_path])
    gaps_df = add_ref_no(gaps_df, meter_info)
    summary_df = add_ref_no(summary_df, meter_info)

    if not gaps_df.empty:
        log(gaps_df["Classification"].value_counts().to_string())

    return {"Meter Info": meter_info, "Load Profile Breaks": gaps_df, "Per-Meter Summary": summary_df}


def main():
    if len(sys.argv) < 3:
        print("Usage: python event_correlator.py <load_profile.xlsx> <events.xlsx> [output.xlsx]")
        sys.exit(1)

    lp_path = Path(sys.argv[1])
    events_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3]) if len(sys.argv) > 3 else lp_path.with_name(lp_path.stem + "_gap_events.xlsx")

    sheets = build_correlation_sheets(lp_path, events_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for name, sheet_df in sheets.items():
            sheet_df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, sheet_df, name)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()

"""
LESCO final report - the complete pipeline in one file.

Takes a Load Profile file, its Events file, and its Daily Reads file. Runs
all 4 checks, each implemented in its own standalone script and just wired
together here:
  1. Gap detection (gap_finder.py)
  2. Outage-event correlation (event_correlator.py)
  3. Daily-consumption trend check (daily_trend.py) - run independently over
     EVERY date each meter has in the Daily Reads file, not just dates that
     happened to have a Load Profile gap. See daily_trend.py's docstring for
     why those two are deliberately decoupled.
  4. Peak analysis (peak_load.py) - daily PEAK LOAD (kW, demand) from the
     Load Profile, weekly/monthly PEAK CONSUMPTION (kWh, energy - the
     single highest-consumption day in that period) from the Daily Reads
     file. These are two different physical quantities, not the same thing
     at different granularities - see peak_load.py's docstring.

Output is one Excel file with 10 sheets. The first three answer "what do I do
next"; the rest are the evidence behind them:
  - "Theft Worklist" / "All Meters Screened" / "Signal Weights": the ranked
    inspect/review list from theft_screen.py - which few meters are actually
    worth a human's time, and why. Screening on gaps alone does not narrow
    anything (100% of real meters have gaps), so this ranks meters by rare
    tamper events plus corroborating symptoms. Pass --ir to add the
    energy-balance check.
  - "Meter Info": one row per MSN with its Ref. No. and location hierarchy
    (Disco/Circle/Division/Sub-Division/Feeder) - built once here from all 3
    source files, so a future dashboard/webapp can join on MSN instead of
    reading duplicated location text off every row. Every other sheet below
    gets a compact "Ref. No." column next to MSN (cheap, doubles as a search
    key) but NOT the fuller Division/Sub-Division/Feeder set - that stays
    only here, so nothing is repeated sheet after sheet after sheet.
  - "Load Profile Breaks": same as event_correlator.py's own output
    (one row per gap, entirely independent of the trend check).
  - "Daily Trend Analysis": same as daily_trend.py's own output (one row per
    meter+date present in the Daily Reads file - every day gets evaluated,
    gap or no gap).
  - "Per-Meter Summary": same as before.
  - "Daily Peak Load (LP)" / "Weekly Peak Consumption (DR)" /
    "Monthly Peak Consumption (DR)": same as peak_load.py's own output.

If you only need one of these checks, run that script directly instead:
    python gap_finder.py <load_profile.xlsx>
    python event_correlator.py <load_profile.xlsx> <events.xlsx>
    python daily_trend.py <daily_reads.xlsx>
    python peak_load.py <load_profile.xlsx> <daily_reads.xlsx>

Usage:
    python final_report.py <load_profile.xlsx> <events.xlsx> <daily_reads.xlsx> [output.xlsx]
"""

import sys
from pathlib import Path

import pandas as pd

from lesco_common import autofit_columns, build_meter_info, add_ref_no
from event_correlator import correlate
from daily_trend import load_daily_reads, build_trend_sheet
from peak_load import daily_peak_from_lp, periodic_peak_consumption
from theft_screen import screen_from_parts


def build_final_sheets(lp_path: Path, events_path: Path, dr_path: Path,
                       ir_path: Path = None, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI (main(), below) and gui_app.py.

    ir_path (instantaneous reads) is optional: supplying it adds the
    energy-balance check to the theft screen. Everything else runs without it.
    """
    # Progress is reported step by step. A full month of a large feeder takes
    # minutes, almost all of it inside the first call below (parsing a 20 MB+
    # Load Profile export), so silence here reads as a hang. Every later call
    # that wants the same file gets it from the cache in lesco_common.
    log("Step 1/6  Reading the Load Profile (the slow part) ...")
    gaps_df, summary_df = correlate(lp_path, events_path)
    log(f"          Found {len(gaps_df)} load-profile break(s).")

    log("Step 2/6  Reading the Daily Reads file ...")
    dr_df = load_daily_reads(dr_path)

    log("Step 3/6  Checking daily consumption trends ...")
    trend_df = build_trend_sheet(dr_df)

    log("Step 4/6  Working out peak load and peak consumption ...")
    daily_peak_df = daily_peak_from_lp(lp_path)
    weekly_peak_df = periodic_peak_consumption(dr_df, "W", "weekly")
    monthly_peak_df = periodic_peak_consumption(dr_df, "M", "monthly")

    log("Step 5/6  Collecting meter details ...")
    meter_info = build_meter_info([lp_path, events_path, dr_path])
    log(f"          {len(meter_info)} meter(s) in this batch.")

    log("Step 6/6  Screening meters for theft signals ...")

    # theft screen reuses the trend/peak work above rather than redoing it
    screen = screen_from_parts(events_path, trend_df, daily_peak_df, meter_info,
                               ir_path=ir_path, log=log)

    if not gaps_df.empty:
        log("Classification counts:")
        log(gaps_df["Classification"].value_counts().to_string())
    if not trend_df.empty:
        log("Trend Flag counts (every meter+date in Daily Reads):")
        log(trend_df["Trend Flag"].value_counts().to_string())
    log(f"Daily peak load: {len(daily_peak_df)} rows | Weekly peak consumption: {len(weekly_peak_df)} rows | "
        f"Monthly peak consumption: {len(monthly_peak_df)} rows")

    return {
        "Meter Info": meter_info,
        # worklist first: it is the "what do I do next" sheet, the rest is evidence
        "Theft Worklist": screen["Theft Worklist"],
        "All Meters Screened": screen["All Meters Screened"],
        "Signal Weights": screen["Signal Weights"],
        "Load Profile Breaks": add_ref_no(gaps_df, meter_info),
        "Daily Trend Analysis": add_ref_no(trend_df, meter_info),
        "Per-Meter Summary": add_ref_no(summary_df, meter_info),
        "Daily Peak Load (LP)": add_ref_no(daily_peak_df, meter_info),
        "Weekly Peak Consumption (DR)": add_ref_no(weekly_peak_df, meter_info),
        "Monthly Peak Consumption (DR)": add_ref_no(monthly_peak_df, meter_info),
    }


USAGE = ("Usage: python final_report.py <load_profile.xlsx> <events.xlsx> "
         "<daily_reads.xlsx> [--ir <instant_reads.xlsx>] [output.xlsx]")


def main():
    args = sys.argv[1:]
    # --ir is an explicit flag so an existing output file can never be mistaken
    # for an input (see theft_screen.py for the bug that motivated this).
    ir_path = None
    if "--ir" in args:
        i = args.index("--ir")
        if i + 1 >= len(args):
            print(USAGE)
            sys.exit(1)
        ir_path = Path(args[i + 1])
        del args[i:i + 2]

    if len(args) < 3:
        print(USAGE)
        sys.exit(1)

    lp_path = Path(args[0])
    events_path = Path(args[1])
    dr_path = Path(args[2])
    output_path = Path(args[3]) if len(args) > 3 else lp_path.with_name(lp_path.stem + "_final_report.xlsx")

    sheets = build_final_sheets(lp_path, events_path, dr_path, ir_path=ir_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, df, name)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()

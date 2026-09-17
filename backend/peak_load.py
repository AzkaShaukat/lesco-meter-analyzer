"""
LESCO peak load / peak consumption analyzer.

Two different metrics, deliberately not conflated (confirmed with the
user's supervisor which source answers which):

1. DAILY PEAK LOAD, from the Load Profile file: peak load is measured in
   kW (demand - the rate of power draw at an instant), not kWh. For each
   meter, for each calendar day present in the file, this is the highest
   "Power (Import) (kW)" reading that day, plus the time it happened. A
   4-day Load Profile file produces 4 separate daily peaks per meter, not
   one number.

   IMPORTANT MF-scaling fix: found that whether "Power (Import) (kW)" /
   "Energy (Import) (kWh)" already have the meter's MF (multiplication
   factor) applied is INCONSISTENT between different Load Profile exports -
   confirmed on two real files: in Ferozwala/custom_lp.xlsx a meter's own
   Adv(Units) was exactly 40x (= its MF) its raw Energy-column delta (not
   yet scaled), while in Sample data/custom_lp.xlsx a meter's Adv(Units)
   matched its raw Energy-column delta exactly (ratio 1.0, already scaled).
   Blindly trusting the raw Power(kW) column would have under-reported peak
   load by the MF factor for files like Ferozwala's. detect_mf_scale()
   below auto-detects, per meter, which case applies (by comparing
   Adv(Units) against the raw Energy column's own delta) and scales
   Power(kW) accordingly - don't remove this and trust the raw column
   directly again without re-verifying against real data first.

2. WEEKLY / MONTHLY PEAK CONSUMPTION, from the Daily Reads file: Load
   Profile exports are usually only a few days, too short for a
   weekly/monthly view, but Daily Reads commonly covers weeks. Daily Reads
   only has one row per day though, so there's no sub-day demand (kW) data
   to find a peak *within* - the day's own "Adv. (kWh)" figure already *is*
   that day's whole total. So the weekly/monthly view here is "peak
   CONSUMPTION" (kWh, energy), not "peak LOAD" (kW, demand): the single
   highest-consumption day within that week/month, and which date it was.

   (An earlier version of this used the Daily Reads file's "Accum MDI"
   column to compute a weekly/monthly kW figure, but testing found it sat
   noticeably lower than actual peaks visible in the same weeks' Load
   Profile for a real meter - likely because MDI is a smoothed/
   block-average billing-demand figure, a different concept from a raw
   peak. Replaced with this kWh-based approach at the user's request,
   which also sidesteps that unresolved ambiguity - Adv.(kWh) is already
   verified trustworthy, see lesco_data_findings memory.)

Reuses daily_trend.py's load_daily_reads() for the Daily Reads side, so the
"Adv.(kWh)" date-attribution fix (a row timestamped "day D" reflects
consumption during day D-1) is applied consistently - see that module's
docstring for the verification.

Usage:
    python peak_load.py <load_profile.xlsx> <daily_reads.xlsx> [output.xlsx]
"""

import sys
from pathlib import Path

import pandas as pd

from lesco_common import load_portal_export, autofit_columns, build_meter_info, add_ref_no
from daily_trend import load_daily_reads


def detect_mf_scale(df: pd.DataFrame, time_col: str, energy_col: str) -> dict:
    """Per meter: does Power/Energy already have MF applied, or not?

    Compares Adv(Units) (already verified reliable - see gap_finder/
    lesco_data_findings) against the raw Energy column's own interval delta.
    If they match (ratio ~1), the raw columns are already MF-scaled - use
    scale 1.0. If Adv(Units) is ~MF times the raw delta, the raw columns are
    NOT yet scaled - use that meter's own MF as the scale factor. Falls back
    to 1.0 (no scaling) if there isn't enough clean data to tell.
    """
    scales = {}
    for msn, group in df.groupby("MSN"):
        g = group.sort_values(time_col)
        energy_diff = g[energy_col].diff()
        adv = g["Adv(Units)"]
        valid = (energy_diff > 0) & adv.notna() & (adv > 0)
        mf = g["MF"].iloc[0] if "MF" in g.columns and pd.notna(g["MF"].iloc[0]) else 1
        if valid.sum() < 3 or not mf or mf <= 1:
            scales[msn] = 1.0
            continue
        ratio = (adv[valid] / energy_diff[valid]).median()
        scales[msn] = mf if abs(ratio - mf) < abs(ratio - 1) else 1.0
    return scales


def daily_peak_from_lp(lp_path: Path) -> pd.DataFrame:
    df, _, _ = load_portal_export(lp_path)
    time_col = next(c for c in df.columns if c.strip().lower().startswith("date"))
    power_col = next(c for c in df.columns if c.strip().lower() == "power (import) (kw)")
    energy_col = next(c for c in df.columns if c.strip().lower() == "energy (import) (kwh)")

    df = df[df[time_col].notna()].copy()
    df[time_col] = pd.to_datetime(df[time_col], errors="coerce")
    for c in [power_col, energy_col, "Adv(Units)", "MF"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[time_col, power_col])
    df["Date"] = df[time_col].dt.normalize()

    mf_scale = detect_mf_scale(df, time_col, energy_col)
    df["Power_scaled"] = df.apply(lambda r: r[power_col] * mf_scale.get(r["MSN"], 1.0), axis=1)

    rows = []
    for (msn, date), group in df.groupby(["MSN", "Date"]):
        peak_row = group.loc[group["Power_scaled"].idxmax()]
        rows.append({
            "MSN": msn,
            "Date": date.strftime("%Y-%m-%d"),
            "Peak Load (kW)": round(peak_row["Power_scaled"], 3),
            "Time of Peak": peak_row[time_col].strftime("%H:%M"),
            "MF Scale Applied": mf_scale.get(msn, 1.0),
        })

    return pd.DataFrame(rows).sort_values(["MSN", "Date"]).reset_index(drop=True)


def periodic_peak_consumption(dr_df: pd.DataFrame, period: str, label: str) -> pd.DataFrame:
    """Highest single-day consumption (kWh) within each week/month, per meter."""
    df = dr_df.copy()
    df["Period"] = df["Date"].dt.to_period(period)

    rows = []
    for (msn, period_val), group in df.groupby(["MSN", "Period"]):
        peak_row = group.loc[group["Daily kWh"].idxmax()]
        rows.append({
            "MSN": msn,
            "Period": str(period_val),
            f"Peak Consumption (kWh, {label})": round(peak_row["Daily kWh"], 2),
            "Peak Date": peak_row["Date"].strftime("%Y-%m-%d"),
            "Days_In_Data": len(group),
        })

    return pd.DataFrame(rows).sort_values(["MSN", "Period"]).reset_index(drop=True)


def build_peak_sheets(lp_path: Path, dr_path: Path, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI (main(), below) and gui_app.py."""
    daily_df = daily_peak_from_lp(lp_path)
    dr_df = load_daily_reads(dr_path)
    weekly_df = periodic_peak_consumption(dr_df, "W", "weekly")
    monthly_df = periodic_peak_consumption(dr_df, "M", "monthly")

    meter_info = build_meter_info([lp_path, dr_path])
    daily_df = add_ref_no(daily_df, meter_info)
    weekly_df = add_ref_no(weekly_df, meter_info)
    monthly_df = add_ref_no(monthly_df, meter_info)

    log(f"Daily peak load: {len(daily_df)} (meter, day) rows from Load Profile")
    log(f"Weekly peak consumption: {len(weekly_df)} (meter, week) rows from Daily Reads")
    log(f"Monthly peak consumption: {len(monthly_df)} (meter, month) rows from Daily Reads")

    return {
        "Meter Info": meter_info,
        "Daily Peak Load (LP)": daily_df,
        "Weekly Peak Consumption (DR)": weekly_df,
        "Monthly Peak Consumption (DR)": monthly_df,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python peak_load.py <load_profile.xlsx> <daily_reads.xlsx> [output.xlsx]")
        sys.exit(1)

    lp_path = Path(sys.argv[1])
    dr_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3]) if len(sys.argv) > 3 else lp_path.with_name(lp_path.stem + "_peak_load.xlsx")

    sheets = build_peak_sheets(lp_path, dr_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for name, sheet_df in sheets.items():
            sheet_df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, sheet_df, name)

    print(f"Report written to: {output_path}")


if __name__ == "__main__":
    main()

"""
LESCO theft screening - turns the analysis into a ranked "who to inspect first" worklist.

WHY THIS EXISTS
The other scripts answer "what happened to this meter?". This one answers the
question the supervisor actually asked: "which few meters should a human go
and look at?". Screening on gaps alone is useless - measured on real fleets,
100% of meters have gaps and ~97% have unexplained ones. What discriminates is
(a) rare tamper events the meter itself logs, and (b) several independent
symptoms landing on the SAME meter.

SIGNALS (chosen from measured rarity on Johar Town / Test 2 / Industrial data)

  TIER 1 - rare, specific, physical evidence:
    CT Bypass                     ~1.0% of meters   <- sharpest signal found
    IP Port Programmed            ~0.7%             configuration change
    Time Synchronization          ~1.5%             clock tampering
    Over Voltage (per-phase)      ~0.7%
    Phase Failure L1/L2/L3        5-10%             = "Current Break Phase C"
    Reverse Energy L1/L2/L3       9-14%             per-phase only
    Energy balance failure        (needs IR file)   billed kWh vs V x I x PF

  TIER 2 - supporting, only meaningful in combination:
    Suspicious low-consumption days >= 7
    Near-zero consumption days >= 5
    Night-time peaks (23:00-05:00) > 50% of days

DELIBERATELY EXCLUDED (measured as non-discriminating - do not re-add):
    "has gaps" 100% | "has unexplained gaps" 97-100% | low-coverage match 95%
    MDI Reset 96.3% (routine demand reset) | generic "Reverse Energy" without a
    phase suffix (swings 12-60% between areas, so it is noise not signal)

FLEET-RELATIVE WEIGHTING
Signal weights are NOT hard-coded. Each signal is weighted by how rare it is in
the fleet being analysed (an IDF-style log(N/n) weight), because prevalence
varies hugely by area - Reverse Energy is 12% of meters in Johar Town but 38%
in the Root LT set. A signal that everybody trips is worth ~nothing; a signal
one meter trips is worth a lot. This makes the score self-calibrating.

IMPORTANT - what this does and does not prove:
A high score means "most worth a human's time", NOT "this person is a thief".
The same signatures are produced by faulty CTs, misprogrammed meters and wiring
errors. Report it as a review queue, never as an accusation.

Usage:
    python theft_screen.py <load_profile.xlsx> <events.xlsx> <daily_reads.xlsx> [--ir <instant_reads.xlsx>] [output.xlsx]

The --ir file is optional; without it every check still runs except the
energy-balance one (which needs current/voltage readings).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

from lesco_common import (
    load_portal_export,
    autofit_columns,
    build_meter_info,
    add_ref_no,
)
from daily_trend import load_daily_reads, build_trend_sheet
from peak_load import daily_peak_from_lp

# ---------------------------------------------------------------- thresholds
SUSPICIOUS_DAYS_MIN = 7      # tier 2: flagged low-consumption days
NEAR_ZERO_KWH = 0.5          # a day consuming this or less counts as "near zero"
NEAR_ZERO_DAYS_MIN = 5
NIGHT_START, NIGHT_END = 23, 5   # 23:00-05:00 counts as night
NIGHT_SHARE_MIN = 0.5        # >50% of a meter's daily peaks falling at night
ENERGY_BALANCE_MIN_PCT = 90.0    # billed vs physics below this = under-registering
ENERGY_BALANCE_MIN_DAYS = 5      # need this many comparable days to judge

# Tier-1 event signals: label -> how to match the Event Name.
# Per-phase variants only where the generic name proved non-discriminating.
TIER1_EVENTS = {
    "CT Bypass":            lambda s: "ct bypass" in s,
    "IP Port Programmed":   lambda s: "ip port programmed" in s,
    "Time Synchronization": lambda s: "time synchronization" in s,
    "Over Voltage":         lambda s: s.startswith("over voltage l"),
    "Phase Failure":        lambda s: s.startswith("phase failure l"),
    "Reverse Energy":       lambda s: s.startswith("reverse energy l"),
}

# Within tier 1 the measured rarity splits into two grades, and they must not be
# treated alike: CT Bypass hits ~1% of meters, per-phase Reverse Energy ~10%.
# 1A = rare + hard to explain innocently -> on its own it justifies an inspection.
# 1B = real tamper-adjacent evidence but common enough to need corroboration.
TIER1A = ["CT Bypass", "IP Port Programmed", "Time Synchronization",
          "Over Voltage", "Under-Registering"]
TIER1B = ["Phase Failure", "Reverse Energy"]

# Physical evidence must outrank statistical inference, otherwise three stacked
# tier-2 symptoms outscore a genuine CT-bypass alarm (observed on real data).
TIER_MULTIPLIER = {"1A": 3.0, "1B": 1.5, "2": 1.0}


def _events_by_meter(events_path: Path) -> pd.DataFrame:
    """One row per meter with a count of each tier-1 event type."""
    ev, _, _ = load_portal_export(events_path)
    name_col = next(c for c in ev.columns if c.strip().lower() == "event name")
    ev["MSN"] = ev["MSN"].astype(str)
    lowered = ev[name_col].astype(str).str.strip().str.lower()

    out = pd.DataFrame({"MSN": sorted(ev["MSN"].unique())}).set_index("MSN")
    for label, matches in TIER1_EVENTS.items():
        hit = ev.loc[lowered.map(matches), "MSN"]
        out[label] = hit.value_counts().reindex(out.index).fillna(0).astype(int)
    return out.reset_index()


def _energy_balance(ir_path: Path, trend_df: pd.DataFrame) -> pd.DataFrame:
    """Billed kWh vs the power the meter's own current/voltage/PF imply.

    Compares Daily Reads consumption against (V1*I1 + V2*I2 + V3*I3) * PF
    integrated over the day and scaled by MF. Must use Daily Reads - NOT the
    instantaneous 'Load (kW)' column, which on some meters does not represent
    total 3-phase power and produces false 'under-billing' results.
    """
    df, _, _ = load_portal_export(ir_path)
    cur = [c for c in df.columns if c.strip().lower().startswith("current (amp)")][:3]
    vol = [c for c in df.columns if c.strip().lower().startswith("voltage (volt)")][:3]
    if len(cur) < 3 or len(vol) < 3:
        return pd.DataFrame(columns=["MSN", "Billed vs Physics %", "Energy Balance Days"])

    time_col = next(c for c in df.columns if c.strip().lower().startswith("date"))
    for c in cur + vol + ["Power Factor", "MF"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["MSN"] = df["MSN"].astype(str)
    df = df.dropna(subset=cur + vol + ["Power Factor"])
    df["Date"] = pd.to_datetime(df[time_col], errors="coerce").dt.normalize()

    df["phys_kW"] = (
        df[vol[0]] * df[cur[0]] + df[vol[1]] * df[cur[1]] + df[vol[2]] * df[cur[2]]
    ) * df["Power Factor"] / 1000.0

    daily = df.groupby(["MSN", "Date"]).agg(
        phys=("phys_kW", "mean"), reads=("phys_kW", "size"), mf=("MF", "first")
    ).reset_index()
    daily = daily[daily["reads"] >= 20]                     # enough samples to integrate
    daily["expected_kWh"] = daily["phys"] * 24 * daily["mf"]

    t = trend_df.copy()
    t["MSN"] = t["MSN"].astype(str)
    t["Date"] = pd.to_datetime(t["Date"])
    merged = daily.merge(
        t[["MSN", "Date", "Daily Consumption (kWh)"]], on=["MSN", "Date"], how="inner"
    )
    merged = merged[merged["Daily Consumption (kWh)"] > 1]

    g = merged.groupby("MSN").agg(
        billed=("Daily Consumption (kWh)", "sum"),
        expected=("expected_kWh", "sum"),
        days=("Date", "size"),
    )
    g = g[(g["days"] >= ENERGY_BALANCE_MIN_DAYS) & (g["expected"] > 0)]
    g["Billed vs Physics %"] = (100 * g["billed"] / g["expected"]).round(1)
    return g.reset_index()[["MSN", "Billed vs Physics %", "days"]].rename(
        columns={"days": "Energy Balance Days"}
    )


def _tier2_signals(trend_df: pd.DataFrame, peak_df: pd.DataFrame) -> pd.DataFrame:
    """Supporting signals: suspicious days, near-zero days, night-time peaks."""
    t = trend_df.copy()
    t["MSN"] = t["MSN"].astype(str)
    susp = t[t["Trend Flag"] == "SUSPICIOUS_LOW_CONSUMPTION"].groupby("MSN").size()
    near0 = t[t["Daily Consumption (kWh)"].le(NEAR_ZERO_KWH)].groupby("MSN").size()

    p = peak_df.copy()
    p["MSN"] = p["MSN"].astype(str)
    hour = pd.to_datetime(p["Time of Peak"], format="%H:%M", errors="coerce").dt.hour
    p["is_night"] = (hour >= NIGHT_START) | (hour < NIGHT_END)
    night_share = p.groupby("MSN")["is_night"].mean()

    idx = sorted(set(t["MSN"]) | set(p["MSN"]))
    return pd.DataFrame({
        "MSN": idx,
        "Suspicious Days": susp.reindex(idx).fillna(0).astype(int).values,
        "Near-Zero Days": near0.reindex(idx).fillna(0).astype(int).values,
        "Night Peak Share": night_share.reindex(idx).round(2).values,
    })


def _rarity_weights(flags: pd.DataFrame) -> dict:
    """IDF-style weight per signal: rarer in THIS fleet -> worth more.

    weight = ln((N + 1) / (n + 0.5)) where n = meters tripping the signal.
    A signal most meters trip scores near 0; a signal one meter trips scores
    high - which is why thresholds don't need hard-coding per area.

    The +1/+0.5 smoothing matters: plain ln(N/n) collapses to exactly 0 when
    every meter trips a signal, which zeroes the whole score on single-meter
    or very small downloads (seen on a 1-meter folder).
    """
    n_meters = len(flags)
    weights = {}
    for col in flags.columns:
        n = int(flags[col].sum())
        weights[col] = float(np.log((n_meters + 1) / (n + 0.5))) if n > 0 else 0.0
    return weights


def build_screen_sheets(lp_path: Path, events_path: Path, dr_path: Path,
                        ir_path: Path = None, log=print) -> dict[str, pd.DataFrame]:
    """Returns {sheet_name: DataFrame} - shared by the CLI and any caller."""
    log("Reading daily reads / load profile / events ...")
    dr_df = load_daily_reads(dr_path)
    trend_df = build_trend_sheet(dr_df)
    peak_df = daily_peak_from_lp(lp_path)
    meter_info = build_meter_info([lp_path, events_path, dr_path])
    return screen_from_parts(events_path, trend_df, peak_df, meter_info,
                             ir_path=ir_path, log=log)


def screen_from_parts(events_path: Path, trend_df: pd.DataFrame, peak_df: pd.DataFrame,
                      meter_info: pd.DataFrame, ir_path: Path = None,
                      log=print) -> dict[str, pd.DataFrame]:
    """Same screen, but reusing trend/peak/meter-info that a caller already built.

    final_report.py already computes all three, and the load-profile peak pass is
    the expensive part (~1 min on a full month), so it calls this instead of
    build_screen_sheets to avoid doing that work twice.
    """
    ev_df = _events_by_meter(events_path)
    t2 = _tier2_signals(trend_df, peak_df)

    meter_info = meter_info.copy()
    meter_info["MSN"] = meter_info["MSN"].astype(str)

    d = meter_info[["MSN"]].copy()
    d = d.merge(ev_df, on="MSN", how="left").merge(t2, on="MSN", how="left")
    for label in TIER1_EVENTS:
        d[label] = d[label].fillna(0).astype(int)
    d[["Suspicious Days", "Near-Zero Days"]] = d[["Suspicious Days", "Near-Zero Days"]].fillna(0).astype(int)

    # peak load / MF give the reviewer a sense of value at risk (shown, not scored)
    pk = peak_df.copy()
    pk["MSN"] = pk["MSN"].astype(str)
    d = d.merge(
        pk.groupby("MSN").agg(**{"Peak Load (kW)": ("Peak Load (kW)", "max"),
                                 "MF": ("MF Scale Applied", "first")}).reset_index(),
        on="MSN", how="left")

    if ir_path is not None:
        log("Running energy-balance check against instantaneous reads ...")
        eb = _energy_balance(ir_path, trend_df)
        d = d.merge(eb, on="MSN", how="left")
    else:
        d["Billed vs Physics %"] = np.nan
        d["Energy Balance Days"] = np.nan

    # ---- boolean flags (what actually gets scored) ----
    flags = pd.DataFrame(index=d.index)
    for label in TIER1_EVENTS:
        flags[label] = d[label] > 0
    flags["Under-Registering"] = d["Billed vs Physics %"].lt(ENERGY_BALANCE_MIN_PCT).fillna(False)
    flags["Suspicious Days >= %d" % SUSPICIOUS_DAYS_MIN] = d["Suspicious Days"] >= SUSPICIOUS_DAYS_MIN
    flags["Near-Zero Days >= %d" % NEAR_ZERO_DAYS_MIN] = d["Near-Zero Days"] >= NEAR_ZERO_DAYS_MIN
    flags["Mostly Night Peaks"] = d["Night Peak Share"].gt(NIGHT_SHARE_MIN).fillna(False)

    tier1a = [c for c in flags.columns if c in TIER1A]
    tier1b = [c for c in flags.columns if c in TIER1B]
    tier2_cols = [c for c in flags.columns if c not in tier1a + tier1b]

    def tier_of(col):
        return "1A" if col in tier1a else ("1B" if col in tier1b else "2")

    # rarity (fleet-relative) x tier importance (physical evidence outranks stats)
    weights = {c: w * TIER_MULTIPLIER[tier_of(c)]
               for c, w in _rarity_weights(flags).items()}

    raw = flags.mul(pd.Series(weights)).sum(axis=1)
    top = raw.max()
    d["Score"] = (100 * raw / top).round(0).astype(int) if top > 0 else 0
    d["Tier 1A Signals"] = flags[tier1a].sum(axis=1)
    d["Tier 1B Signals"] = flags[tier1b].sum(axis=1)
    d["Tier 2 Signals"] = flags[tier2_cols].sum(axis=1)

    def why(i):
        bits = []
        for label in TIER1_EVENTS:
            if flags.at[i, label]:
                bits.append(f"{label} x{d.at[i,label]}")
        if flags.at[i, "Under-Registering"]:
            bits.append(f"bills only {d.at[i,'Billed vs Physics %']:.0f}% of physics")
        if flags.at[i, "Suspicious Days >= %d" % SUSPICIOUS_DAYS_MIN]:
            bits.append(f"{d.at[i,'Suspicious Days']} suspicious days")
        if flags.at[i, "Near-Zero Days >= %d" % NEAR_ZERO_DAYS_MIN]:
            bits.append(f"{d.at[i,'Near-Zero Days']} near-zero days")
        if flags.at[i, "Mostly Night Peaks"]:
            bits.append(f"{100*d.at[i,'Night Peak Share']:.0f}% night peaks")
        return "; ".join(bits)

    d["Why Flagged"] = [why(i) for i in d.index]

    # INSPECT needs rare physical evidence (1A), or a 1B event corroborated by
    # TWO independent symptoms. One symptom is not enough: in one real fleet
    # Phase Failure alone hit 37.8% of meters, so "1B + 1 symptom" promoted a
    # fifth of the fleet and defeated the point of screening.
    # REVIEW is the softer queue: a 1B event alone, or all three tier-2 symptoms.
    d["Priority"] = np.select(
        [
            d["Tier 1A Signals"] > 0,
            (d["Tier 1B Signals"] > 0) & (d["Tier 2 Signals"] >= 2),
            (d["Tier 1B Signals"] > 0) | (d["Tier 2 Signals"] >= 3),
        ],
        ["INSPECT", "INSPECT", "REVIEW"],
        default="no action",
    )

    cols = (["MSN", "Score", "Priority", "Why Flagged", "Peak Load (kW)", "MF",
             "Tier 1A Signals", "Tier 1B Signals", "Tier 2 Signals"] + list(TIER1_EVENTS) +
            ["Billed vs Physics %", "Energy Balance Days",
             "Suspicious Days", "Near-Zero Days", "Night Peak Share"])
    screen = d[cols].sort_values(["Score", "Tier 1A Signals"], ascending=False).reset_index(drop=True)
    screen = add_ref_no(screen, meter_info)

    worklist = screen[screen["Priority"] != "no action"].reset_index(drop=True)

    weight_tbl = pd.DataFrame({
        "Signal": list(weights),
        "Tier": [tier_of(c) for c in weights],
        "Meters Tripping": [int(flags[c].sum()) for c in weights],
        "% of Fleet": [round(100 * flags[c].mean(), 1) for c in weights],
        "Weight": [round(weights[c], 2) for c in weights],
    }).sort_values("Weight", ascending=False).reset_index(drop=True)

    log(f"Screened {len(screen)} meters -> {(screen['Priority']=='INSPECT').sum()} INSPECT, "
        f"{(screen['Priority']=='REVIEW').sum()} REVIEW")
    return {
        "Theft Worklist": worklist,
        "All Meters Screened": screen,
        "Signal Weights": weight_tbl,
        "Meter Info": meter_info,
    }


USAGE = ("Usage: python theft_screen.py <load_profile.xlsx> <events.xlsx> "
         "<daily_reads.xlsx> [--ir <instant_reads.xlsx>] [output.xlsx]")


def main():
    args = sys.argv[1:]
    if len(args) < 3:
        print(USAGE)
        sys.exit(1)

    # --ir must be an explicit flag: guessing "an existing file is the IR file"
    # silently swallowed the OUTPUT path whenever a previous run had created it.
    ir = None
    if "--ir" in args:
        i = args.index("--ir")
        if i + 1 >= len(args):
            print(USAGE)
            sys.exit(1)
        ir = Path(args[i + 1])
        if not ir.exists():
            print(f"Instantaneous-reads file not found: {ir}")
            sys.exit(1)
        del args[i:i + 2]

    if len(args) < 3:
        print(USAGE)
        sys.exit(1)

    lp, events, dr = Path(args[0]), Path(args[1]), Path(args[2])
    for p in (lp, events, dr):
        if not p.exists():
            print(f"Input file not found: {p}")
            sys.exit(1)
    out = Path(args[3]) if len(args) > 3 else lp.with_name(lp.stem + "_theft_screen.xlsx")

    sheets = build_screen_sheets(lp, events, dr, ir)

    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)
            autofit_columns(writer, df, name)

    print(f"\nWorklist written to: {out}")
    wl = sheets["Theft Worklist"]
    if len(wl):
        print(wl[["MSN", "Score", "Priority", "Why Flagged"]].head(15).to_string(index=False))


if __name__ == "__main__":
    main()

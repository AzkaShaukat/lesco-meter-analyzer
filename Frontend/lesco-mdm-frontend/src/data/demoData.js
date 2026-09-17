// ============================================================
// LESCO METER DATA ANALYZER - DEMO DATASET
// ============================================================
// Used when deployed to Vercel or when the Python backend is offline.
// Contains realistic data structures matching api.py / jobs.py output.
// ============================================================

export const DEMO_METERS = [
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    Location: "Badami Bagh / Wanspura",
    Feeder: "Wanspura Feeder",
    Subdivision: "North Division",
    Tariff: "A1-Commercial",
    SanctionedLoad: "45 kW",
    ConnectionDate: "2021-03-15",
  },
  {
    MSN: "2999814820",
    "Ref. No.": "REF-8842-C",
    Location: "Lahore East",
    Feeder: "Lahore East Feeder",
    Subdivision: "East Division",
    Tariff: "B2-Industrial",
    SanctionedLoad: "120 kW",
    ConnectionDate: "2019-11-04",
  },
  {
    MSN: "2999813501",
    "Ref. No.": "REF-3501-A",
    Location: "Gulberg III",
    Feeder: "Gulberg Feeder",
    Subdivision: "Central Division",
    Tariff: "A2-Commercial",
    SanctionedLoad: "75 kW",
    ConnectionDate: "2020-07-22",
  },
  {
    MSN: "2999812211",
    "Ref. No.": "REF-2218-B",
    Location: "Model Town",
    Feeder: "Model Town Feeder",
    Subdivision: "South Division",
    Tariff: "A1-Residential",
    SanctionedLoad: "25 kW",
    ConnectionDate: "2022-01-10",
  },
  {
    MSN: "2999815228",
    "Ref. No.": "REF-5528-D",
    Location: "Shahdara",
    Feeder: "Shahdara Feeder",
    Subdivision: "North Division",
    Tariff: "B1-Industrial",
    SanctionedLoad: "90 kW",
    ConnectionDate: "2018-05-19",
  },
  {
    MSN: "2999811198",
    "Ref. No.": "REF-1198-A",
    Location: "Mughalpura",
    Feeder: "Mughalpura Feeder",
    Subdivision: "East Division",
    Tariff: "A1-Commercial",
    SanctionedLoad: "50 kW",
    ConnectionDate: "2021-08-14",
  },
  {
    MSN: "2999817742",
    "Ref. No.": "REF-7742-E",
    Location: "DHA Phase 5",
    Feeder: "Defence Feeder",
    Subdivision: "South Division",
    Tariff: "A2-Commercial",
    SanctionedLoad: "110 kW",
    ConnectionDate: "2023-04-01",
  },
  {
    MSN: "2999816630",
    "Ref. No.": "REF-6630-B",
    Location: "Johar Town",
    Feeder: "Johar Town Feeder",
    Subdivision: "West Division",
    Tariff: "A1-Commercial",
    SanctionedLoad: "60 kW",
    ConnectionDate: "2020-10-30",
  },
  {
    MSN: "2999818810",
    "Ref. No.": "REF-8810-F",
    Location: "Ferozepur Road",
    Feeder: "Chung Feeder",
    Subdivision: "South Division",
    Tariff: "B2-Industrial",
    SanctionedLoad: "150 kW",
    ConnectionDate: "2017-09-12",
  },
  {
    MSN: "2999819955",
    "Ref. No.": "REF-9955-C",
    Location: "Ravi Road",
    Feeder: "Ravi Feeder",
    Subdivision: "North Division",
    Tariff: "A1-Commercial",
    SanctionedLoad: "40 kW",
    ConnectionDate: "2022-06-18",
  },
];

export const DEMO_SUMMARY = {
  msn: null,
  meters_analyzed: 10,
  gaps: {
    total: 18,
    by_classification: {
      "ALIGNS WITH POWER OUTAGE": 11,
      "NO MATCHING OUTAGE EVENT": 5,
      "LOW_COVERAGE": 2,
    },
    longest_hours: 52.3,
  },
  trend: {
    by_flag: {
      "NORMAL_CONSUMPTION_TREND": 260,
      "SUSPICIOUS_LOW_CONSUMPTION": 14,
      "INSUFFICIENT_BASELINE_DATA": 12,
    },
  },
  peak: {
    max_kw: 148.5,
    avg_kw: 64.2,
  },
  screen: {
    by_priority: {
      INSPECT: 3,
      REVIEW: 4,
      "NO ACTION": 3,
    },
    inspect: 3,
    review: 4,
    top_score: 88,
  },
};

export const DEMO_WORKLIST_ROWS = [
  {
    Score: 88,
    Priority: "INSPECT",
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Why Flagged": "Prolonged zero-load periods without matching grid outage; sudden 68% drop in average daily consumption.",
    "Peak Load (kW)": 44.2,
    MF: 1,
    "Tier 1A Signals": 2,
    "Tier 1B Signals": 1,
  },
  {
    Score: 82,
    Priority: "INSPECT",
    MSN: "2999815228",
    "Ref. No.": "REF-5528-D",
    "Why Flagged": "36.5h gap with 0% outage correlation; unexplained night-shift peak anomaly.",
    "Peak Load (kW)": 88.0,
    MF: 1,
    "Tier 1A Signals": 2,
    "Tier 1B Signals": 0,
  },
  {
    Score: 74,
    Priority: "INSPECT",
    MSN: "2999811198",
    "Ref. No.": "REF-1198-A",
    "Why Flagged": "24.6h unrecorded break; baseline consumption deviation exceeds -75%.",
    "Peak Load (kW)": 48.6,
    MF: 1,
    "Tier 1A Signals": 1,
    "Tier 1B Signals": 2,
  },
  {
    Score: 58,
    Priority: "REVIEW",
    MSN: "2999814820",
    "Ref. No.": "REF-8842-C",
    "Why Flagged": "Intermittent load drop during peak commercial hours; low event correlation coverage (34%).",
    "Peak Load (kW)": 118.4,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 2,
  },
  {
    Score: 52,
    Priority: "REVIEW",
    MSN: "2999818810",
    "Ref. No.": "REF-8810-F",
    "Why Flagged": "Frequent reverse energy events recorded; partial outage alignment.",
    "Peak Load (kW)": 148.5,
    MF: 2,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 2,
  },
  {
    Score: 46,
    Priority: "REVIEW",
    MSN: "2999813501",
    "Ref. No.": "REF-3501-A",
    "Why Flagged": "Deviation from historical baseline (-42%); 3 minor gaps.",
    "Peak Load (kW)": 72.1,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 1,
  },
  {
    Score: 41,
    Priority: "REVIEW",
    MSN: "2999816630",
    "Ref. No.": "REF-6630-B",
    "Why Flagged": "Weekend consumption anomaly; low outage coverage on 2 breaks.",
    "Peak Load (kW)": 58.9,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 1,
  },
];

export const DEMO_ALL_SCREENED_ROWS = [
  ...DEMO_WORKLIST_ROWS,
  {
    Score: 24,
    Priority: "NO ACTION",
    MSN: "2999812211",
    "Ref. No.": "REF-2218-B",
    "Why Flagged": "Normal residential profile; gaps fully align with feeder outages.",
    "Peak Load (kW)": 23.8,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 0,
  },
  {
    Score: 18,
    Priority: "NO ACTION",
    MSN: "2999817742",
    "Ref. No.": "REF-7742-E",
    "Why Flagged": "Consistent high load pattern conforming to commercial tariff.",
    "Peak Load (kW)": 108.2,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 0,
  },
  {
    Score: 12,
    Priority: "NO ACTION",
    MSN: "2999819955",
    "Ref. No.": "REF-9955-C",
    "Why Flagged": "Clean record; all break intervals match recorded grid maintenance.",
    "Peak Load (kW)": 38.5,
    MF: 1,
    "Tier 1A Signals": 0,
    "Tier 1B Signals": 0,
  },
];

export const DEMO_SIGNAL_WEIGHTS = [
  { Signal: "Unmatched Load Profile Break (>12h)", Weight: 35, Category: "Break Anomalies" },
  { Signal: "Severe Consumption Drop (>60% vs Baseline)", Weight: 25, Category: "Trend Deviation" },
  { Signal: "Reverse Energy / Tamper Events", Weight: 20, Category: "Meter Events" },
  { Signal: "Low Outage Alignment Coverage (<40%)", Weight: 15, Category: "Grid Correlation" },
  { Signal: "Off-Peak Night Demand Spike", Weight: 10, Category: "Demand Timing" },
];

export const DEMO_GAP_ROWS = [
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-02 08:15:00",
    "Break End (next good reading)": "2026-07-02 11:32:00",
    "Duration (hours)": 3.3,
    "Outage Coverage %": 96,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 4,
  },
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-05 14:20:00",
    "Break End (next good reading)": "2026-07-05 22:48:00",
    "Duration (hours)": 8.5,
    "Outage Coverage %": 0,
    Classification: "NO MATCHING OUTAGE EVENT",
    "Missing Intervals": 10,
  },
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-09 02:10:00",
    "Break End (next good reading)": "2026-07-09 18:32:00",
    "Duration (hours)": 16.4,
    "Outage Coverage %": 88,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 19,
  },
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-13 06:05:00",
    "Break End (next good reading)": "2026-07-14 10:18:00",
    "Duration (hours)": 28.2,
    "Outage Coverage %": 91,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 33,
  },
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-18 09:44:00",
    "Break End (next good reading)": "2026-07-20 14:02:00",
    "Duration (hours)": 52.3,
    "Outage Coverage %": 0,
    Classification: "NO MATCHING OUTAGE EVENT",
    "Missing Intervals": 63,
  },
  {
    MSN: "2999815146",
    "Ref. No.": "REF-9992-A",
    "Break Start (last good reading)": "2026-07-22 13:18:00",
    "Break End (next good reading)": "2026-07-22 17:04:00",
    "Duration (hours)": 3.8,
    "Outage Coverage %": 94,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 5,
  },
  {
    MSN: "2999814820",
    "Ref. No.": "REF-8842-C",
    "Break Start (last good reading)": "2026-07-03 04:10:00",
    "Break End (next good reading)": "2026-07-03 08:35:00",
    "Duration (hours)": 4.4,
    "Outage Coverage %": 88,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 5,
  },
  {
    MSN: "2999814820",
    "Ref. No.": "REF-8842-C",
    "Break Start (last good reading)": "2026-07-11 11:00:00",
    "Break End (next good reading)": "2026-07-11 18:22:00",
    "Duration (hours)": 7.4,
    "Outage Coverage %": 34,
    Classification: "LOW_COVERAGE",
    "Missing Intervals": 9,
  },
  {
    MSN: "2999815228",
    "Ref. No.": "REF-5528-D",
    "Break Start (last good reading)": "2026-07-10 02:00:00",
    "Break End (next good reading)": "2026-07-11 14:30:00",
    "Duration (hours)": 36.5,
    "Outage Coverage %": 0,
    Classification: "NO MATCHING OUTAGE EVENT",
    "Missing Intervals": 44,
  },
  {
    MSN: "2999811198",
    "Ref. No.": "REF-1198-A",
    "Break Start (last good reading)": "2026-07-14 03:10:00",
    "Break End (next good reading)": "2026-07-15 03:46:00",
    "Duration (hours)": 24.6,
    "Outage Coverage %": 0,
    Classification: "NO MATCHING OUTAGE EVENT",
    "Missing Intervals": 30,
  },
  {
    MSN: "2999812211",
    "Ref. No.": "REF-2218-B",
    "Break Start (last good reading)": "2026-07-06 14:20:00",
    "Break End (next good reading)": "2026-07-06 21:08:00",
    "Duration (hours)": 6.8,
    "Outage Coverage %": 94,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 8,
  },
  {
    MSN: "2999812211",
    "Ref. No.": "REF-2218-B",
    "Break Start (last good reading)": "2026-07-18 09:00:00",
    "Break End (next good reading)": "2026-07-18 17:10:00",
    "Duration (hours)": 8.2,
    "Outage Coverage %": 91,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 10,
  },
  {
    MSN: "2999813501",
    "Ref. No.": "REF-3501-A",
    "Break Start (last good reading)": "2026-07-08 07:15:00",
    "Break End (next good reading)": "2026-07-08 12:45:00",
    "Duration (hours)": 5.5,
    "Outage Coverage %": 92,
    Classification: "ALIGNS WITH POWER OUTAGE",
    "Missing Intervals": 7,
  },
  {
    MSN: "2999818810",
    "Ref. No.": "REF-8810-F",
    "Break Start (last good reading)": "2026-07-16 23:00:00",
    "Break End (next good reading)": "2026-07-17 06:15:00",
    "Duration (hours)": 7.25,
    "Outage Coverage %": 40,
    Classification: "LOW_COVERAGE",
    "Missing Intervals": 9,
  },
];

// Generate 30 days of trend data for sample meters
export const DEMO_TREND_ROWS = (() => {
  const rows = [];
  const dates = [
    "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
    "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
    "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15",
    "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20",
    "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25",
    "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30",
  ];

  DEMO_METERS.slice(0, 5).forEach((meter) => {
    const base = meter.MSN === "2999815146" ? 180 : meter.MSN === "2999814820" ? 620 : 310;
    dates.forEach((date, i) => {
      let kwh = base + Math.sin(i) * (base * 0.15);
      let flag = "NORMAL_CONSUMPTION_TREND";
      let deviation = ((kwh - base) / base) * 100;

      // simulate suspicious drop on flagged meter
      if (meter.MSN === "2999815146" && (i >= 17 && i <= 21)) {
        kwh = base * 0.28;
        flag = "SUSPICIOUS_LOW_CONSUMPTION";
        deviation = -72.0;
      } else if (meter.MSN === "2999815228" && (i >= 9 && i <= 11)) {
        kwh = base * 0.2;
        flag = "SUSPICIOUS_LOW_CONSUMPTION";
        deviation = -80.0;
      }

      rows.push({
        MSN: meter.MSN,
        "Ref. No.": meter["Ref. No."],
        Date: date,
        "Daily Consumption (kWh)": Math.round(kwh * 10) / 10,
        "Baseline Avg (kWh)": base,
        "Deviation %": Math.round(deviation * 10) / 10,
        "Trend Flag": flag,
      });
    });
  });
  return rows;
})();

// Peak load rows per day per meter
export const DEMO_PEAK_ROWS = (() => {
  const rows = [];
  const times = ["14:30", "15:00", "19:30", "20:00", "20:30", "21:00", "02:15"];
  DEMO_TREND_ROWS.forEach((tr, i) => {
    const time = times[i % times.length];
    const peakKw = Math.round((tr["Daily Consumption (kWh)"] / 10) * 1.6 * 10) / 10;
    rows.push({
      MSN: tr.MSN,
      "Ref. No.": tr["Ref. No."],
      Date: tr.Date,
      "Peak Load (kW)": peakKw,
      "Time of Peak": time,
      "MF Scale Applied": 1,
    });
  });
  return rows;
})();

export const DEMO_WEEKLY_ROWS = [
  { MSN: "2999815146", "Ref. No.": "REF-9992-A", Period: "2026-W27", "Peak Consumption (kWh)": 1280 },
  { MSN: "2999815146", "Ref. No.": "REF-9992-A", Period: "2026-W28", "Peak Consumption (kWh)": 1310 },
  { MSN: "2999815146", "Ref. No.": "REF-9992-A", Period: "2026-W29", "Peak Consumption (kWh)": 590 },
  { MSN: "2999815146", "Ref. No.": "REF-9992-A", Period: "2026-W30", "Peak Consumption (kWh)": 1150 },
  { MSN: "2999814820", "Ref. No.": "REF-8842-C", Period: "2026-W27", "Peak Consumption (kWh)": 4320 },
  { MSN: "2999814820", "Ref. No.": "REF-8842-C", Period: "2026-W28", "Peak Consumption (kWh)": 4410 },
  { MSN: "2999814820", "Ref. No.": "REF-8842-C", Period: "2026-W29", "Peak Consumption (kWh)": 4180 },
  { MSN: "2999814820", "Ref. No.": "REF-8842-C", Period: "2026-W30", "Peak Consumption (kWh)": 4390 },
];

export const DEMO_MONTHLY_ROWS = [
  { MSN: "2999815146", "Ref. No.": "REF-9992-A", Period: "2026-07", "Peak Consumption (kWh)": 5120 },
  { MSN: "2999814820", "Ref. No.": "REF-8842-C", Period: "2026-07", "Peak Consumption (kWh)": 17800 },
  { MSN: "2999813501", "Ref. No.": "REF-3501-A", Period: "2026-07", "Peak Consumption (kWh)": 9400 },
  { MSN: "2999812211", "Ref. No.": "REF-2218-B", Period: "2026-07", "Peak Consumption (kWh)": 2800 },
  { MSN: "2999815228", "Ref. No.": "REF-5528-D", Period: "2026-07", "Peak Consumption (kWh)": 11200 },
];

export const DEMO_SHEETS = {
  "Meter Info": DEMO_METERS,
  "Load Profile Breaks": DEMO_GAP_ROWS,
  "Daily Trend Analysis": DEMO_TREND_ROWS,
  "Daily Peak Load (LP)": DEMO_PEAK_ROWS,
  "Weekly Peak Consumption (DR)": DEMO_WEEKLY_ROWS,
  "Monthly Peak Consumption (DR)": DEMO_MONTHLY_ROWS,
  "Theft Worklist": DEMO_WORKLIST_ROWS,
  "All Meters Screened": DEMO_ALL_SCREENED_ROWS,
  "Signal Weights": DEMO_SIGNAL_WEIGHTS,
};

// Map each analysis type to the sheets it produces
export const DEMO_ANALYSIS_SHEETS = {
  gaps: ["Meter Info", "Load Profile Breaks"],
  correlation: ["Meter Info", "Load Profile Breaks"],
  trend: ["Meter Info", "Daily Trend Analysis"],
  peak: ["Meter Info", "Daily Peak Load (LP)", "Weekly Peak Consumption (DR)", "Monthly Peak Consumption (DR)"],
  screen: ["Meter Info", "Theft Worklist", "All Meters Screened", "Signal Weights"],
  full: [
    "Meter Info",
    "Load Profile Breaks",
    "Daily Trend Analysis",
    "Daily Peak Load (LP)",
    "Weekly Peak Consumption (DR)",
    "Monthly Peak Consumption (DR)",
    "Theft Worklist",
    "All Meters Screened",
    "Signal Weights",
  ],
};

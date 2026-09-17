// =========================================================
// Per-meter result helpers
// =========================================================
// Turn the fleet-wide backend rows (from useJobData) into the
// single-meter shapes the result pages (GapResult / MeterDetail /
// DailyResult) render. Classification strings are underscore->space
// normalised so the pages' existing includes("NO MATCHING") /
// includes("POWER OUTAGE") checks keep working.
// =========================================================

export const normalizeMSN = (value = "") =>
  String(value).replace(/\D/g, "").trim();

// meter identity + location from the /meters list
export const findMeterInfo = (meters, msn) => {
  const nm = normalizeMSN(msn);
  const m = (meters || []).find((x) => normalizeMSN(x.MSN) === nm);
  if (!m) {
    return { msn: nm, ref: "", location: "", feeder: "Unassigned feeder" };
  }
  const location =
    [m["Division"], m["Sub-Division"]].filter(Boolean).join(" / ") ||
    m["Circle"] ||
    "";
  return {
    msn: m.MSN,
    ref: m["Ref. No."] || "",
    location,
    feeder: m["Feeder"] || "Unassigned feeder",
  };
};

const statusType = (classification = "") => {
  const c = String(classification).toUpperCase();
  if (c.includes("LOW_COVERAGE")) return "low";
  if (c.includes("NO_MATCHING") || c.includes("NO_EVENT_DATA")) return "review";
  if (c.includes("ALIGNS")) return "outage";
  return "review";
};

// one meter's gaps, in the shape the result pages expect
export const meterGapDetail = (gapRows, msn) => {
  const nm = normalizeMSN(msn);
  return (gapRows || [])
    .filter((r) => normalizeMSN(r["MSN"]) === nm)
    .map((r) => {
      const cov = r["Outage Coverage %"] == null ? 0 : Number(r["Outage Coverage %"]);
      return {
        start: String(r["Break Start (last good reading)"] || "").replace("T", " ").slice(0, 16),
        end: String(r["Break End (next good reading)"] || "").replace("T", " ").slice(0, 16),
        duration: Number(r["Duration (hours)"]) || 0,
        missing: r["Missing Readings"],
        // underscore -> space so existing includes() checks match
        classification: String(r["Classification"] || "").replace(/_/g, " "),
        coverage: `${cov}%`,
        coverageNum: cov,
        type: statusType(r["Classification"]),
      };
    });
};

export const gapSummary = (rows) => {
  const totalGaps = rows.length;
  const needsReview = rows.filter((r) => r.type === "review").length;
  const aligns = rows.filter((r) => r.type === "outage").length;
  const lowCoverage = rows.filter((r) => r.type === "low").length;
  const longestGap = rows.reduce((m, r) => Math.max(m, r.duration), 0);
  return {
    totalGaps,
    needsReview,
    aligns,
    lowCoverage,
    longestGap: longestGap.toFixed(1),
  };
};

export const gapDurationDistribution = (rows) => {
  const buckets = [
    { label: "<1h", min: 0, max: 1, color: "#1687e8" },
    { label: "1-4h", min: 1, max: 4, color: "#1687e8" },
    { label: "4-12h", min: 4, max: 12, color: "#c3212b" },
    { label: "12-24h", min: 12, max: 24, color: "#c3212b" },
    { label: ">24h", min: 24, max: Infinity, color: "#a65a16" },
  ];
  return buckets.map((b) => ({
    label: b.label,
    value: rows.filter((r) => r.duration >= b.min && r.duration < b.max).length,
    color: b.color,
  }));
};

export const gapCoveragePoints = (rows) =>
  rows.map((r, index) => ({ x: r.duration, y: r.coverageNum, type: r.type, index }));

export const gapTimeline = (rows) =>
  rows.map((r) => {
    const m = String(r.start).match(/-(\d{2})[ ]/) || String(r.start).match(/-(\d{2})$/);
    return { day: m ? Number(m[1]) : 1, type: r.type };
  });

// ---- daily trend (for DailyResult) ----
const FLAG_LABEL = {
  SUSPICIOUS_LOW_CONSUMPTION: { label: "SUSPICIOUS LOW", suspicious: true },
  NORMAL_CONSUMPTION_TREND: { label: "NORMAL", suspicious: false },
  INSUFFICIENT_BASELINE_DATA: { label: "INSUFFICIENT DATA", suspicious: false },
  BASELINE_NOT_POSITIVE_CANT_ASSESS: { label: "INSUFFICIENT DATA", suspicious: false },
  NEGATIVE_CONSUMPTION_FOR_DAY: { label: "NEGATIVE CONSUMPTION", suspicious: true },
};

export const meterTrendDetail = (trendRows, msn) => {
  const nm = normalizeMSN(msn);
  return (trendRows || [])
    .filter((r) => normalizeMSN(r["MSN"]) === nm)
    .map((r) => {
      const f = FLAG_LABEL[String(r["Trend Flag"] || "")] || { label: "NORMAL", suspicious: false };
      const cons = r["Daily Consumption (kWh)"];
      const base = r["Baseline Avg (kWh)"];
      return {
        date: r["Date"],
        consumption: cons == null ? null : Number(cons),
        baseline: base == null ? null : Number(base),
        deviation: r["Deviation %"] == null ? null : Number(r["Deviation %"]),
        flag: f.label,
        suspicious: f.suspicious,
      };
    });
};

export const trendSummary = (rows) => {
  const suspiciousDays = rows.filter((r) => r.suspicious).length;
  const insufficient = rows.filter((r) => r.flag === "INSUFFICIENT DATA").length;
  const normalDays = Math.max(0, rows.length - suspiciousDays - insufficient);
  const worstDeviation = rows.reduce(
    (m, r) => (r.deviation != null ? Math.max(m, r.deviation) : m),
    0
  );
  return {
    totalDays: rows.length,
    suspiciousDays,
    insufficient,
    normalDays,
    worstDeviation: Math.round(worstDeviation),
  };
};

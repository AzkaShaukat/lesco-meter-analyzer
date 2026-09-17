import "./PeakLoad.css";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";
import { useAxisLabelStep, useMediaQuery } from "../../hooks/useMediaQuery";

const normalizeMSN = (v = "") => String(v).replace(/\D/g, "").trim();
const fmt = (n, d = 1) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString(undefined,
    { minimumFractionDigits: d, maximumFractionDigits: d });

/* =========================================================
   Small chart primitives.
   Deliberately simple: every bar is labelled with its real
   value, so a reader never has to estimate from pixel length.
========================================================= */

function HBars({ data, unit = "", color = "#1687e8", onClick }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="pl-nodata">No data available</div>;
  return (
    <div className="pl-hbars">
      {data.map((d) => (
        <div
          className={`pl-hbar-row ${onClick ? "clickable" : ""}`}
          key={d.label}
          onClick={onClick ? () => onClick(d) : undefined}
        >
          <span className="pl-hbar-label" title={d.label}>{d.label}</span>
          <span className="pl-hbar-track">
            <span
              className="pl-hbar-fill"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color || color }}
            />
          </span>
          <span className="pl-hbar-value">{fmt(d.value)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

function VBars({ data, unit = "", color = "#1687e8", height = 150, showEvery = 1 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="pl-nodata">No data available</div>;
  return (
    <div className="pl-vbars-wrap">
      <div className="pl-vbars-y">
        <span>{fmt(max, 0)}</span>
        <span>{fmt(max / 2, 0)}</span>
        <span>0</span>
      </div>
      <div className="pl-vbars" style={{ height }}>
        {data.map((d, i) => (
          <div className="pl-vbar-col" key={d.label + i}>
            <div className="pl-vbar-hit" title={`${d.label}: ${fmt(d.value)}${unit}`}>
              <div
                className="pl-vbar"
                style={{
                  height: `${Math.max(2, (d.value / max) * 100)}%`,
                  background: d.color || color,
                }}
              />
            </div>
            <span className="pl-vbar-label">
              {i % showEvery === 0 ? d.label : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 24-hour peak-timing clock.
   Each hour is a radial bar growing outward from the centre, positioned like
   a clock face (00 at the top, 06 right, 12 bottom, 18 left). Night hours are
   amber: a meter that peaks at 2am when the fleet peaks at 8pm is worth a look.
   Drawn as stroked lines rather than wedge paths - fewer moving parts, and the
   rounded caps read better at this size. */
function PeakClock({ data, height = 250 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  const CX = 100, CY = 100, R_IN = 34, R_OUT = 82;
  const pt = (hour, r) => {
    const a = ((hour * 15 - 90) * Math.PI) / 180;   // 15 deg per hour, 00 at top
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };

  if (!total) return <div className="pl-nodata">No peak timing data</div>;
  const shown = hover != null ? data[hover] : null;

  return (
    <div className="pl-clock-wrap" style={{ height }}>
      {/* explicit square box: an <svg> is a replaced element and would not size
          itself off height alone inside a flex row (it collapsed to 150px) */}
      <div className="pl-clock-box" style={{ width: height, height }}>
      <svg viewBox="0 0 200 200" className="pl-clock">
        {/* guide rings */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={CX} cy={CY} r={R_IN + (R_OUT - R_IN) * f}
                  className="pl-clock-ring" />
        ))}
        <circle cx={CX} cy={CY} r={R_IN} className="pl-clock-hub" />

        {data.map((d, h) => {
          const [x1, y1] = pt(h, R_IN);
          const [x2e, y2e] = pt(h, R_IN + (R_OUT - R_IN) * (d.value / max));
          const [x2f, y2f] = pt(h, R_OUT);
          return (
            <g key={h}
               onMouseEnter={() => setHover(h)}
               onMouseLeave={() => setHover(null)}>
              {/* full-length invisible track keeps every hour hoverable */}
              <line x1={x1} y1={y1} x2={x2f} y2={y2f} className="pl-clock-hit" />
              <line x1={x1} y1={y1} x2={x2e} y2={y2e}
                    className={`pl-clock-bar ${hover === h ? "on" : ""} ${
                      hover != null && hover !== h ? "off" : ""}`}
                    stroke={d.color} />
            </g>
          );
        })}

        {/* quarter labels */}
        {[0, 6, 12, 18].map((h) => {
          const [lx, ly] = pt(h, R_OUT + 12);
          return (
            <text key={h} x={lx} y={ly} className="pl-clock-tick"
                  textAnchor="middle" dominantBaseline="middle">
              {String(h).padStart(2, "0")}
            </text>
          );
        })}
      </svg>

      <div className="pl-clock-center">
        {shown ? (
          <>
            <strong style={{ color: shown.color }}>{shown.value}</strong>
            <span>{shown.label}:00</span>
          </>
        ) : (
          <>
            <strong>{total}</strong>
            <span>PEAKS</span>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN
========================================================= */

function PeakLoad() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMSN = normalizeMSN(searchParams.get("msn"));

  const [topbarSearch, setTopbarSearch] = useState("");
  const [searchError, setSearchError] = useState("");

  const { job, peakRows, weeklyRows, monthlyRows, trendRows, meters } = useJobData();

  // no hover on a touchscreen, so the chart hints must say "tap"
  const isTouch = useMediaQuery("(hover: none)");

  const allRows = useMemo(
    () =>
      (peakRows || []).map((r) => ({
        msn: String(r["MSN"]),
        ref: r["Ref. No."],
        date: r["Date"],
        peak: Number(r["Peak Load (kW)"]) || 0,
        time: r["Time of Peak"] || "",
        mf: r["MF Scale Applied"],
      })),
    [peakRows]
  );

  // filters are page-specific but the control is the shared one
  const filterDefs = useMemo(() => [
    {
      key: "minPeak", label: "Minimum peak load", type: "number", suffix: "kW",
      test: (r, v) => r.peak >= Number(v),
    },
    {
      key: "when", label: "Time of peak", type: "select",
      options: [
        { value: "night", label: "Night only (23:00–05:00)" },
        { value: "day", label: "Daytime only (05:00–23:00)" },
      ],
      test: (r, v) => {
        const h = parseInt(String(r.time).slice(0, 2), 10);
        if (Number.isNaN(h)) return false;
        const night = h >= 23 || h < 5;
        return v === "night" ? night : !night;
      },
    },
    {
      key: "mf", label: "Multiplication factor", type: "select",
      options: [...new Set((allRows || []).map((r) => r.mf))]
        .filter((m) => m != null)
        .sort((a, b) => Number(a) - Number(b))
        .map((m) => ({ value: String(m), label: `MF ${m}` })),
      test: (r, v) => String(r.mf) === v,
    },
  ], [allRows]);

  const [filterValues, setFilterValues, rows] = useFilters(allRows, filterDefs);

  const findMeter = (msn) =>
    (meters || []).find((m) => normalizeMSN(m.MSN) === normalizeMSN(msn)) || null;

  const selectedMeter = useMemo(
    () => (urlMSN ? findMeter(urlMSN) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlMSN, meters]
  );

  useEffect(() => {
    setTopbarSearch(urlMSN || "");
    setSearchError("");
  }, [urlMSN]);

  const meterRows = useMemo(() => {
    if (!urlMSN) return [];
    return rows.filter((r) => normalizeMSN(r.msn) === urlMSN)
               .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [rows, urlMSN]);

  const scope = urlMSN ? meterRows : rows;

  /* ---------------- KPI values ---------------- */
  const peaks = scope.map((r) => r.peak).filter((v) => v > 0);
  const highest = peaks.length ? Math.max(...peaks) : 0;
  const average = peaks.length ? peaks.reduce((s, v) => s + v, 0) / peaks.length : 0;
  const uniqueMeters = new Set(scope.map((r) => r.msn)).size;

  /* True load factor = average load / peak load, so it needs ENERGY as well as
     demand: (day's kWh / 24) / that day's peak kW. Comparing average-of-peaks
     to highest-peak is not a load factor at all - across a fleet it compares
     different meters to each other and is meaningless. Reported as the median
     across days (per meter) or across meters (fleet). */
  const loadFactor = useMemo(() => {
    const peakBy = new Map();
    (peakRows || []).forEach((r) => {
      const kw = Number(r["Peak Load (kW)"]) || 0;
      if (kw > 0) peakBy.set(`${r["MSN"]}|${r["Date"]}`, kw);
    });

    const perMeter = new Map();
    (trendRows || []).forEach((t) => {
      const kwh = Number(t["Daily Consumption (kWh)"]);
      if (!kwh || kwh <= 0) return;
      const kw = peakBy.get(`${t["MSN"]}|${t["Date"]}`);
      if (!kw) return;
      const lf = kwh / 24 / kw;
      if (lf <= 0 || lf > 1.2) return;              // guard partial-data days
      const msn = normalizeMSN(t["MSN"]);
      if (!perMeter.has(msn)) perMeter.set(msn, []);
      perMeter.get(msn).push(lf);
    });

    const median = (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)];
    };

    if (urlMSN) return median(perMeter.get(urlMSN) || []);
    const perMeterMedians = [...perMeter.values()].map(median).filter((v) => v != null);
    return median(perMeterMedians);
  }, [peakRows, trendRows, urlMSN]);

  /* ---------------- fleet charts ---------------- */
  const topMeters = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (!m.has(r.msn) || r.peak > m.get(r.msn)) m.set(r.msn, r.peak);
    });
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([msn, peak]) => ({ label: msn, value: peak }));
  }, [rows]);

  const hourHistogram = useMemo(() => {
    const counts = Array(24).fill(0);
    scope.forEach((r) => {
      const h = parseInt(String(r.time).slice(0, 2), 10);
      if (!Number.isNaN(h) && h >= 0 && h < 24) counts[h] += 1;
    });
    return counts.map((c, h) => ({
      label: String(h).padStart(2, "0"),
      value: c,
      // night hours shaded differently - unusual peak timing is worth noticing
      color: h >= 23 || h < 5 ? "#c07a16" : "#1687e8",
    }));
  }, [scope]);

  const peakDistribution = useMemo(() => {
    const buckets = [
      { label: "<1", min: 0, max: 1 },
      { label: "1–10", min: 1, max: 10 },
      { label: "10–50", min: 10, max: 50 },
      { label: "50–200", min: 50, max: 200 },
      { label: "200–500", min: 200, max: 500 },
      { label: "500+", min: 500, max: Infinity },
    ];
    const perMeter = new Map();
    rows.forEach((r) => {
      if (!perMeter.has(r.msn) || r.peak > perMeter.get(r.msn)) perMeter.set(r.msn, r.peak);
    });
    return buckets.map((b) => ({
      label: b.label,
      value: [...perMeter.values()].filter((v) => v >= b.min && v < b.max).length,
    }));
  }, [rows]);

  const dailyFleetTrend = useMemo(() => {
    const byDate = new Map();
    rows.forEach((r) => {
      const cur = byDate.get(r.date) || 0;
      if (r.peak > cur) byDate.set(r.date, r.peak);
    });
    return [...byDate.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([date, peak]) => ({ label: String(date).slice(5), value: peak }));
  }, [rows]);

  // how many day labels the fleet-trend axis can show at this screen width
  const fleetTrendStep = useAxisLabelStep(dailyFleetTrend.length);

  /* ---------------- single-meter consumption ---------------- */
  const meterDaily = useMemo(
    () => meterRows.map((r) => ({ label: String(r.date).slice(5), value: r.peak })),
    [meterRows]
  );

  const meterWeekly = useMemo(() => {
    if (!urlMSN) return [];
    return (weeklyRows || [])
      .filter((r) => normalizeMSN(r["MSN"]) === urlMSN)
      .map((r) => ({
        period: String(r["Period"] || ""),
        value: Number(r["Peak Consumption (kWh, weekly)"]) || 0,
        peakDate: r["Peak Date"],
        days: r["Days_In_Data"],
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [weeklyRows, urlMSN]);

  const meterMonthly = useMemo(() => {
    if (!urlMSN) return [];
    return (monthlyRows || [])
      .filter((r) => normalizeMSN(r["MSN"]) === urlMSN)
      .map((r) => ({
        period: String(r["Period"] || ""),
        value: Number(r["Peak Consumption (kWh, monthly)"]) || 0,
        peakDate: r["Peak Date"],
        days: r["Days_In_Data"],
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [monthlyRows, urlMSN]);

  /* ---------------- interactions ---------------- */
  const goToMeter = (msn) => {
    const n = normalizeMSN(msn);
    if (!n) return;
    localStorage.setItem("lescoSelectedMSN", n);
    setSearchParams({ msn: n });
  };

  const handleSearch = () => {
    const n = normalizeMSN(topbarSearch);
    if (!n) return setSearchError("Enter a meter number first.");
    if (!findMeter(n)) return setSearchError("Meter not found in this analysis.");
    setSearchError("");
    goToMeter(n);
  };

  const clearMeter = () => {
    localStorage.removeItem("lescoSelectedMSN");
    setTopbarSearch(""); setSearchError(""); setSearchParams({});
  };

  const handleExport = () => {
    if (!job?.jobId) return;
    window.location.href = getExportUrl(job.jobId, urlMSN || undefined);
  };

  /* Fleet table: one row per meter rather than one row per meter-day. */
  const meterSummaryRows = useMemo(() => {
    const per = new Map();
    rows.forEach((r) => {
      const msn = String(r.msn);
      if (!per.has(msn)) {
        per.set(msn, { msn, ref: r.ref, mf: r.mf, days: 0, total: 0, peak: 0, peakDate: "" });
      }
      const m = per.get(msn);
      m.days += 1;
      m.total += r.peak;
      if (r.peak > m.peak) { m.peak = r.peak; m.peakDate = r.date; }
    });
    return [...per.values()]
      .map((m) => ({ ...m, avgPeak: m.days ? m.total / m.days : 0 }))
      .sort((a, b) => b.peak - a.peak);
  }, [rows]);

  /* ---------------- tables ---------------- */
  const fleetColumns = [
    { key: "msn", label: "MSN", sortable: true,
      render: (v) => (
        <button type="button" className="pl-msn-link" onClick={() => goToMeter(v)}
                title="Open this meter">{v}</button>
      ) },
    { key: "ref", label: "REF. NO." },
    { key: "days", label: "DAYS", sortable: true },
    { key: "peak", label: "PEAK LOAD (KW)", sortable: true, render: (v) => fmt(v, 2) },
    { key: "peakDate", label: "PEAK ON" },
    { key: "avgPeak", label: "AVG PEAK (KW)", sortable: true, render: (v) => fmt(v, 2) },
    { key: "mf", label: "MF" },
  ];
  const meterColumns = [
    { key: "date", label: "DATE", sortable: true },
    { key: "peak", label: "PEAK LOAD (KW)", sortable: true, render: (v) => fmt(v, 2) },
    { key: "time", label: "TIME OF PEAK" },
  ];

  return (
    <div className="peak-load-page">
      <TopBar
        variant="report"
        showSearch
        searchValue={topbarSearch}
        onSearchChange={(v) => { setTopbarSearch(v); setSearchError(""); }}
        onSearch={handleSearch}
      />

      <div className="pl-layout">
        <Sidebar />

        <main className="pl-content">
          <header className="pl-page-header">
            <div className="pl-page-heading">
              <h1>Peak Load{selectedMeter ? ` — ${normalizeMSN(selectedMeter.MSN)}` : ""}</h1>
              <p>
                {urlMSN
                  ? "Daily peak demand and weekly / monthly peak consumption for this meter."
                  : "Maximum demand (kW) recorded across the fleet, and when it occurs."}
              </p>
            </div>
            <div className="page-header-actions">
              {urlMSN && (
                <button type="button" className="page-back-button" onClick={clearMeter}>
                  <span>←</span> Back
                </button>
              )}
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={rows.length}
                totalCount={allRows.length}
              />
              <button type="button" className="page-export-button" onClick={handleExport}>
                <span>↓</span> Export
              </button>
            </div>
          </header>

          {selectedMeter && (
            <div className="pl-meter-pill">
              Meter {normalizeMSN(selectedMeter.MSN)} · Ref. {selectedMeter["Ref. No."]} ·{" "}
              {selectedMeter.Feeder}
            </div>
          )}
          {searchError && <div className="pl-search-error">{searchError}</div>}

          {/* ---------------- KPI ---------------- */}
          <section className="pl-kpi-grid">
            <div className="pl-kpi-card">
              <span>{urlMSN ? "PEAK LOAD" : "HIGHEST PEAK LOAD"}</span>
              <strong>{fmt(highest, 2)}<small> kW</small></strong>
              <em>{urlMSN ? "maximum recorded" : "highest single meter"}</em>
            </div>
            <div className="pl-kpi-card">
              <span>AVERAGE PEAK LOAD</span>
              <strong>{fmt(average, 2)}<small> kW</small></strong>
              <em>mean of daily peaks</em>
            </div>
            <div className="pl-kpi-card">
              <span>LOAD FACTOR</span>
              <strong>{loadFactor == null ? "—" : fmt(loadFactor, 2)}</strong>
              <em>
                {loadFactor == null
                  ? "needs daily reads"
                  : `${urlMSN ? "median day" : "median meter"} · ${
                      loadFactor >= 0.6 ? "steady load"
                        : loadFactor >= 0.3 ? "moderate" : "peaky"
                    }`}
              </em>
            </div>
            <div className="pl-kpi-card">
              <span>{urlMSN ? "DAYS ANALYSED" : "METERS ANALYSED"}</span>
              <strong>{urlMSN ? meterRows.length : uniqueMeters}</strong>
              <em>{urlMSN ? "daily peak records" : `${rows.length.toLocaleString()} daily records`}</em>
            </div>
          </section>

          {!urlMSN ? (
            /* ================= FLEET VIEW ================= */
            <>
              <section className="pl-chart-grid">
                <div className="pl-card pl-chart">
                  <h2>Highest demand by meter</h2>
                  <p>Top 10 meters by maximum recorded demand. Click a meter to open it.</p>
                  <HBars data={topMeters} unit=" kW" onClick={(d) => goToMeter(d.label)} />
                </div>

                <div className="pl-card pl-chart">
                  <h2>When peaks occur</h2>
                  <p>Daily peaks by hour, on a 24-hour clock. Amber marks night hours (23:00–05:00). {isTouch ? "Tap" : "Hover"} an hour for its count.</p>
                  <PeakClock data={hourHistogram} />
                </div>

                <div className="pl-card pl-chart">
                  <h2>Demand distribution</h2>
                  <p>How many meters fall into each peak-demand band (kW).</p>
                  <VBars data={peakDistribution} unit=" meters" color="#0e9384" />
                </div>

                <div className="pl-card pl-chart">
                  <h2>Fleet daily maximum</h2>
                  <p>Highest demand recorded anywhere in the fleet on each day.</p>
                  {/* showEvery was a fixed 3, which still crammed ~11 dates
                      onto a phone; it now thins to ~5 there, ~12 on desktop */}
                  <VBars
                    data={dailyFleetTrend}
                    unit=" kW"
                    color="#465f88"
                    showEvery={fleetTrendStep}
                  />
                </div>
              </section>

              <section className="pl-card pl-table-card">
                <ReusableTable
                  title="Peak load by meter"
                  columns={fleetColumns}
                  data={meterSummaryRows}
                  itemsPerPage={10}
                  className="peak-load-fleet-table"
                />
              </section>
            </>
          ) : (
            /* ================= SINGLE METER VIEW ================= */
            <>
              {/* ---- DAILY ---- */}
              <section className="pl-card pl-section">
                <div className="pl-section-head">
                  <h2>Daily — peak demand</h2>
                  <span className="pl-tag">kW · from load profile</span>
                </div>
                <p className="pl-section-note">
                  The highest instantaneous demand recorded on each day.
                </p>
                <VBars data={meterDaily} unit=" kW" showEvery={3} height={165} />
              </section>

              <section className="pl-chart-grid">
                {/* ---- WEEKLY ---- */}
                <div className="pl-card pl-section">
                  <div className="pl-section-head">
                    <h2>Weekly — peak consumption</h2>
                    <span className="pl-tag">kWh · from daily reads</span>
                  </div>
                  <p className="pl-section-note">
                    The highest single-day consumption within each week.
                  </p>
                  {meterWeekly.length ? (
                    <>
                      <VBars
                        data={meterWeekly.map((w) => ({
                          label: w.period.slice(5, 10),
                          value: w.value,
                        }))}
                        unit=" kWh"
                        color="#c07a16"
                        height={130}
                      />
                      <table className="pl-mini-table">
                        <thead>
                          <tr><th>Week</th><th>Peak kWh</th><th>On</th><th>Days</th></tr>
                        </thead>
                        <tbody>
                          {meterWeekly.map((w) => (
                            <tr key={w.period}>
                              <td>{w.period}</td>
                              <td className="num">{fmt(w.value, 2)}</td>
                              <td>{w.peakDate}</td>
                              <td className="num">{w.days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="pl-nodata">No weekly data for this meter</div>
                  )}
                </div>

                {/* ---- TIMING ---- sits beside Weekly so the two tall blocks pair up */}
                <div className="pl-card pl-section pl-clock-card">
                  <div className="pl-section-head">
                    <h2>When this meter peaks</h2>
                    <span className="pl-tag">hour of day</span>
                  </div>
                  <p className="pl-section-note">
                    Peaks concentrated in the night hours can indicate unusual load behaviour.
                  </p>
                  <PeakClock data={hourHistogram} height={240} />
                </div>
              </section>

              {/* ---- MONTHLY ---- full width: laid out as a horizontal stat strip
                   rather than one small card, which left most of the row empty ---- */}
              <section className="pl-card pl-section">
                <div className="pl-section-head">
                  <h2>Monthly — peak consumption</h2>
                  <span className="pl-tag">kWh · from daily reads</span>
                </div>
                <p className="pl-section-note">
                  The highest single-day consumption within each month.
                </p>
                {meterMonthly.length ? (
                  <div className="pl-month-strip">
                    {meterMonthly.map((m) => (
                      <div className="pl-month-row" key={m.period}>
                        <span className="pl-month-badge">{m.period}</span>
                        <div className="pl-month-stat">
                          <span>PEAK CONSUMPTION</span>
                          <strong>{fmt(m.value, 2)}<small> kWh</small></strong>
                        </div>
                        <div className="pl-month-stat">
                          <span>PEAK DAY</span>
                          <strong>{m.peakDate}</strong>
                        </div>
                        <div className="pl-month-stat">
                          <span>DAYS OF DATA</span>
                          <strong>{m.days}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pl-nodata">No monthly data for this meter</div>
                )}
              </section>

              <section className="pl-card pl-table-card">
                <ReusableTable
                  title={`Daily peak load detail — ${urlMSN}`}
                  columns={meterColumns}
                  data={meterRows}
                  itemsPerPage={10}
                  className="peak-load-meter-table"
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default PeakLoad;

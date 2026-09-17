import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";
import { useAxisLabelStep } from "../../hooks/useMediaQuery";

import "./DailyTrend.css";

/* =========================================================
HELPERS
========================================================= */

const normalizeMSN = (value = "") =>
  String(value).replace(/\D/g, "").trim();

const getMeterMSN = (meter) =>
  String(meter?.msn || meter?.MSN || "");

const getMeterRef = (meter) =>
  String(meter?.ref || meter?.["Ref. No."] || meter?.refNo || "");

/* =========================================================
REAL DATA TRANSFORM
========================================================= */

// backend "Trend Flag" -> the display label the CSS + summary expect
const FLAG_LABEL = {
  SUSPICIOUS_LOW_CONSUMPTION: "SUSPICIOUS LOW",
  NORMAL_CONSUMPTION_TREND: "NORMAL",
  INSUFFICIENT_BASELINE_DATA: "INSUFFICIENT DATA",
  BASELINE_NOT_POSITIVE_CANT_ASSESS: "INSUFFICIENT DATA",
  NEGATIVE_CONSUMPTION_FOR_DAY: "NEGATIVE CONSUMPTION",
};

const mapTrendRows = (rows) =>
  (rows || []).map((r, index) => {
    const rawFlag = String(r["Trend Flag"] || "");
    const consumption = r["Daily Consumption (kWh)"];
    const baseline = r["Baseline Avg (kWh)"];
    const deviation = r["Deviation %"];
    return {
      id: `${r["MSN"]}-${r["Date"]}-${index}`,
      msn: r["MSN"],
      ref: r["Ref. No."],
      date: r["Date"],
      consumption: consumption == null ? null : Number(consumption),
      baseline: baseline == null ? null : Number(baseline),
      deviation: deviation == null ? null : Number(deviation),
      flag: FLAG_LABEL[rawFlag] || "NORMAL",
      suspicious: rawFlag === "SUSPICIOUS_LOW_CONSUMPTION",
    };
  });

// average actual vs baseline per date (only counting rows with real numbers)
const getFleetAverageData = (allRows, dates) =>
  dates.map((date) => {
    const rows = allRows.filter(
      (row) =>
        row.date === date &&
        row.consumption != null &&
        row.baseline != null
    );

    if (!rows.length) {
      return { date, actual: 0, baseline: 0, suspicious: 0 };
    }

    const actual =
      rows.reduce((sum, row) => sum + row.consumption, 0) / rows.length;
    const baseline =
      rows.reduce((sum, row) => sum + row.baseline, 0) / rows.length;
    const suspicious = rows.filter((row) => row.suspicious).length;

    return {
      date,
      actual: Number(actual.toFixed(2)),
      baseline: Number(baseline.toFixed(2)),
      suspicious,
    };
  });

/* =========================================================
MAIN COMPONENT
========================================================= */

function DailyTrend() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMSN = normalizeMSN(searchParams.get("msn"));

  const [topbarSearch, setTopbarSearch] = useState("");

  // ── Real data from the backend job ──
  const { job, trendRows, meters } = useJobData();

  const unfilteredRows = useMemo(() => mapTrendRows(trendRows), [trendRows]);

  const filterDefs = useMemo(() => [
    {
      key: "flag", label: "Trend flag", type: "select",
      options: [
        { value: "SUSPICIOUS LOW", label: "Suspicious low" },
        { value: "NORMAL", label: "Normal" },
        { value: "INSUFFICIENT DATA", label: "Insufficient data" },
        { value: "NEGATIVE CONSUMPTION", label: "Negative consumption" },
      ],
      test: (r, v) => r.flag === v,
    },
    {
      key: "minDeviation", label: "Minimum drop below baseline", type: "number", suffix: "%",
      test: (r, v) => r.deviation != null && Number(r.deviation) >= Number(v),
    },
    {
      key: "minConsumption", label: "Minimum consumption", type: "number", suffix: "kWh",
      test: (r, v) => r.consumption != null && Number(r.consumption) >= Number(v),
    },
  ], []);

  const [filterValues, setFilterValues, allRows] = useFilters(unfilteredRows, filterDefs);

  const findMeter = (msn) =>
    (meters || []).find(
      (m) => normalizeMSN(m.MSN) === normalizeMSN(msn)
    ) || null;

  /* No single-meter state here on purpose. This page is always the fleet view;
     selecting a meter used to show a pill and a footer line but filtered
     nothing, so the "clear" cross appeared to do nothing. Clicking an MSN now
     simply opens /daily-result for that meter. */

  const openDailyResult = (meterOrMSN) => {
    const msn = normalizeMSN(
      typeof meterOrMSN === "object" ? getMeterMSN(meterOrMSN) : meterOrMSN
    );
    if (!msn) return;
    localStorage.setItem("lescoSelectedMSN", msn);
    setSearchParams({ msn });
    navigate(`/daily-result?msn=${encodeURIComponent(msn)}`);
  };

  const handleTopbarSearch = () => {
    const normalized = normalizeMSN(topbarSearch);
    if (!normalized) return;
    const meter = findMeter(normalized);
    if (meter) openDailyResult(getMeterMSN(meter));
  };

  /* ── summary ── */
  const summary = useMemo(() => {
    const uniqueMeters = new Set(allRows.map((row) => row.msn)).size;
    const suspiciousDays = allRows.filter((row) => row.suspicious).length;
    const insufficient = allRows.filter(
      (row) => row.flag === "INSUFFICIENT DATA"
    ).length;
    const normalDays = Math.max(
      0,
      allRows.length - suspiciousDays - insufficient
    );
    return { suspiciousDays, uniqueMeters, normalDays, insufficient };
  }, [allRows]);

  /* ── fleet line chart ── */
  const trendDates = useMemo(
    () => [...new Set(allRows.map((row) => row.date))].sort(),
    [allRows]
  );

  const fleetData = useMemo(
    () => getFleetAverageData(allRows, trendDates),
    [allRows, trendDates]
  );

  // show ~5 date labels on a phone, ~12 on a desktop, whatever the day count
  const axisStep = useAxisLabelStep(fleetData.length);

  /* ── most suspicious meters ── */
  const suspiciousMeters = useMemo(() => {
    const meterMap = new Map();
    allRows.forEach((row) => {
      if (!row.suspicious) return;
      const previous = meterMap.get(row.msn) || { msn: row.msn, count: 0 };
      previous.count += 1;
      meterMap.set(row.msn, previous);
    });
    return Array.from(meterMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allRows]);

  const maxSuspicious = Math.max(
    1,
    ...suspiciousMeters.map((item) => item.count)
  );

  /* ── calendar heat strip (by day-of-month) ── */
  const heatmap = useMemo(() => {
    const counts = {};
    allRows.forEach((row) => {
      if (!row.suspicious) return;
      const day = String(row.date).slice(8, 10); // "DD"
      if (!day) return;
      counts[day] = (counts[day] || 0) + 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    const days = Array.from({ length: 28 }, (_, i) =>
      String(i + 1).padStart(2, "0")
    );
    return days.map((day) => {
      const c = counts[day] || 0;
      const level = c === 0 ? 0 : Math.min(4, Math.ceil((c / maxCount) * 4));
      return { day, level };
    });
  }, [allRows]);

  /* ── deviation severity buckets ── */
  const severityData = useMemo(() => {
    const buckets = [
      { label: "50-60%", min: 50, max: 60, count: 0 },
      { label: "60-70%", min: 60, max: 70, count: 0 },
      { label: "70-80%", min: 70, max: 80, count: 0 },
      { label: "80-90%", min: 80, max: 90, count: 0 },
      { label: "90-100%", min: 90, max: 100.001, count: 0 },
    ];
    allRows
      .filter((row) => row.suspicious && row.deviation != null)
      .forEach((row) => {
        const drop = row.deviation; // % below baseline
        const bucket = buckets.find(
          (item) => drop >= item.min && drop < item.max
        );
        if (bucket) bucket.count += 1;
      });
    return buckets;
  }, [allRows]);

  /* ── export (real Excel from the backend) ── */
  const handleExport = () => {
    if (!job?.jobId) return;
    window.location.href = getExportUrl(job.jobId);
  };

  /* ── SVG line chart geometry ── */
  const chartWidth = 700;
  const chartHeight = 220;

  const yMax = useMemo(
    () =>
      Math.max(
        1,
        ...fleetData.map((p) => Math.max(p.actual, p.baseline))
      ) * 1.1,
    [fleetData]
  );

  const getChartX = (index, length) =>
    length <= 1 ? chartWidth / 2 : (index / (length - 1)) * chartWidth;

  const getChartY = (value) => {
    const clamped = Math.max(0, Math.min(yMax, value));
    return chartHeight - (clamped / yMax) * chartHeight;
  };

  const actualPoints = fleetData
    .map((point, index) => `${getChartX(index, fleetData.length)},${getChartY(point.actual)}`)
    .join(" ");

  const baselinePoints = fleetData
    .map((point, index) => `${getChartX(index, fleetData.length)},${getChartY(point.baseline)}`)
    .join(" ");

  /* ── table columns ── */
  /* One row per meter instead of one row per meter-day. Built from the
     FILTERED rows so the Filters button still drives the table; clicking a
     meter opens its own day-by-day list. */
  const meterSummaryRows = useMemo(() => {
    const per = new Map();
    allRows.forEach((r) => {
      const msn = String(r.msn);
      if (!per.has(msn)) {
        per.set(msn, {
          msn, ref: r.ref, days: 0, suspicious: 0,
          totalConsumption: 0, lowest: null, worstDeviation: null,
        });
      }
      const m = per.get(msn);
      m.days += 1;
      if (r.suspicious) m.suspicious += 1;
      if (r.consumption != null) {
        m.totalConsumption += Number(r.consumption);
        if (m.lowest == null || Number(r.consumption) < m.lowest) m.lowest = Number(r.consumption);
      }
      if (r.deviation != null &&
          (m.worstDeviation == null || Number(r.deviation) > m.worstDeviation)) {
        m.worstDeviation = Number(r.deviation);
      }
    });
    return [...per.values()]
      .map((m) => ({ ...m, avgConsumption: m.days ? m.totalConsumption / m.days : 0 }))
      .sort((a, b) => b.suspicious - a.suspicious);
  }, [allRows]);

  const trendColumns = [
    {
      key: "msn",
      label: "MSN",
      sortable: true,
      render: (value) => (
        <button
          type="button"
          className="dt-msn-link"
          onClick={() => openDailyResult(value)}
          title="Open this meter's daily records"
        >
          {value}
        </button>
      ),
    },
    { key: "ref", label: "REF. NO." },
    { key: "days", label: "DAYS", sortable: true },
    {
      key: "suspicious",
      label: "SUSPICIOUS DAYS",
      sortable: true,
      render: (v) => (
        <span className={`dt-count ${Number(v) > 0 ? "bad" : ""}`}>{v}</span>
      ),
    },
    {
      key: "avgConsumption",
      label: "AVG (KWH)",
      sortable: true,
      render: (v) => (v == null ? "—" : Number(v).toFixed(1)),
    },
    {
      key: "lowest",
      label: "LOWEST DAY (KWH)",
      sortable: true,
      render: (v) => (v == null ? "—" : Number(v).toFixed(1)),
    },
    {
      key: "worstDeviation",
      label: "WORST DROP",
      sortable: true,
      render: (v) => (v == null ? "—" : `${Number(v).toFixed(0)}%`),
    },
  ];

  /* =======================================================
  RENDER
  ======================================================= */

  return (
    /* real page container - this was a bare fragment, so .daily-trend-page in
       DailyTrend.css matched nothing and the whole document scrolled */
    <div className="daily-trend-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={setTopbarSearch}
        onSearch={handleTopbarSearch}
      />

      <div className="dt-layout">
        <Sidebar />

        <main className="dt-content">

          {/* PAGE HEADER */}
          <section className="dt-page-header">
            <div>
              <h1>Daily Trend Analysis</h1>
              <p>
                Flags days where a meter's consumption dropped suspiciously
                below its own baseline.
              </p>
            </div>
            <div className="page-header-actions">
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={allRows.length}
                totalCount={unfilteredRows.length}
              />
              <button
                type="button"
                className="page-export-button"
                onClick={handleExport}
              >
                <span>↓</span>
                Export
              </button>
            </div>
          </section>

          {/* SELECTED METER */}

          {/* SUMMARY */}
          <section className="dt-summary-grid">
            <div className="dt-summary-card">
              <span>SUSPICIOUS DAYS</span>
              <strong>{summary.suspiciousDays}</strong>
              <small>fleet-wide</small>
              <i className="dt-summary-icon red">△</i>
            </div>
            <div className="dt-summary-card">
              <span>METERS AFFECTED</span>
              <strong>{summary.uniqueMeters}</strong>
              <small>{summary.uniqueMeters} total</small>
              <i className="dt-summary-icon blue">ⓘ</i>
            </div>
            <div className="dt-summary-card teal">
              <span>NORMAL DAYS</span>
              <strong>{summary.normalDays}</strong>
              <small>✓</small>
              <i className="dt-summary-icon green">✓</i>
            </div>
            <div className="dt-summary-card">
              <span>INSUFFICIENT DATA</span>
              <strong>{summary.insufficient}</strong>
              <small>fleet-wide</small>
              <i className="dt-summary-icon gray">ⓘ</i>
            </div>
          </section>

          {/* CHARTS ROW 1 */}
          <section className="dt-chart-grid">
            <div className="dt-chart-card">
              <div className="dt-chart-title">Fleet average consumption vs baseline</div>
              <div className="dt-legend">
                <span><i className="dt-legend-actual" />Actual</span>
                <span><i className="dt-legend-baseline" />Baseline</span>
                <span><i className="dt-legend-dot" />Suspicious day</span>
              </div>
              <div className="dt-line-chart">
                <div className="dt-y-labels">
                  <span>{Math.round(yMax)}</span>
                  <span>{Math.round(yMax * 0.75)}</span>
                  <span>{Math.round(yMax * 0.5)}</span>
                  <span>{Math.round(yMax * 0.25)}</span>
                  <span>0</span>
                </div>
                <div className="dt-line-area">
                  {[0, 1, 2, 3, 4].map((line) => (
                    <div key={line} className="dt-horizontal-grid" style={{ top: `${line * 25}%` }} />
                  ))}
                  <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="dt-line-svg">
                    <polyline points={baselinePoints} className="dt-baseline-path" fill="none" />
                    <polyline points={actualPoints} className="dt-actual-path" fill="none" />
                    {fleetData.map((point, index) => {
                      if (!point.suspicious) return null;
                      return (
                        <circle
                          key={index}
                          cx={getChartX(index, fleetData.length)}
                          cy={getChartY(point.actual)}
                          r="4"
                          className="dt-suspicious-point"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
              {/* Every span is kept so the spacing still lines up with the
                  points, but only every Nth carries text - a month of daily
                  data drew 31 labels into a phone screen and they merged into
                  an unreadable smear. */}
              <div className="dt-chart-axis">
                {fleetData.map((point, i) => (
                  <span key={point.date}>
                    {i % axisStep === 0 ? String(point.date).slice(5) : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className="dt-chart-card">
              <div className="dt-chart-title">Most suspicious meters (days flagged)</div>
              <div className="dt-meter-bars">
                {suspiciousMeters.length > 0 ? (
                  suspiciousMeters.map((item) => {
                    const width = (item.count / maxSuspicious) * 100;
                    return (
                      <button
                        type="button"
                        className="dt-meter-bar-row"
                        key={item.msn}
                        onClick={() => openDailyResult(item.msn)}
                      >
                        <span className="dt-meter-bar-label">MSN {item.msn}</span>
                        <span className="dt-meter-bar-track">
                          <span className="dt-meter-bar-fill" style={{ width: `${width}%` }} />
                        </span>
                        <strong>{item.count}</strong>
                      </button>
                    );
                  })
                ) : (
                  <div className="dt-no-chart-data">No suspicious meters found.</div>
                )}
              </div>
            </div>
          </section>

          {/* CHARTS ROW 2 */}
          <section className="dt-chart-grid">
            <div className="dt-chart-card">
              <div className="dt-chart-title">Suspicious days by date (fleet-wide)</div>
              <div className="dt-heatmap">
                {heatmap.map((cell) => (
                  <button
                    type="button"
                    key={cell.day}
                    className={`dt-heat-cell level-${cell.level}`}
                    title={`Day ${cell.day}`}
                  >
                    {cell.day}
                  </button>
                ))}
              </div>
              <div className="dt-heatmap-legend">
                <span>Less</span>
                <i className="level-0" />
                <i className="level-1" />
                <i className="level-2" />
                <i className="level-3" />
                <i className="level-4" />
                <span>More</span>
              </div>
            </div>

            <div className="dt-chart-card">
              <div className="dt-chart-title">Deviation severity (suspicious days)</div>
              <div className="dt-severity-chart">
                {severityData.map((item, itemIndex) => {
                  const max = Math.max(1, ...severityData.map((x) => x.count));
                  const height = (item.count / max) * 100;
                  return (
                    <div className="dt-severity-column" key={item.label}>
                      <span className="dt-severity-value">{item.count}</span>
                      <div className="dt-severity-track">
                        <div
                          className={`dt-severity-fill severity-${itemIndex}`}
                          style={{ height: `${Math.max(5, height)}%` }}
                        />
                      </div>
                      <span className="dt-severity-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* --- TABLE SECTION (REUSABLE) --- */}
          <section className="dt-table-card">
            <ReusableTable
              title="Consumption by meter"
              columns={trendColumns}
              data={meterSummaryRows}
              itemsPerPage={10}
              className="daily-trend-table"
            />
          </section>

          {/* FOOTER — this page is always the fleet view; clicking a meter
              opens /daily-result, so there is no single-meter state here. */}
          <div className="dt-demo-status">
            Showing daily trend results for all analyzed meters. Click an MSN for
            that meter's daily records.
          </div>

        </main>
      </div>
    </div>
  );
}

export default DailyTrend;

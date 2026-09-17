import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./FullReport.css";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";

const FullReport = () => {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("overview");
  const [searchValue, setSearchValue] = useState("");

  // ── Real data from the backend job ──
  const { job, summary, meters, gapRows, trendRows, peakRows, screenRows } =
    useJobData();

  // no hover on a touchscreen, so the chart hints must say "tap"
  const isTouch = useMediaQuery("(hover: none)");

  const fmtTs = (value) =>
    value ? String(value).replace("T", " ").slice(0, 16) : "";

  const summaryData = useMemo(() => {
    const byClass = summary?.gaps?.by_classification || {};
    return {
      metersAnalyzed: summary?.meters_analyzed || 0,
      totalGaps: summary?.gaps?.total || 0,
      alignsWithOutage: byClass["ALIGNS_WITH_POWER_OUTAGE"] || 0,
      // gaps that overlap an outage but are less than 50% covered by it -
      // mostly unexplained, so they are counted separately from "aligns"
      lowCoverage: byClass["ALIGNS_WITH_POWER_OUTAGE_LOW_COVERAGE"] || 0,
      needsReview:
        (byClass["NO_MATCHING_OUTAGE_EVENT"] || 0) +
        (byClass["NO_EVENT_DATA_FOR_METER"] || 0),
      suspiciousDays:
        summary?.trend?.by_flag?.["SUSPICIOUS_LOW_CONSUMPTION"] || 0,
    };
  }, [summary]);

  // Donut segments. Each carries its gap count AND how many distinct meters
  // fall in that category, so hovering can report both.
  const donutSegments = useMemo(() => {
    const meterSets = { review: new Set(), low: new Set(), aligns: new Set() };
    gapRows.forEach((r) => {
      const c = String(r["Classification"] || "").toUpperCase();
      const msn = r["MSN"];
      if (c.includes("LOW_COVERAGE")) meterSets.low.add(msn);
      else if (c.includes("NO_MATCHING") || c.includes("NO_EVENT_DATA")) meterSets.review.add(msn);
      else if (c.includes("ALIGNS")) meterSets.aligns.add(msn);
    });

    const defs = [
      { key: "review", label: "Needs review", value: summaryData.needsReview, color: "#c3212b" },
      { key: "low", label: "Low coverage", value: summaryData.lowCoverage, color: "#c07a16" },
      { key: "aligns", label: "Aligns with outage", value: summaryData.alignsWithOutage, color: "#149b8d" },
    ];

    const total = Math.max(summaryData.totalGaps, 1);
    let acc = 0;
    return defs.map((d) => {
      const frac = d.value / total;
      const seg = {
        ...d,
        frac,
        offset: acc,
        pct: Math.round(1000 * frac) / 10,
        meters: meterSets[d.key].size,
      };
      acc += frac;
      return seg;
    });
  }, [summaryData, gapRows]);

  // which donut segment the cursor is over (null = show the total)
  const [hoveredSeg, setHoveredSeg] = useState(null);

  /* OVERVIEW TABLE — one row per meter, summarised ACROSS every analysis.
     Deliberately different from the Load Profile Break page, which covers
     breaks only; this is the "everything at a glance" view that says, for each
     meter, how it looks on breaks AND consumption AND demand AND the theft
     screen. Built from Meter Info so every analysed meter appears, even one
     with nothing wrong. */
  const overviewRows = useMemo(() => {
    const row = new Map();
    (meters || []).forEach((m) => {
      const msn = String(m.MSN);
      row.set(msn, {
        msn,
        ref: m["Ref. No."],
        feeder: m.Feeder || "—",
        breaks: 0,
        unexplained: 0,
        suspiciousDays: 0,
        peakKw: null,
        score: null,
        priority: "no action",
      });
    });

    const ensure = (msn) => {
      const k = String(msn);
      if (!row.has(k)) {
        row.set(k, {
          msn: k, ref: "", feeder: "—", breaks: 0, unexplained: 0,
          suspiciousDays: 0, peakKw: null, score: null, priority: "no action",
        });
      }
      return row.get(k);
    };

    gapRows.forEach((r) => {
      const m = ensure(r["MSN"]);
      m.breaks += 1;
      const c = String(r["Classification"] || "").toUpperCase();
      if (c.includes("NO_MATCHING") || c.includes("NO_EVENT_DATA")) m.unexplained += 1;
    });

    (trendRows || []).forEach((r) => {
      if (r["Trend Flag"] === "SUSPICIOUS_LOW_CONSUMPTION") ensure(r["MSN"]).suspiciousDays += 1;
    });

    (peakRows || []).forEach((r) => {
      const m = ensure(r["MSN"]);
      const kw = Number(r["Peak Load (kW)"]) || 0;
      if (m.peakKw == null || kw > m.peakKw) m.peakKw = kw;
    });

    (screenRows || []).forEach((r) => {
      const m = ensure(r["MSN"]);
      m.score = Number(r.Score);
      m.priority = String(r.Priority || "no action");
    });

    // worst first: theft score, then unexplained breaks
    return [...row.values()].sort(
      (a, b) => (b.score ?? -1) - (a.score ?? -1) || b.unexplained - a.unexplained
    );
  }, [meters, gapRows, trendRows, peakRows, screenRows]);

  const filterDefs = useMemo(() => [
    {
      key: "priority", label: "Priority", type: "select",
      options: [
        { value: "INSPECT", label: "Inspect" },
        { value: "REVIEW", label: "Review" },
        { value: "no action", label: "No action" },
      ],
      test: (r, v) => r.priority === v,
    },
    {
      key: "minScore", label: "Minimum score", type: "number",
      test: (r, v) => Number(r.score ?? -1) >= Number(v),
    },
    {
      key: "minUnexplained", label: "Min unexplained breaks", type: "number",
      test: (r, v) => r.unexplained >= Number(v),
    },
    {
      key: "minSuspicious", label: "Min suspicious days", type: "number",
      test: (r, v) => r.suspiciousDays >= Number(v),
    },
  ], []);

  const [filterValues, setFilterValues, meterEntries] =
    useFilters(overviewRows, filterDefs);

  const gapColumns = [
    {
      key: "msn",
      label: "MSN",
      sortable: true,
      render: (value) => (
        <button
          type="button"
          className="fr-msn-link"
          onClick={() => openMeterDetail(value)}
          title="Open this meter"
        >
          {value}
        </button>
      ),
    },
    { key: "ref", label: "Ref. No." },
    { key: "feeder", label: "Feeder" },
    {
      key: "breaks",
      label: "Breaks",
      sortable: true,
      render: (v) => Number(v).toLocaleString(),
    },
    {
      key: "unexplained",
      label: "Unexplained",
      sortable: true,
      render: (v) => (
        <span className={`fr-count ${Number(v) > 0 ? "bad" : ""}`}>
          {Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "suspiciousDays",
      label: "Suspicious days",
      sortable: true,
      render: (v) => (
        <span className={`fr-count ${Number(v) > 0 ? "warn" : ""}`}>{v}</span>
      ),
    },
    {
      key: "peakKw",
      label: "Peak (kW)",
      sortable: true,
      render: (v) => (v == null ? "—" : Number(v).toFixed(1)),
    },
    {
      key: "score",
      label: "Score",
      sortable: true,
      render: (v) => (v == null ? "—" : v),
    },
    {
      key: "priority",
      label: "Priority",
      render: (v) => (
        <span className={`fr-priority ${String(v).toLowerCase().replace(/\s+/g, "-")}`}>
          {v}
        </span>
      ),
    },
  ];

  const longestGaps = useMemo(() => {
    return [...gapRows]
      .map((row) => ({
        meter: row["MSN"],
        hours: Number(row["Duration (hours)"]),
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [gapRows]);

  /* Per-meter roll-up of the breaks. Drives the "affected meters" KPI and the
     Needs-attention list, both of which are about METERS rather than the raw
     break rows the other cards already count. */
  const breakStats = useMemo(() => {
    const per = new Map();
    let totalHours = 0;

    gapRows.forEach((r) => {
      const msn = String(r["MSN"]);
      const c = String(r["Classification"] || "").toUpperCase();
      const hrs = Number(r["Duration (hours)"]) || 0;
      totalHours += hrs;

      if (!per.has(msn)) per.set(msn, { msn, total: 0, unexplained: 0, aligned: 0, hours: 0 });
      const m = per.get(msn);
      m.total += 1;
      m.hours += hrs;
      if (c.includes("NO_MATCHING") || c.includes("NO_EVENT_DATA")) m.unexplained += 1;
      else if (c.includes("ALIGNS")) m.aligned += 1;
    });

    const meterList = [...per.values()];
    const worst = meterList.slice().sort((a, b) => b.unexplained - a.unexplained)[0] || null;
    // meters where not one break lines up with a recorded outage
    const noneExplained = meterList.filter((m) => m.total > 0 && m.aligned === 0).length;

    return { affectedMeters: meterList.length, totalHours, worst, noneExplained };
  }, [gapRows]);

  /* Deliberately does NOT repeat what the KPI cards or the Longest-breaks
     chart already show. Each line is a meter-level fact found nowhere else
     on the page. */
  const attentionItems = useMemo(() => {
    const { worst, noneExplained, totalHours, affectedMeters } = breakStats;
    const flagged = summary?.screen?.inspect;
    const items = [];

    if (worst && worst.unexplained > 0) {
      items.push({
        type: "danger",
        title: `Worst meter: ${worst.unexplained.toLocaleString()} unexplained breaks`,
        note: `MSN ${worst.msn}`,
        msn: worst.msn,
      });
    }

    if (noneExplained > 0) {
      items.push({
        type: "danger",
        title: `${noneExplained} meter${noneExplained === 1 ? "" : "s"} with no break explained by an outage`,
        note:
          noneExplained === 1
            ? "Not one of its breaks matches a power-fail event"
            : "Not one of their breaks matches a power-fail event",
      });
    }

    items.push({
      type: "warning",
      title: `${Math.round(totalHours).toLocaleString()} hours of readings missing`,
      note: affectedMeters
        ? `across ${affectedMeters} meters — avg ${(totalHours / affectedMeters).toFixed(1)} h each`
        : "fleet-wide",
    });

    if (flagged != null) {
      items.push({
        type: "info",
        title: `${flagged} meter${flagged === 1 ? "" : "s"} flagged for inspection`,
        note: "Open the worklist",
        to: "/worklist",
      });
    }

    return items;
  }, [breakStats, summary]);

  // ── Meter detail navigation ──
  const openMeterDetail = (msn) => {
    if (!msn) return;
    localStorage.setItem("lescoSelectedMSN", String(msn));
    navigate(`/meter-detail?msn=${encodeURIComponent(msn)}`);
  };

  // ── TopBar Search (navigates to meter detail) ──
  const handleSearch = (value) => {
    setSearchValue(value);
    const query = value.trim();
    if (!query) return;
    const exactMeter = meters.find(
      (m) =>
        String(m.MSN) === query ||
        String(m["Ref. No."]).toLowerCase() === query.toLowerCase()
    );
    if (exactMeter) openMeterDetail(exactMeter.MSN);
  };

  // ── Sidebar navigation ──
  const handleSidebarSectionChange = (section) => {
    setActiveSection(section);
    setSearchValue("");
    const routeMap = {
      overview: "/full-report",
      gaps: "/gap-detection",
      outage: "/outage-correlation",
      daily: "/daily-trend",
      peak: "/peak-load",
    };
    navigate(routeMap[section] || "/");
  };

  const handleNewUpload = () => {
    localStorage.removeItem("lescoSelectedMeter");
    localStorage.removeItem("lescoSelectedMSN");
    navigate("/");
  };

  // ── Export (real Excel from the backend) ──
  const handleExport = () => {
    if (!job?.jobId) return;
    window.location.href = getExportUrl(job.jobId);
  };

  return (
    <div className="full-report-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={searchValue}
        onSearchChange={handleSearch}
        onSearch={handleSearch}
      />

      <div className="full-report-layout">
        <Sidebar
          activeSection="overview"
          onSectionChange={handleSidebarSectionChange}
          onNewUpload={handleNewUpload}
        />

        <main className="full-report-content">
          {/* ─── HEADER ─── */}
          <div className="report-page-header">
            <div>
              <p className="report-eyebrow">FULL REPORT</p>
              <h1 className="report-page-title">
                {activeSection === "overview"
                  ? "Overview"
                  : activeSection === "gaps"
                  ? "Load Profile Break"
                  : activeSection === "outage"
                  ? "Outage Correlation"
                  : activeSection === "daily"
                  ? "Daily Trend"
                  : activeSection === "peak"
                  ? "Peak Load"
                  : "Overview"}
              </h1>
              <p className="report-page-description">
                Complete meter data analysis and anomaly overview.
              </p>
            </div>
            <div className="page-header-actions">
            <FilterButton
              filters={filterDefs}
              values={filterValues}
              onChange={setFilterValues}
              resultCount={meterEntries.length}
              totalCount={overviewRows.length}
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
          </div>

          {/* ─── SUMMARY CARDS (unchanged) ─── */}
          <section className="report-summary-grid">
            <div className="report-summary-card">
              <span className="summary-label">METERS ANALYZED</span>
              <strong className="summary-value">
                {summaryData.metersAnalyzed.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">TOTAL BREAKS</span>
              <strong className="summary-value">
                {summaryData.totalGaps.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">AFFECTED METERS</span>
              <strong className="summary-value">
                {breakStats.affectedMeters.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">ALIGNS WITH OUTAGE</span>
              <strong className="summary-value">
                {summaryData.alignsWithOutage.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">LOW COVERAGE</span>
              <strong className="summary-value">
                {summaryData.lowCoverage.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">NEEDS REVIEW</span>
              <strong className="summary-value">
                {summaryData.needsReview.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">SUSPICIOUS DAYS</span>
              <strong className="summary-value">
                {summaryData.suspiciousDays.toLocaleString()}
              </strong>
            </div>
          </section>

          {/* ─── OVERVIEW EXTRA SECTIONS (Attention, Donut, Longest Gaps) ─── */}
          {activeSection === "overview" && (
            <section className="report-overview-grid">
              {/* Needs Attention */}
              <div className="report-data-card attention-card">
                <div className="report-card-header">
                  <div>
                    <p className="report-card-eyebrow">NEEDS ATTENTION</p>
                  </div>
                </div>
                <div className="attention-list">
                  {attentionItems.map((item, index) => (
                    <div
                      className={`attention-item attention-${item.type}`}
                      key={index}
                    >
                      <span className="attention-icon">
                        {item.type === "danger" && "▲"}
                        {item.type === "warning" && "▲"}
                        {item.type === "info" && "●"}
                      </span>
                      <div className="attention-content">
                        <p className="attention-title">{item.title}</p>
                        {item.msn ? (
                          <button
                            type="button"
                            className="attention-meter"
                            onClick={() => openMeterDetail(item.msn)}
                          >
                            {item.note}
                          </button>
                        ) : item.to ? (
                          <button
                            type="button"
                            className="attention-meter"
                            onClick={() => navigate(item.to)}
                          >
                            {item.note} →
                          </button>
                        ) : (
                          <span className="attention-note">{item.note}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Break Resolution Donut */}
              <div className="report-data-card gap-resolution-card">
                <div className="report-card-header">
                  <div>
                    <p className="report-card-eyebrow">BREAK RESOLUTION</p>
                    <h2>Break Resolution</h2>
                  </div>
                </div>
                <div className="donut-chart-area">
                  {/* SVG donut: each arc is its own element so it can be hovered.
                      A CSS conic-gradient cannot expose per-segment hit areas. */}
                  <div className="donut-svg-wrap">
                    <svg viewBox="0 0 42 42" className="donut-svg">
                      <circle className="donut-track" cx="21" cy="21" r="15.9155" />
                      {donutSegments.map((s) => (
                        <circle
                          key={s.key}
                          className={`donut-seg ${
                            hoveredSeg && hoveredSeg.key !== s.key ? "dimmed" : ""
                          }`}
                          cx="21"
                          cy="21"
                          r="15.9155"
                          stroke={s.color}
                          strokeDasharray={`${s.frac * 100} ${100 - s.frac * 100}`}
                          strokeDashoffset={25 - s.offset * 100}
                          onMouseEnter={() => setHoveredSeg(s)}
                          onMouseLeave={() => setHoveredSeg(null)}
                        >
                          <title>
                            {`${s.label}: ${s.value.toLocaleString()} gaps across ${s.meters} meters (${s.pct}%)`}
                          </title>
                        </circle>
                      ))}
                    </svg>

                    <div className="donut-center">
                      {hoveredSeg ? (
                        <>
                          <strong style={{ color: hoveredSeg.color }}>
                            {hoveredSeg.value.toLocaleString()}
                          </strong>
                          <span>{hoveredSeg.label.toUpperCase()}</span>
                          <em>
                            {hoveredSeg.meters} meters · {hoveredSeg.pct}%
                          </em>
                        </>
                      ) : (
                        <>
                          <strong>{summaryData.totalGaps.toLocaleString()}</strong>
                          <span>TOTAL BREAKS</span>
                          <em>{isTouch ? "tap a segment" : "hover a segment"}</em>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="chart-legend">
                  {donutSegments.map((s) => (
                    <span
                      key={s.key}
                      className={`legend-item ${
                        hoveredSeg && hoveredSeg.key === s.key ? "active" : ""
                      }`}
                      onMouseEnter={() => setHoveredSeg(s)}
                      onMouseLeave={() => setHoveredSeg(null)}
                    >
                      <i className="legend-dot" style={{ background: s.color }}></i>
                      {s.label} ({s.value.toLocaleString()})
                    </span>
                  ))}
                </div>
              </div>

              {/* Longest Gaps */}
              <div className="report-data-card longest-gaps-card">
                <div className="report-card-header">
                  <div>
                    <p className="report-card-eyebrow">LONGEST BREAKS</p>
                    <h2>Longest breaks (top 10)</h2>
                  </div>
                </div>
                <div className="longest-gaps-list">
                  {longestGaps.map((gap, index) => (
                    <button
                      type="button"
                      className="longest-gap-row"
                      key={`${gap.meter}-${index}`}
                      onClick={() => openMeterDetail(gap.meter)}
                    >
                      <span className="longest-gap-meter">{gap.meter}</span>
                      <div className="longest-gap-bar-wrapper">
                        <div
                          className="longest-gap-bar"
                          style={{
                            width: `${
                              Math.max(
                                18,
                                (gap.hours /
                                  Math.max(longestGaps[0]?.hours || 1, 1)) *
                                  100
                              )
                            }%`,
                          }}
                        />
                      </div>
                      <span className="longest-gap-hours">{gap.hours}h</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ─── REUSABLE TABLE ─── */}
          <ReusableTable
            title="Meter summary — all analyses"
            columns={gapColumns}
            data={meterEntries}
            itemsPerPage={10}
            className="full-report-table"
          />
        </main>
      </div>
    </div>
  );
};

export default FullReport;
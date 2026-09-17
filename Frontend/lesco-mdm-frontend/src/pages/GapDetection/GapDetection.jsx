import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";

import "./GapDetection.css";

/*
=========================================================
Transform backend "Load Profile Breaks" rows into the shape
this page's charts + table expect. Status type is align /
low / review (matches the CSS classes .align/.low/.review).
=========================================================
*/

const toGapRows = (rows, meterList) => {
  const feederByMsn = {};
  (meterList || []).forEach((m) => {
    feederByMsn[m.MSN] = m.Feeder;
  });

  return (rows || []).map((r) => {
    const classification = String(r["Classification"] || "");
    const coverage =
      r["Outage Coverage %"] == null
        ? 0
        : Number(r["Outage Coverage %"]);

    let status = "Aligns";
    let type = "align";

    if (
      classification.includes("NO_MATCHING") ||
      classification.includes("NO_EVENT_DATA")
    ) {
      status = "Needs review";
      type = "review";
    } else if (classification.includes("LOW_COVERAGE")) {
      status = "Low coverage";
      type = "low";
    }

    const rawStart = r["Break Start (last good reading)"];

    return {
      msn: r["MSN"],
      refNo: r["Ref. No."],
      gapStart: rawStart
        ? String(rawStart).replace("T", " ").slice(0, 16)
        : "",
      gapEnd: r["Break End (next good reading)"],
      hours: Number(r["Duration (hours)"]),
      coverage,
      status,
      type,
      classification,
      feeder: feederByMsn[r["MSN"]] || "Unassigned Feeder",
    };
  });
};

const buildDurationData = (gapRows) => {
  const buckets = {
    "< 1 hr": 0,
    "1-6 hrs": 0,
    "6-24 hrs": 0,
    "24+ hrs": 0,
  };

  gapRows.forEach((row) => {
    const hours = Number(row.hours);
    if (hours < 1) buckets["< 1 hr"]++;
    else if (hours < 6) buckets["1-6 hrs"]++;
    else if (hours < 24) buckets["6-24 hrs"]++;
    else buckets["24+ hrs"]++;
  });

  const values = Object.values(buckets);
  const maxValue = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0) || 1;

  return Object.entries(buckets).map(([label, value]) => ({
    label,
    value,
    share: Math.round((value / total) * 1000) / 10,
    width: Math.max(5, (value / maxValue) * 85),
  }));
};

const buildTimeOfDayData = (gapRows) => {
  const ranges = [
    { label: "Needs Review", className: "review", values: [0, 0, 0, 0, 0, 0] },
    { label: "Low Coverage", className: "low", values: [0, 0, 0, 0, 0, 0] },
    { label: "Aligns", className: "align", values: [0, 0, 0, 0, 0, 0] },
  ];

  gapRows.forEach((row) => {
    const match = String(row.gapStart).match(/[T ](\d{2}):/);
    if (!match) return;
    const hour = Number(match[1]);
    let index = Math.floor(hour / 4);
    if (index > 5) index = 5;
    const target = ranges.find((item) => item.className === row.type);
    if (target) target.values[index]++;
  });

  const maxValue = Math.max(...ranges.flatMap((item) => item.values), 1);

  return ranges.map((row) => ({
    label: row.label,
    className: row.className,
    values: row.values,          // raw counts, used by the hover tooltip
    opacity: row.values.map((value) =>
      value === 0 ? 10 : 20 + (value / maxValue) * 80
    ),
  }));
};

const buildFeederData = (gapRows) => {
  const feederCounts = {};
  gapRows.forEach((row) => {
    const feeder = row.feeder || "Others";
    feederCounts[feeder] = (feederCounts[feeder] || 0) + 1;
  });

  const total = gapRows.length || 1;

  return Object.entries(feederCounts)
    .map(([name, count]) => ({
      name,
      percentage: `${Math.round((count / total) * 100)}%`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

const buildScatterPoints = (gapRows) => {
  if (!gapRows.length) return [];
  const maxDuration = Math.max(...gapRows.map((row) => row.hours), 1);
  return gapRows.map((row) => ({
    x: row.coverage,
    y: (row.hours / maxDuration) * 90,
    type: row.type,
    // carried through only so the point can describe itself on hover
    msn: row.msn,
    hours: row.hours,
    coverage: row.coverage,
    status: row.status,
  }));
};


function GapDetection() {
  const navigate = useNavigate();

  const [search, setSearch] =
    useState("");

  const [topbarSearch, setTopbarSearch] =
    useState("");


  /*
  =======================================================
  SUMMARY
  =======================================================
  */

  /*
  =======================================================
  REAL DATA (backend job)
  =======================================================
  */

  const {
    job,
    summary: apiSummary,
    meters,
    gapRows: rawGapRows,
  } = useJobData();

  const allGapRows = useMemo(
    () => toGapRows(rawGapRows, meters),
    [rawGapRows, meters]
  );

  const filterDefs = useMemo(() => [
    {
      key: "type", label: "Break type", type: "select",
      options: [
        { value: "review", label: "Unexplained" },
        { value: "low", label: "Low coverage" },
        // NOTE: toGapRows() sets type "align" (not "outage") - these values
        // must match the data or the filter silently matches nothing.
        { value: "align", label: "Aligns with outage" },
      ],
      test: (r, v) => r.type === v,
    },
    {
      key: "minHours", label: "Minimum duration", type: "number", suffix: "h",
      test: (r, v) => Number(r.hours) >= Number(v),
    },
    {
      key: "feeder", label: "Feeder", type: "select",
      options: [...new Set((allGapRows || []).map((r) => r.feeder))]
        .filter(Boolean).sort()
        .map((f) => ({ value: f, label: f })),
      test: (r, v) => r.feeder === v,
    },
  ], [allGapRows]);

  const [filterValues, setFilterValues, gapRows] = useFilters(allGapRows, filterDefs);

  const DURATION_DATA = useMemo(
    () => buildDurationData(gapRows),
    [gapRows]
  );
  const TIME_OF_DAY_DATA = useMemo(
    () => buildTimeOfDayData(gapRows),
    [gapRows]
  );
  const FEEDERS = useMemo(
    () => buildFeederData(gapRows),
    [gapRows]
  );
  const SCATTER_POINTS = useMemo(
    () => buildScatterPoints(gapRows),
    [gapRows]
  );

  const byClass =
    apiSummary?.gaps?.by_classification || {};

  const summary = {
    totalGaps: apiSummary?.gaps?.total || 0,
    metersAnalyzed: apiSummary?.meters_analyzed || 0,
    alignsWithOutage: byClass["ALIGNS_WITH_POWER_OUTAGE"] || 0,
    needsReview:
      (byClass["NO_MATCHING_OUTAGE_EVENT"] || 0) +
      (byClass["NO_EVENT_DATA_FOR_METER"] || 0),
  };

  const lowCoverageCount =
    byClass["ALIGNS_WITH_POWER_OUTAGE_LOW_COVERAGE"] || 0;


  /*
  =======================================================
  TOPBAR SEARCH
  =======================================================
  */

  const handleTopbarSearch = (value) => {
    setTopbarSearch(value);
    setSearch(value);

    const query = value.trim();

    if (!query) {
      return;
    }

    const meterMatch =
      meters.find(
        (meter) =>
          String(meter.MSN)
            .trim()
            .toLowerCase() ===
          query.toLowerCase()
      );

    if (meterMatch) {
      openGapResult(
        meterMatch.MSN
      );
    }
  };


  /*
  =======================================================
  OPEN BREAK RESULT
  =======================================================
  */

  const openGapResult = (msn) => {
    if (!msn) {
      return;
    }

    const cleanMSN =
      String(msn).trim();

    if (!cleanMSN) {
      return;
    }

    navigate(
      `/gap-result?msn=${encodeURIComponent(
        cleanMSN
      )}`
    );
  };


  /*
  =======================================================
  ENTER KEY
  =======================================================
  */

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      const query = search.trim();

      if (!query) {
        return;
      }

      const meterMatch =
        meters.find(
          (meter) =>
            String(meter.MSN)
              .trim()
              .toLowerCase() ===
            query.toLowerCase()
        );

      if (meterMatch) {
        openGapResult(
          meterMatch.MSN
        );
      }
    }
  };


  /*
  =======================================================
  EXPORT
  =======================================================
  */

  const handleExport = () => {
    if (!job?.jobId) {
      return;
    }
    // download the real Excel report from the backend
    window.location.href = getExportUrl(job.jobId);
  };


  /*
  =======================================================
  TABLE COLUMNS FOR REUSABLE TABLE
  =======================================================
  */

  /* The fleet table used to list every individual break - 12,610 rows on a
     normal month, which is unreadable. It now shows ONE ROW PER METER with a
     summary; clicking the MSN opens that meter's own break list. */
  const meterSummaryRows = useMemo(() => {
    const per = new Map();

    gapRows.forEach((r) => {
      const msn = String(r.msn);
      if (!per.has(msn)) {
        per.set(msn, {
          msn,
          refNo: r.refNo,
          feeder: r.feeder,
          breaks: 0,
          unexplained: 0,
          lowCoverage: 0,
          aligned: 0,
          hours: 0,
          longest: 0,
        });
      }
      const m = per.get(msn);
      m.breaks += 1;
      m.hours += Number(r.hours) || 0;
      m.longest = Math.max(m.longest, Number(r.hours) || 0);
      if (r.type === "review") m.unexplained += 1;
      else if (r.type === "low") m.lowCoverage += 1;
      else m.aligned += 1;
    });

    return [...per.values()].sort((a, b) => b.unexplained - a.unexplained);
  }, [gapRows]);

  const gapColumns = [
    {
      key: "msn",
      label: "MSN",
      sortable: true,
      render: (value) => (
        <button
          type="button"
          className="gd-msn-link"
          onClick={() => openGapResult(value)}
          title="Open this meter's breaks"
        >
          {value}
        </button>
      ),
    },
    { key: "refNo", label: "Ref. No." },
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
        <span className={`gd-count ${Number(v) > 0 ? "bad" : ""}`}>
          {Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "lowCoverage",
      label: "Low coverage",
      render: (v) => Number(v).toLocaleString(),
    },
    {
      key: "aligned",
      label: "Aligned",
      render: (v) => Number(v).toLocaleString(),
    },
    {
      key: "hours",
      label: "Total hours",
      sortable: true,
      render: (v) => Number(v).toFixed(1),
    },
    {
      key: "longest",
      label: "Longest (h)",
      sortable: true,
      render: (v) => Number(v).toFixed(1),
    },
  ];


  return (
    <div className="gap-detection-page">

      {/* =================================================
          TOP BAR
      ================================================= */}

      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={
          handleTopbarSearch
        }
        onSearch={
          handleTopbarSearch
        }
      />


      {/* =================================================
          MAIN LAYOUT
      ================================================= */}

      <div className="gd-layout">

        {/* =================================================
            SHARED SIDEBAR
        ================================================= */}

        <Sidebar />


        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="gd-content">

          <div className="gd-container">


            {/* =================================================
                HEADER
            ================================================= */}

            <section className="gd-header">

              <div>

                <h1>
                  Load Profile Break
                </h1>

                <p>
                  Breaks in the load profile, checked
                  against outage events
                </p>

              </div>


              {/* =================================================
                  EXPORT
              ================================================= */}

              <div className="page-header-actions">
                <FilterButton
                  filters={filterDefs}
                  values={filterValues}
                  onChange={setFilterValues}
                  resultCount={gapRows.length}
                  totalCount={allGapRows.length}
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


            {/* =================================================
                KPI
            ================================================= */}

            <section className="gd-kpi-grid">

              <div className="gd-kpi-card">

                <p>
                  TOTAL BREAKS
                </p>

                <strong>
                  {summary.totalGaps.toLocaleString()}
                </strong>

              </div>


              <div className="gd-kpi-card">

                <p>
                  METERS ANALYZED
                </p>

                <strong>
                  {summary.metersAnalyzed.toLocaleString()}
                </strong>

              </div>


              <div className="gd-kpi-card">

                <p className="align-text">
                  ALIGNS
                </p>

                <strong>
                  {summary.alignsWithOutage.toLocaleString()}
                </strong>

              </div>


              <div className="gd-kpi-card">

                <p className="low-text">
                  LOW COVERAGE
                </p>

                <strong>
                  {lowCoverageCount.toLocaleString()}
                </strong>

              </div>


              <div className="gd-kpi-card">

                <p className="review-text">
                  NEEDS REVIEW
                </p>

                <strong>
                  {summary.needsReview.toLocaleString()}
                </strong>

              </div>

            </section>


            {/* =================================================
                CHART GRID
            ================================================= */}

            <section className="gd-chart-grid">


              {/* =================================================
                  CHART 1 — BREAK DURATION DISTRIBUTION
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  BREAK DURATION DISTRIBUTION
                </div>

                <div className="gd-duration-chart">

                  {DURATION_DATA.map(
                    (item) => (

                      <div
                        className="gd-duration-row"
                        key={item.label}
                        title={`${item.label}: ${item.value.toLocaleString()} breaks (${item.share}% of all)`}
                      >

                        <div className="gd-duration-label">
                          {item.label}
                        </div>

                        <div className="gd-duration-track">

                          <div
                            className="gd-duration-fill"
                            style={{
                              width: `${item.width}%`,
                            }}
                          />

                        </div>

                        <div className="gd-duration-value">
                          {item.value.toLocaleString()}
                        </div>

                      </div>

                    )
                  )}

                </div>

              </div>


              {/* =================================================
                  CHART 2 — DURATION VS OUTAGE COVERAGE
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading gd-heading-with-legend">

                  <span>
                    DURATION VS OUTAGE COVERAGE
                  </span>

                  <div className="gd-chart-legend">

                    <span>
                      <i className="legend-review" />
                      Review
                    </span>

                    <span>
                      <i className="legend-low" />
                      Low Cov
                    </span>

                    <span>
                      <i className="legend-align" />
                      Aligns
                    </span>

                  </div>

                </div>


                <div className="gd-scatter">

                  <div className="gd-scatter-y-title">
                    Duration (hr)
                  </div>

                  <div className="gd-scatter-area">

                    {SCATTER_POINTS.map(
                      (point, index) => (

                        <span
                          key={index}
                          className={`gd-scatter-point ${point.type}`}
                          title={`MSN ${point.msn} — ${Number(point.hours).toFixed(1)} h break, ${point.coverage}% covered by an outage (${point.status})`}
                          style={{
                            left: `${point.x}%`,
                            bottom: `${point.y}%`,
                          }}
                        />

                      )
                    )}

                  </div>

                  <div className="gd-scatter-x-title">
                    Coverage %
                  </div>

                </div>

              </div>


              {/* =================================================
                  CHART 3 — BREAK STARTS BY TIME OF DAY
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  BREAK STARTS BY TIME OF DAY
                </div>

                <div className="gd-time-chart">

                  {TIME_OF_DAY_DATA.map(
                    (row) => (

                      <div
                        className="gd-time-row"
                        key={row.label}
                      >

                        <div className="gd-time-label">
                          {row.label}
                        </div>

                        <div className="gd-time-cells">

                          {row.opacity.map(
                            (
                              opacity,
                              index
                            ) => (

                              <span
                                key={index}
                                className={`gd-time-cell ${row.className}`}
                                title={`${row.label}, ${
                                  ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"][index]
                                }: ${(row.values?.[index] ?? 0).toLocaleString()} breaks`}
                                style={{
                                  opacity:
                                    opacity /
                                    100,
                                }}
                              />

                            )
                          )}

                        </div>

                      </div>

                    )
                  )}


                  <div className="gd-time-axis">

                    <span>0-4h</span>
                    <span>4-8h</span>
                    <span>8-12h</span>
                    <span>12-16h</span>
                    <span>16-20h</span>
                    <span>20-24h</span>

                  </div>

                </div>

              </div>


              {/* =================================================
                  CHART 4 — BREAKS BY FEEDER
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  BREAKS BY FEEDER
                </div>

                <div className="gd-feeder-chart">

                  <div
                    className="gd-feeder-main"
                    title={FEEDERS[0] ? `${FEEDERS[0].name}: ${FEEDERS[0].count.toLocaleString()} breaks (${FEEDERS[0].percentage})` : undefined}
                  >

                    <span>
                      {FEEDERS[0]?.name || "—"}
                    </span>

                    <strong>
                      {FEEDERS[0]?.percentage || "0%"}
                    </strong>

                  </div>

                  <div className="gd-feeder-side">

                    <div className="gd-feeder-top">

                      <div
                        className="gd-feeder-tajpura"
                        title={FEEDERS[1] ? `${FEEDERS[1].name}: ${FEEDERS[1].count.toLocaleString()} breaks (${FEEDERS[1].percentage})` : undefined}
                      >

                        <span>
                          {FEEDERS[1]?.name || "—"}
                        </span>

                        <strong>
                          {FEEDERS[1]?.percentage || "0%"}
                        </strong>

                      </div>


                      <div
                        className="gd-feeder-mughalpura"
                        title={FEEDERS[2] ? `${FEEDERS[2].name}: ${FEEDERS[2].count.toLocaleString()} breaks (${FEEDERS[2].percentage})` : undefined}
                      >

                        <span>
                          {FEEDERS[2]?.name || "—"}
                        </span>

                        <strong>
                          {FEEDERS[2]?.percentage || "0%"}
                        </strong>

                      </div>

                    </div>


                    <div className="gd-feeder-bottom">

                      <div>
                        {FEEDERS[3]?.name || "Others"}
                      </div>

                      <div>
                        {FEEDERS[4]?.name || "Others"}
                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </section>


            {/* =================================================
                TABLE — REUSABLE TABLE
            ================================================= */}

            <section className="gd-table-card">
              <ReusableTable
                title="Breaks by meter"
                columns={gapColumns}
                data={meterSummaryRows}
                itemsPerPage={10}
                className="gap-detection-table"
              />
            </section>

          </div>

        </main>

      </div>

    </div>
  );
}

export default GapDetection;
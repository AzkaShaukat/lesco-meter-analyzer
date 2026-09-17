import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import {
  meters,
  getAllGaps,
  getSummaryData,
} from "../../data/dummyData";

import "./GapDetection.css";

const allGaps = getAllGaps();

/*
=========================================================
FIXED TABLE METER
=========================================================
Gaps + event match table hamesha isi meter ka data show
karega, chahe search mein koi bhi MSN dala jaye.
=========================================================
*/

const FIXED_TABLE_MSN = "2999815146";

const GAP_ROWS = allGaps.map((gap) => {
  const isReview =
    gap.classification.includes("NO MATCHING");

  const coverage = Number(
    String(gap.coverage).replace("%", "")
  );

  let status = "Aligns";
  let type = "align";

  if (isReview) {
    status = "Needs review";
    type = "review";
  } else if (coverage < 50) {
    status = "Low coverage";
    type = "low";
  }

  return {
    msn: gap.msn,
    refNo: gap.ref,
    gapStart: gap.start,
    gapEnd: gap.end,
    hours: Number(gap.duration),
    coverage,
    status,
    type,
    classification: gap.classification,
    feeder: gap.feeder,
    location: gap.location,
  };
});

/*
=========================================================
FIXED TABLE ROWS
=========================================================
*/

const FIXED_TABLE_ROWS = GAP_ROWS.filter(
  (row) => row.msn === FIXED_TABLE_MSN
);

/*
=========================================================
DURATION DISTRIBUTION
=========================================================
*/

const buildDurationData = () => {
  const buckets = {
    "< 1 hr": 0,
    "1-6 hrs": 0,
    "6-24 hrs": 0,
    "24+ hrs": 0,
  };

  GAP_ROWS.forEach((row) => {
    const hours = Number(row.hours);

    if (hours < 1) {
      buckets["< 1 hr"]++;
    } else if (hours < 6) {
      buckets["1-6 hrs"]++;
    } else if (hours < 24) {
      buckets["6-24 hrs"]++;
    } else {
      buckets["24+ hrs"]++;
    }
  });

  const values = Object.values(buckets);
  const maxValue = Math.max(...values, 1);

  return Object.entries(buckets).map(
    ([label, value]) => ({
      label,
      value,
      width: Math.max(
        5,
        (value / maxValue) * 85
      ),
    })
  );
};

/*
=========================================================
TIME OF DAY DATA
=========================================================
*/

const buildTimeOfDayData = () => {
  const ranges = [
    {
      label: "Needs Review",
      className: "review",
      values: [0, 0, 0, 0, 0, 0],
    },
    {
      label: "Low Coverage",
      className: "low",
      values: [0, 0, 0, 0, 0, 0],
    },
    {
      label: "Aligns",
      className: "align",
      values: [0, 0, 0, 0, 0, 0],
    },
  ];

  GAP_ROWS.forEach((row) => {
    const timePart =
      row.gapStart.split(",")[1]?.trim();

    if (!timePart) {
      return;
    }

    const hour = Number(
      timePart.split(":")[0]
    );

    let index = Math.floor(hour / 4);

    if (index > 5) {
      index = 5;
    }

    const target = ranges.find(
      (item) => item.className === row.type
    );

    if (target) {
      target.values[index]++;
    }
  });

  const maxValue = Math.max(
    ...ranges.flatMap(
      (item) => item.values
    ),
    1
  );

  return ranges.map((row) => ({
    label: row.label,
    className: row.className,
    opacity: row.values.map(
      (value) =>
        value === 0
          ? 10
          : 20 +
            (value / maxValue) * 80
    ),
  }));
};

/*
=========================================================
FEEDER DATA
=========================================================
*/

const buildFeederData = () => {
  const feederCounts = {};

  GAP_ROWS.forEach((row) => {
    const feeder = row.feeder || "Others";

    feederCounts[feeder] =
      (feederCounts[feeder] || 0) + 1;
  });

  const total = GAP_ROWS.length || 1;

  return Object.entries(feederCounts)
    .map(([name, count]) => ({
      name,
      percentage: `${Math.round(
        (count / total) * 100
      )}%`,
      count,
    }))
    .sort(
      (a, b) =>
        b.count - a.count
    )
    .slice(0, 5);
};

/*
=========================================================
SCATTER DATA
=========================================================
*/

const buildScatterPoints = () => {
  if (!GAP_ROWS.length) {
    return [];
  }

  const maxDuration = Math.max(
    ...GAP_ROWS.map(
      (row) => row.hours
    ),
    1
  );

  return GAP_ROWS.map(
    (row) => ({
      x: row.coverage,
      y:
        (row.hours /
          maxDuration) *
        90,
      type: row.type,
    })
  );
};

const DURATION_DATA =
  buildDurationData();

const TIME_OF_DAY_DATA =
  buildTimeOfDayData();

const FEEDERS =
  buildFeederData();

const SCATTER_POINTS =
  buildScatterPoints();


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

  const summary =
    getSummaryData();

  const lowCoverageCount =
    GAP_ROWS.filter(
      (row) =>
        row.coverage < 50
    ).length;


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
          String(meter.msn)
            .trim()
            .toLowerCase() ===
          query.toLowerCase()
      );

    if (meterMatch) {
      openGapResult(
        meterMatch.msn
      );
    }
  };


  /*
  =======================================================
  OPEN GAP RESULT
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
            String(meter.msn)
              .trim()
              .toLowerCase() ===
            query.toLowerCase()
        );

      if (meterMatch) {
        openGapResult(
          meterMatch.msn
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
    const exportData = {
      report:
        "Gap Detection",

      totalGaps:
        summary.totalGaps,

      metersAnalyzed:
        summary.metersAnalyzed,

      aligns:
        summary.alignsWithOutage,

      lowCoverage:
        lowCoverageCount,

      needsReview:
        summary.needsReview,

      rows: GAP_ROWS,
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            exportData,
            null,
            2
          ),
        ],
        {
          type:
            "application/json",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      "lesco-gap-detection-report.json";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  };


  /*
  =======================================================
  TABLE COLUMNS FOR REUSABLE TABLE
  =======================================================
  */

  const gapColumns = [
    {
      key: "msn",
      label: "MSN",
      render: (value, row) => (
        <button
          type="button"
          className="gd-msn-link"
          onClick={() => openGapResult(value)}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            font: "inherit",
            color: "#111111",      // Blue link
            textDecoration: "none", // No underline (Rule #3)
          }}
        >
          {value}
        </button>
      ),
    },
    { key: "refNo", label: "Ref. No." },
    { key: "gapStart", label: "Gap start" },
    {
      key: "hours",
      label: "Hours",
      render: (value) => value.toFixed(1),
    },
    {
      key: "coverage",
      label: "Coverage",
      render: (value) => `${value}%`,
    },
    {
      key: "status",
      label: "Status",
      render: (value, row) => (
        <span className={`gd-status ${row.type}`}>
          {value}
        </span>
      ),
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
            SHARED SIDEBAR — activeItem="Gap detection"
        ================================================= */}

        <Sidebar activeItem="Gap detection" />


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
                  Gap detection
                </h1>

                <p>
                  Missing intervals, checked
                  against outage events
                </p>

              </div>


              {/* =================================================
                  EXPORT
              ================================================= */}

              <button
                type="button"
                className="gd-header-export"
                onClick={
                  handleExport
                }
              >

                <span>
                  ↓
                </span>

                Export

              </button>

            </section>


            {/* =================================================
                KPI
            ================================================= */}

            <section className="gd-kpi-grid">

              <div className="gd-kpi-card">

                <p>
                  TOTAL GAPS
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
                  CHART 1 — GAP DURATION DISTRIBUTION
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  GAP DURATION DISTRIBUTION
                </div>

                <div className="gd-duration-chart">

                  {DURATION_DATA.map(
                    (item) => (

                      <div
                        className="gd-duration-row"
                        key={item.label}
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
                  CHART 3 — GAP STARTS BY TIME OF DAY
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  GAP STARTS BY TIME OF DAY
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
                  CHART 4 — GAPS BY FEEDER
              ================================================= */}

              <div className="gd-chart-card">

                <div className="gd-chart-heading">
                  GAPS BY FEEDER
                </div>

                <div className="gd-feeder-chart">

                  <div className="gd-feeder-main">

                    <span>
                      {FEEDERS[0]?.name || "—"}
                    </span>

                    <strong>
                      {FEEDERS[0]?.percentage || "0%"}
                    </strong>

                  </div>

                  <div className="gd-feeder-side">

                    <div className="gd-feeder-top">

                      <div className="gd-feeder-tajpura">

                        <span>
                          {FEEDERS[1]?.name || "—"}
                        </span>

                        <strong>
                          {FEEDERS[1]?.percentage || "0%"}
                        </strong>

                      </div>


                      <div className="gd-feeder-mughalpura">

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
                title="Gaps + Event Match"
                columns={gapColumns}
                data={FIXED_TABLE_ROWS}
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
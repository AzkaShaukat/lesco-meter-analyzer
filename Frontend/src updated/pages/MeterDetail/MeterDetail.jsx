import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import {
  meters,
  getMeterByMSN,
  getMeterSummary,
  getTimeline,
} from "../../data/dummyData";

import "./MeterDetail.css";


/*
=========================================================
DEFAULT METER
=========================================================
*/

const DEFAULT_METER = meters[0];


/*
=========================================================
HELPERS
=========================================================
*/

const normalizeMSN = (value = "") =>
  String(value)
    .replace(/\D/g, "")
    .trim();


/*
=========================================================
DAILY CONSUMPTION DUMMY DATA
=========================================================
*/

const getDailyConsumption = (meter) => {
  if (!meter) {
    return [];
  }

  const gaps = meter.gaps || [];

  const baseValues = [
    5.8,
    6.2,
    4.9,
    6.8,
    5.3,
    7.1,
    6.4,
  ];

  const baselineValues = [
    6.1,
    6.3,
    6.0,
    6.4,
    6.2,
    6.5,
    6.7,
  ];

  return baseValues.map((base, index) => {
    const gap =
      gaps[index % Math.max(gaps.length, 1)];

    const duration = gap
      ? Number(gap.duration) || 0
      : 0;

    const coverage = gap
      ? Number(
          String(gap.coverage || "100")
            .replace("%", "")
        )
      : 100;

    let actual = base;

    if (coverage < 50) {
      actual -= Math.min(
        2.2,
        duration / 10
      );
    }

    if (
      gap &&
      gap.classification &&
      gap.classification.includes(
        "NO MATCHING"
      )
    ) {
      actual -= 0.8;
    }

    return {
      day: [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
      ][index],

      actual: Math.max(
        1.5,
        Number(actual.toFixed(1))
      ),

      baseline:
        baselineValues[index],
    };
  });
};


/*
=========================================================
MAIN COMPONENT
=========================================================
*/

function MeterDetail() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] =
    useSearchParams();


  /*
  =======================================================
  URL MSN
  =======================================================
  */

  const urlMSN =
    normalizeMSN(
      searchParams.get("msn")
    );


  /*
  =======================================================
  INITIAL METER
  =======================================================
  */

  const initialMeter =
    getMeterByMSN(urlMSN) ||
    DEFAULT_METER;


  /*
  =======================================================
  STATE
  =======================================================
  */

  const [selectedMSN, setSelectedMSN] =
    useState(
      initialMeter.msn
    );

  /*
  IMPORTANT:
  Topbar search starts EMPTY.
  It does not automatically show the
  currently selected meter.
  */

  const [topbarSearch, setTopbarSearch] =
    useState("");


  /*
  =======================================================
  CURRENT METER
  =======================================================
  */

  const currentMeter =
    getMeterByMSN(selectedMSN) ||
    DEFAULT_METER;


  /*
  =======================================================
  CURRENT METER SUMMARY
  =======================================================
  */

  const summary =
    getMeterSummary(
      currentMeter
    );


  /*
  =======================================================
  TIMELINE
  =======================================================
  */

  const timeline =
    getTimeline(
      currentMeter
    );


  /*
  =======================================================
  DAILY CONSUMPTION
  =======================================================
  */

  const dailyConsumption =
    useMemo(
      () =>
        getDailyConsumption(
          currentMeter
        ),
      [currentMeter]
    );


  /*
  =======================================================
  TABLE DATA
  =======================================================
  */

  const allGaps =
    useMemo(
      () => [
        ...(currentMeter.gaps || []),
      ],
      [currentMeter]
    );


  /*
  =======================================================
  SELECT METER
  =======================================================
  */

  const selectMeter = (
    meterNumber
  ) => {
    const normalized =
      normalizeMSN(
        meterNumber
      );

    if (!normalized) {
      return;
    }

    const meter =
      getMeterByMSN(
        normalized
      );

    if (!meter) {
      return;
    }

    setSelectedMSN(
      meter.msn
    );

    /*
    Search bar keeps the exact submitted
    MSN after a successful search.
    */

    setTopbarSearch(
      meter.msn
    );

    setSearchParams({
      msn: meter.msn,
    });

    localStorage.setItem(
      "lescoSelectedMeter",
      JSON.stringify(meter)
    );

    localStorage.setItem(
      "lescoSelectedMSN",
      meter.msn
    );
  };


  /*
  =======================================================
  TOPBAR SEARCH
  =======================================================
  */

  const handleTopbarSearch =
    (value) => {
      /*
      Only update the text while typing.
      Meter does NOT change here.
      */

      setTopbarSearch(
        value
      );
    };


  /*
  =======================================================
  TOPBAR SEARCH SUBMIT
  =======================================================
  */

  const handleTopbarSearchSubmit =
    (value) => {
      const normalized =
        normalizeMSN(
          value
        );

      if (!normalized) {
        return;
      }

      const meter =
        getMeterByMSN(
          normalized
        );

      if (meter) {
        selectMeter(
          normalized
        );
      }
    };


  /*
  =======================================================
  TOPBAR SEARCH ENTER
  =======================================================
  */

  const handleTopbarSearchKeyDown =
    (event) => {
      if (
        event.key !==
        "Enter"
      ) {
        return;
      }

      handleTopbarSearchSubmit(
        topbarSearch
      );
    };


  /*
  =======================================================
  TABLE ACTION (kept unchanged)
  =======================================================
  */

  const handleTableAction =
    (gap) => {
      if (!gap) {
        return;
      }

      const isReview =
        gap.classification &&
        gap.classification.includes(
          "NO MATCHING"
        );

      if (isReview) {
        navigate(
          `/gap-result?msn=${encodeURIComponent(
            currentMeter.msn
          )}`
        );

        return;
      }

      if (gap.ref) {
        window.alert(
          `Reference No. ${gap.ref}`
        );

        return;
      }

      window.alert(
        `Meter ${currentMeter.msn} reference details`
      );
    };


  /*
  =======================================================
  NAVIGATION
  =======================================================
  */

  const handleOverview =
    () => {
      navigate(
        "/full-report"
      );
    };


  const handleAnalysisHistory =
    () => {
      navigate(
        "/full-report"
      );
    };


  const handleNewAnalysis =
    () => {
      navigate("/");
    };


  /*
  =======================================================
  EXPORT
  =======================================================
  */

  const handleExport =
    () => {
      const exportData = {
        meter:
          currentMeter.msn,

        refNo:
          currentMeter.ref,

        location:
          currentMeter.location,

        feeder:
          currentMeter.feeder,

        totalGaps:
          summary.totalGaps,

        needsReview:
          summary.needsReview,

        aligns:
          summary.aligns,

        lowCoverage:
          summary.lowCoverage,

        longestGap:
          summary.longestGap,

        gaps:
          currentMeter.gaps,
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
        `meter-${currentMeter.msn}-report.json`;

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
  TABLE COLUMNS DEFINITION
  =======================================================
  */

  const gapColumns = [
    {
      key: "start",
      label: "DATE & TIME",
      render: (value) => (
        <span className="md-date-cell">{value}</span>
      ),
    },
    {
      key: "duration",
      label: "DURATION",
      render: (value) => `${value}h`,
    },
    {
      key: "classification",
      label: "GAP TYPE",
      render: (value, row) => {
        const isReview = value && value.includes("NO MATCHING");
        return (
          <span
            className={`md-gap-type ${
              isReview ? "unexplained" : "outage"
            }`}
          >
            {isReview ? "Unexplained" : "Outage Logged"}
          </span>
        );
      },
    },
    {
      key: "duration", // reusing duration for estimated loss calculation
      label: "ESTIMATED LOSS (KWH)",
      render: (value) => {
        const loss = (Number(value) * 4).toFixed(1);
        return loss;
      },
    },
    {
      key: "actions",
      label: "ACTIONS",
      render: (value, row) => {
        const isReview = row.classification && row.classification.includes("NO MATCHING");
        return (
          <button
            type="button"
            className="md-action-button"
            onClick={() => handleTableAction(row)}
          >
            {isReview ? "Analyze" : "View Ref"}
          </button>
        );
      },
    },
  ];


  /*
  =======================================================
  RENDER
  =======================================================
  */

  return (
    <div className="meter-detail-page">

      {/* =================================================
          TOP BAR
      ================================================= */}

      <TopBar
        variant="report"
        showSearch={true}
        searchValue={
          topbarSearch
        }
        onSearchChange={
          handleTopbarSearch
        }
        onSearch={
          handleTopbarSearchSubmit
        }
      />


      {/* =================================================
          MAIN LAYOUT
      ================================================= */}

      <div className="md-layout">


        {/* =================================================
            SHARED SIDEBAR
        ================================================= */}

        <Sidebar />


        {/* =================================================
            CONTENT
        ================================================= */}

        <main className="md-content">


          {/* =================================================
              PAGE HEADER
          ================================================= */}

          <section className="md-page-header">

            <div>

              <p className="md-eyebrow">
                FULL REPORT
              </p>

              <h1>
                Overview
              </h1>

            </div>


            <button
              type="button"
              className="md-export-button"
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
              SELECTED METER
          ================================================= */}

          <section className="md-selected-meter">

            <div className="md-selected-meter-icon">
              ◉
            </div>

            <div className="md-selected-meter-text">

              <span>
                MSN {currentMeter.msn}
              </span>

              <span>
                • Ref. No. {currentMeter.ref}
              </span>

              <span>
                • {currentMeter.location}
              </span>

              <span className="md-feeder-box">
                {currentMeter.feeder || "Unassigned feeder"}
              </span>

            </div>

          </section>


          {/* =================================================
              SUMMARY CARDS
          ================================================= */}

          <section className="md-summary-grid">

            <div className="md-summary-card">

              <span className="md-summary-label">
                TOTAL GAPS
              </span>

              <strong>
                {summary.totalGaps}
              </strong>

              <span className="md-summary-icon blue">
                ▥
              </span>

            </div>


            <div className="md-summary-card review">

              <span className="md-summary-label">
                NEEDS REVIEW
              </span>

              <strong>
                {summary.needsReview}
              </strong>

              <span className="md-summary-icon red">
                △
              </span>

            </div>


            <div className="md-summary-card aligns">

              <span className="md-summary-label">
                ALIGNS WITH OUTAGE
              </span>

              <strong>
                {summary.aligns}
              </strong>

              <span className="md-summary-icon teal">
                ✓
              </span>

            </div>


            <div className="md-summary-card">

              <span className="md-summary-label">
                LONGEST GAP
              </span>

              <strong>
                {summary.longestGap}
                <small>
                  h
                </small>
              </strong>

              <span className="md-summary-icon gray">
                ◷
              </span>

            </div>


            <div className="md-summary-card">

              <span className="md-summary-label">
                PEAK LOAD
              </span>

              <strong>
                {(3.5 + currentMeter.gaps.length * 0.12).toFixed(1)}
                <small>
                  kW
                </small>
              </strong>

              <span className="md-summary-icon gray">
                ↗
              </span>

            </div>

          </section>


          {/* =================================================
              CHART GRID
          ================================================= */}

          <section className="md-chart-grid">


            {/* =================================================
                GAP EVENT TIMELINE
            ================================================= */}

            <div className="md-chart-card">

              <div className="md-chart-header">

                <div>

                  <span className="md-chart-eyebrow">
                    GAP EVENT TIMELINE
                  </span>

                  <h2>
                    Gap Event Timeline
                  </h2>

                </div>

                <div className="md-chart-legend">

                  <span>
                    <i className="legend-red" />
                    Unexplained
                  </span>

                  <span>
                    <i className="legend-teal" />
                    Outage
                  </span>

                </div>

              </div>


              <div className="md-timeline-chart">

                <div className="md-timeline-y">

                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>

                </div>


                <div className="md-timeline-area">

                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />


                  {timeline.map(
                    (
                      event,
                      index
                    ) => {

                      const row =
                        index % 5;

                      const width =
                        Math.max(
                          12,
                          Math.min(
                            32,
                            (
                              Number(
                                currentMeter
                                  .gaps[
                                    index %
                                      Math.max(
                                        currentMeter
                                          .gaps
                                          .length,
                                        1
                                      )
                                  ]
                                  ?.duration
                              ) || 2
                            ) * 2
                          )
                        );

                      return (
                        <span
                          key={
                            index
                          }
                          className={`md-timeline-bar ${event.type}`}
                          style={{
                            left: `${Math.min(
                              82,
                              Math.max(
                                3,
                                ((event.day - 1) /
                                  29) *
                                  90
                              )
                            )}%`,

                            top: `${row * 18 + 8}%`,

                            width: `${width}px`,
                          }}
                          title={`Day ${event.day}`}
                        />
                      );
                    }
                  )}

                </div>

              </div>


              <div className="md-timeline-axis">

                <span>Jul 1</span>
                <span>Jul 8</span>
                <span>Jul 15</span>
                <span>Jul 22</span>
                <span>Jul 30</span>

              </div>

            </div>


            {/* =================================================
                DAILY CONSUMPTION
            ================================================= */}

            <div className="md-chart-card">

              <div className="md-chart-header">

                <div>

                  <span className="md-chart-eyebrow">
                    DAILY CONSUMPTION
                  </span>

                  <h2>
                    Daily Consumption vs Baseline
                  </h2>

                </div>


                <div className="md-chart-legend">

                  <span>
                    <i className="legend-blue-line" />
                    Actual
                  </span>

                  <span>
                    <i className="legend-dashed" />
                    Baseline
                  </span>

                </div>

              </div>


              <div className="md-line-chart">

                <div className="md-line-y">

                  <span>10</span>
                  <span>7.5</span>
                  <span>5</span>
                  <span>2.5</span>
                  <span>0</span>

                </div>


                <div className="md-line-area">

                  {[0, 1, 2, 3].map(
                    (line) => (
                      <div
                        key={line}
                        className="md-line-grid"
                        style={{
                          top: `${line * 25}%`,
                        }}
                      />
                    )
                  )}


                  <svg
                    className="md-line-svg"
                    viewBox="0 0 700 220"
                    preserveAspectRatio="none"
                  >

                    <polyline
                      points={dailyConsumption
                        .map(
                          (
                            point,
                            index
                          ) => {

                            const x =
                              dailyConsumption.length ===
                              1
                                ? 350
                                : (index /
                                    (dailyConsumption.length -
                                      1)) *
                                  700;

                            const y =
                              220 -
                              (point.baseline /
                                10) *
                                220;

                            return `${x},${y}`;
                          }
                        )
                        .join(" ")}
                      fill="none"
                      className="md-baseline-line"
                    />


                    <polyline
                      points={dailyConsumption
                        .map(
                          (
                            point,
                            index
                          ) => {

                            const x =
                              dailyConsumption.length ===
                              1
                                ? 350
                                : (index /
                                    (dailyConsumption.length -
                                      1)) *
                                  700;

                            const y =
                              220 -
                              (point.actual /
                                10) *
                                220;

                            return `${x},${y}`;
                          }
                        )
                        .join(" ")}
                      fill="none"
                      className="md-actual-line"
                    />


                    {dailyConsumption.map(
                      (
                        point,
                        index
                      ) => {

                        const x =
                          dailyConsumption.length ===
                          1
                            ? 350
                            : (index /
                                (dailyConsumption.length -
                                  1)) *
                              700;

                        const y =
                          220 -
                          (point.actual /
                            10) *
                            220;

                        return (
                          <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="4"
                            className="md-actual-point"
                          />
                        );
                      }
                    )}

                  </svg>

                </div>

              </div>


              <div className="md-line-axis">

                {dailyConsumption.map(
                  (
                    point
                  ) => (
                    <span
                      key={
                        point.day
                      }
                    >
                      {point.day}
                    </span>
                  )
                )}

              </div>

            </div>

          </section>


          {/* =================================================
              REUSABLE TABLE — GAP RECORDS
          ================================================= */}

          <section className="md-table-card">
            <ReusableTable
              title={`Gap Records — ${currentMeter.msn}`}
              columns={gapColumns}
              data={allGaps}
              itemsPerPage={10}
              className="meter-detail-table"
            />
          </section>


          {/* =================================================
              FOOTER STATUS
          ================================================= */}

          <div className="md-demo-status">

            Showing live dummy data for MSN{" "}

            <strong>
              {currentMeter.msn}
            </strong>

            <span>
              •
            </span>

            {currentMeter.location}

            <span>
              •
            </span>

            Backend connection will be added later.

          </div>

        </main>

      </div>

    </div>
  );
}


export default MeterDetail;
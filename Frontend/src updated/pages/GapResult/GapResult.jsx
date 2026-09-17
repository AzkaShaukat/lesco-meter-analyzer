import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import {
  meters,
  getMeterByMSN,
  getMeterSummary,
  getDurationDistribution,
  getCoveragePoints,
  getTimeline,
} from "../../data/dummyData";

import "./GapResult.css";


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


const normalizeText = (value = "") =>
  String(value)
    .trim()
    .toLowerCase();


/*
=========================================================
FIND METER FROM SEARCH
Supports:
- MSN
- Feeder
=========================================================
*/

const findMeterFromSearch = (
  value = ""
) => {

  const query =
    normalizeText(value);

  if (!query) {
    return null;
  }


  /*
  -------------------------------------------------------
  FIRST: EXACT MSN SEARCH
  -------------------------------------------------------
  */

  const normalizedMSN =
    normalizeMSN(query);

  if (normalizedMSN) {

    const meterByMSN =
      getMeterByMSN(
        normalizedMSN
      );

    if (meterByMSN) {
      return meterByMSN;
    }
  }


  /*
  -------------------------------------------------------
  SECOND: FEEDER SEARCH
  -------------------------------------------------------
  */

  const feederMeter =
    meters.find(
      (meter) => {

        const feeder =
          normalizeText(
            meter.feeder
          );

        return (
          feeder &&
          (
            feeder === query ||
            feeder.includes(query) ||
            query.includes(feeder)
          )
        );
      }
    );


  if (feederMeter) {
    return feederMeter;
  }


  /*
  -------------------------------------------------------
  THIRD: GENERAL LOCATION / REF SEARCH
  -------------------------------------------------------
  */

  const generalMeter =
    meters.find(
      (meter) => {

        const searchableText = [
          meter.msn,
          meter.ref,
          meter.location,
          meter.feeder,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          query
        );
      }
    );


  return (
    generalMeter ||
    null
  );
};


/*
=========================================================
MAIN COMPONENT
=========================================================
*/

function GapResult() {

  const navigate =
    useNavigate();


  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();


  /*
  =======================================================
  URL MSN
  =======================================================
  */

  const urlMSN =
    normalizeMSN(
      searchParams.get(
        "msn"
      )
    );


  /*
  =======================================================
  INITIAL METER
  =======================================================
  */

  const initialMeter =
    getMeterByMSN(
      urlMSN
    ) ||
    DEFAULT_METER;


  /*
  =======================================================
  STATE
  =======================================================
  */

  const [
    selectedMSN,
    setSelectedMSN,
  ] = useState(
    initialMeter.msn
  );


  /*
  -------------------------------------------------------
  IMPORTANT:
  TOPBAR SEARCH STARTS EMPTY
  -------------------------------------------------------
  */

  const [
    topbarSearch,
    setTopbarSearch,
  ] = useState("");


  const [
    activeFilter,
    setActiveFilter,
  ] = useState(
    "All Severities"
  );


  const [
    timeFilter,
    setTimeFilter,
  ] = useState(
    "Time: Last 30 Days"
  );


  /*
  =======================================================
  URL CHANGE
  =======================================================
  */

  useEffect(() => {

    const meterFromURL =
      getMeterByMSN(
        normalizeMSN(
          searchParams.get(
            "msn"
          )
        )
      );


    if (meterFromURL) {

      setSelectedMSN(
        meterFromURL.msn
      );

      setActiveFilter(
        "All Severities"
      );

    }

  }, [
    searchParams,
  ]);


  /*
  =======================================================
  CURRENT METER
  =======================================================
  */

  const currentMeter =
    getMeterByMSN(
      selectedMSN
    ) ||
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
  CHART DATA
  =======================================================
  */

  const durationDistribution =
    getDurationDistribution(
      currentMeter
    );


  const coveragePoints =
    getCoveragePoints(
      currentMeter
    );


  const timeline =
    getTimeline(
      currentMeter
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


    setSearchParams({
      msn: meter.msn,
    });


    setActiveFilter(
      "All Severities"
    );


    localStorage.setItem(
      "lescoSelectedMeter",
      JSON.stringify(
        meter
      )
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

  const handleTopbarSearch = (
    value
  ) => {

    /*
    Keep exactly what user typed
    in the search bar.
    */

    setTopbarSearch(
      value
    );

  };


  /*
  =======================================================
  TOPBAR SEARCH / ENTER
  =======================================================
  */

  const handleTopbarSearchSubmit = (
    value
  ) => {

    const query =
      String(value || "")
        .trim();


    /*
    Empty search:
    do nothing.
    */

    if (!query) {
      return;
    }


    /*
    Find by:
    MSN
    Feeder
    Location
    Ref
    */

    const meter =
      findMeterFromSearch(
        query
      );


    /*
    If no matching dummy
    data exists, don't change
    current report.
    */

    if (!meter) {
      return;
    }


    /*
    Select the matching meter.
    */

    selectMeter(
      meter.msn
    );

  };


  /*
  =======================================================
  TOPBAR ENTER KEY
  =======================================================
  */

  const handleTopbarSearchKeyDown = (
    event
  ) => {

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
  FILTERED GAP DATA
  =======================================================
  */

  const filteredGaps =
    useMemo(() => {

      let rows = [
        ...(currentMeter.gaps || []),
      ];


      /*
      ---------------------------------------------------
      SEVERITY FILTER
      ---------------------------------------------------
      */

      if (
        activeFilter ===
        "Needs Review"
      ) {

        rows =
          rows.filter(
            (row) =>
              String(
                row.classification ||
                ""
              )
                .includes(
                  "NO MATCHING"
                )
          );

      }


      if (
        activeFilter ===
        "Outage Aligned"
      ) {

        rows =
          rows.filter(
            (row) =>
              String(
                row.classification ||
                ""
              )
                .includes(
                  "POWER OUTAGE"
                )
          );

      }


      /*
      ---------------------------------------------------
      TIME FILTER
      ---------------------------------------------------

      Dummy data currently represents
      the report period.

      Actual date filtering can be
      connected with backend later.
      */

      return rows;

    }, [
      currentMeter,
      activeFilter,
      timeFilter,
    ]);


  /*
  =======================================================
  NAVIGATION
  =======================================================
  */

  const handleDashboard = () => {
    navigate("/");
  };


  const handleReports = () => {
    navigate(
      "/full-report"
    );
  };


  /*
  =======================================================
  EXPORT
  =======================================================
  */

  const handleExport = () => {

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


    link.href =
      url;


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
  TABLE COLUMNS FOR REUSABLE TABLE
  =======================================================
  */

  const gapColumns = [
    { key: "start", label: "GAP START" },
    { key: "end", label: "GAP END" },
    {
      key: "duration",
      label: "DURATION",
      render: (value) => `${value} h`,
    },
    { key: "missing", label: "MISSING READINGS" },
    {
      key: "classification",
      label: "STATUS",
      render: (value) => {
        const isReview =
          value && value.includes("NO MATCHING");
        return (
          <span
            className={`md-status-badge ${
              isReview ? "review" : "outage"
            }`}
          >
            {isReview ? "Needs Review" : "Outage Aligned"}
          </span>
        );
      },
    },
    { key: "coverage", label: "COVERAGE IMPACT" },
  ];


  /*
  =======================================================
  RENDER
  =======================================================
  */

  return (

    <div className="meter-detail-page">


      {/* =================================================
          SHARED TOP BAR
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

        onSearchKeyDown={
          handleTopbarSearchKeyDown
        }

      />


      {/* =================================================
          MAIN LAYOUT
      ================================================= */}

      <div className="md-layout">


        {/* =================================================
            SHARED SIDEBAR — activeItem="Gap detection"
        ================================================= */}

        <Sidebar activeItem="Gap detection" />


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
                GAP DETECTION RESULTS
              </p>


              <h1>
                Gap detection results
              </h1>


              <p className="md-description">
                Identify and analyze communication gaps across
                the metering network. High-severity gaps are
                flagged for immediate grid integrity review.
              </p>

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
              FILTERS
          ================================================= */}

          <section className="md-filter-row">


            <select
              className="md-filter-select"
              value={
                activeFilter
              }
              onChange={(
                event
              ) =>
                setActiveFilter(
                  event.target.value
                )
              }
            >

              <option>
                All Severities
              </option>

              <option>
                Needs Review
              </option>

              <option>
                Outage Aligned
              </option>

            </select>


            <select
              className="md-filter-select"
              value={
                timeFilter
              }
              onChange={(
                event
              ) =>
                setTimeFilter(
                  event.target.value
                )
              }
            >

              <option>
                Time: Last 30 Days
              </option>

              <option>
                Last 7 Days
              </option>

              <option>
                Last 90 Days
              </option>

            </select>


          </section>


          {/* =================================================
              SELECTED FEEDER / METER
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


              <span>
                / {currentMeter.feeder || "Unassigned feeder"}
              </span>

            </div>

          </section>


          {/* =================================================
              SUMMARY
          ================================================= */}

          <section className="md-summary-grid">


            <div className="md-summary-card">

              <div className="md-summary-label">
                TOTAL GAPS
              </div>

              <div className="md-summary-value">
                {summary.totalGaps}
              </div>

              <span className="md-summary-icon blue">
                ▥
              </span>

            </div>


            <div className="md-summary-card review">

              <div className="md-summary-label">
                NEEDS REVIEW
              </div>

              <div className="md-summary-value">
                {summary.needsReview}
              </div>

              <span className="md-summary-icon red">
                △
              </span>

            </div>


            <div className="md-summary-card aligns">

              <div className="md-summary-label">
                ALIGNS
              </div>

              <div className="md-summary-value">
                {summary.aligns}
              </div>

              <span className="md-summary-icon teal">
                ✓
              </span>

            </div>


            <div className="md-summary-card">

              <div className="md-summary-label">
                LOW COVERAGE
              </div>

              <div className="md-summary-value">
                {summary.lowCoverage}
              </div>

              <span className="md-summary-icon gray">
                ◫
              </span>

            </div>


            <div className="md-summary-card">

              <div className="md-summary-label">
                LONGEST GAP
              </div>

              <div className="md-summary-value md-gap-value">

                {summary.longestGap}

                <small>
                  h
                </small>

              </div>

              <span className="md-summary-icon gray">
                ◷
              </span>

            </div>


          </section>


          {/* =================================================
              CHARTS
          ================================================= */}

          <section className="md-chart-grid">


            {/* =================================================
                GAP DURATION DISTRIBUTION
            ================================================= */}

            <div className="md-chart-card">

              <div className="md-chart-title">
                GAP DURATION DISTRIBUTION
              </div>


              <div className="md-chart-body bar-chart">

                <div className="md-y-lines">

                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>

                </div>


                <div className="md-bars">

                  {durationDistribution.map(
                    (
                      item
                    ) => (

                      <div
                        className="md-bar-column"
                        key={
                          item.label
                        }
                      >

                        <div className="md-bar-area">

                          <div
                            className="md-bar"
                            style={{
                              height:
                                `${Math.max(
                                  8,
                                  item.value *
                                    12 +
                                    8
                                )}px`,

                              background:
                                item.color,
                            }}
                          />

                        </div>


                        <span>
                          {item.label}
                        </span>

                      </div>

                    )
                  )}

                </div>

              </div>

            </div>


            {/* =================================================
                DURATION VS COVERAGE
            ================================================= */}

            <div className="md-chart-card">

              <div className="md-chart-title">
                DURATION VS COVERAGE
              </div>


              <div className="md-scatter-chart">

                <div className="md-scatter-y-label">
                  COVERAGE %
                </div>


                <div className="md-scatter-area">

                  <div className="scatter-grid-line line-1"></div>

                  <div className="scatter-grid-line line-2"></div>

                  <div className="scatter-grid-line line-3"></div>

                  <div className="scatter-grid-line line-4"></div>


                  {coveragePoints.map(
                    (
                      point,
                      index
                    ) => (

                      <span
                        key={
                          index
                        }
                        className={`md-scatter-point ${point.type}`}
                        style={{
                          left:
                            `${Math.min(
                              96,
                              point.x *
                                4.1
                            )}%`,

                          bottom:
                            `${point.y}%`,
                        }}
                        title={`${point.x}h / ${point.y}% coverage`}
                      />

                    )
                  )}


                  <span className="scatter-y-high">
                    100
                  </span>


                  <span className="scatter-y-mid">
                    50
                  </span>


                  <span className="scatter-y-low">
                    0
                  </span>


                </div>


                <div className="md-scatter-x-label">

                  <span>
                    0
                  </span>

                  <span>
                    10
                  </span>

                  <span>
                    20
                  </span>

                  <span>
                    30
                  </span>


                  <small>
                    DURATION (HOURS)
                  </small>

                </div>


                <div className="md-scatter-legend">

                  <span>

                    <i className="legend-blue"></i>

                    Aligned

                  </span>


                  <span>

                    <i className="legend-red"></i>

                    Critical

                  </span>

                </div>


              </div>

            </div>


          </section>


          {/* =================================================
              TIMELINE
          ================================================= */}

          <section className="md-timeline-card">

            <div className="md-chart-title">
              GAP EVENT TIMELINE (LAST 30 DAYS)
            </div>


            <div className="md-timeline">

              <div className="md-timeline-labels">

                <span>
                  Jul 1
                </span>

                <span>
                  Jul 15
                </span>

                <span>
                  Jul 30
                </span>

              </div>


              <div className="md-timeline-track">

                {timeline.map(
                  (
                    event,
                    index
                  ) => (

                    <div
                      key={
                        index
                      }
                      className={`md-timeline-event ${event.type}`}
                      style={{
                        left:
                          `${Math.max(
                            0,
                            Math.min(
                              100,
                              (
                                (
                                  event.day -
                                  1
                                ) /
                                29
                              ) *
                                100
                            )
                          )}%`,
                      }}
                      title={`Day ${event.day}: ${event.type}`}
                    />

                  )
                )}

              </div>


              <div className="md-timeline-legend">

                <span>

                  <i className="timeline-blue"></i>

                  Aligned Gap

                </span>


                <span>

                  <i className="timeline-red"></i>

                  Needs Review

                </span>


                <span>

                  <i className="timeline-orange"></i>

                  Power Event

                </span>

              </div>


            </div>

          </section>


          {/* =================================================
              REUSABLE TABLE — GAP EVENTS
          ================================================= */}

          <section className="md-table-card">
            <ReusableTable
              title={`Gap Events — ${currentMeter.msn}`}
              columns={gapColumns}
              data={filteredGaps}
              itemsPerPage={10}
              className="gap-result-table"
            />
          </section>


          {/* =================================================
              STATUS
          ================================================= */}

          <div
            className="md-demo-status"
          >

            Demo data active

            <span>
              •
            </span>

            Selected meter:

            <strong>
              {currentMeter.msn}
            </strong>

            <span>
              •
            </span>

            Feeder:

            <strong>
              {currentMeter.feeder ||
                "Unassigned feeder"}
            </strong>

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


export default GapResult;
import "./PeakLoad.css";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import { getMeterByMSN, meters } from "../../data/dummyData";

const normalizeMSN = (value = "") =>
  String(value).replace(/\D/g, "").trim();

const getMeterMSN = (meter) =>
  String(
    meter?.msn ||
      meter?.MSN ||
      meter?.meterNo ||
      meter?.meterNumber ||
      ""
  );

const getMeterRef = (meter) =>
  String(
    meter?.ref ||
      meter?.refNo ||
      meter?.reference ||
      meter?.referenceNo ||
      "LK-04821"
  );

/* =========================================================
   DUMMY FLEET DATA
========================================================= */

const DUMMY_METERS = [
  {
    msn: "3799210412",
    ref: "LK-04821",
    location: "Ferozewala",
    feeder: "Ferozewala-3",
  },
  {
    msn: "3799210884",
    ref: "LK-09122",
    location: "Lahore",
    feeder: "Lahore-12",
  },
  {
    msn: "3799210901",
    ref: "LK-10294",
    location: "Lahore",
    feeder: "Lahore-08",
  },
  {
    msn: "3799211045",
    ref: "LK-11005",
    location: "Kasur",
    feeder: "Kasur-4",
  },
  {
    msn: "3799211222",
    ref: "LK-12440",
    location: "Sheikhupura",
    feeder: "Sheikhupura-2",
  },
  {
    msn: "3799211338",
    ref: "LK-13118",
    location: "Nankana",
    feeder: "Nankana-1",
  },
  {
    msn: "3799211456",
    ref: "LK-14561",
    location: "Lahore",
    feeder: "Lahore-19",
  },
  {
    msn: "3799211579",
    ref: "LK-15790",
    location: "Faisal Town",
    feeder: "Faisal-6",
  },
];

const BASE_FLEET_ROWS = [
  {
    msn: "3799210412",
    ref: "LK-04821",
    date: "Oct 24, 2023",
    peak: 12.84,
    time: "18:45",
    mf: 1.0,
  },
  {
    msn: "3799210884",
    ref: "LK-09122",
    date: "Oct 24, 2023",
    peak: 8.42,
    time: "19:15",
    mf: 1.0,
  },
  {
    msn: "3799210901",
    ref: "LK-10294",
    date: "Oct 24, 2023",
    peak: 4.12,
    time: "14:30",
    mf: 1.0,
  },
  {
    msn: "3799211045",
    ref: "LK-11005",
    date: "Oct 24, 2023",
    peak: 3.85,
    time: "08:15",
    mf: 1.0,
  },
  {
    msn: "3799211222",
    ref: "LK-12440",
    date: "Oct 24, 2023",
    peak: 2.98,
    time: "21:00",
    mf: 1.0,
  },
  {
    msn: "3799211338",
    ref: "LK-13118",
    date: "Oct 23, 2023",
    peak: 7.46,
    time: "17:30",
    mf: 1.0,
  },
  {
    msn: "3799211456",
    ref: "LK-14561",
    date: "Oct 23, 2023",
    peak: 5.72,
    time: "18:10",
    mf: 1.0,
  },
  {
    msn: "3799211579",
    ref: "LK-15790",
    date: "Oct 22, 2023",
    peak: 6.18,
    time: "12:45",
    mf: 1.0,
  },
];

/* =========================================================
   FLEET TABLE DATA
========================================================= */

const ALL_METER_PEAK_ROWS = Array.from(
  { length: 1204 },
  (_, index) => {
    const base =
      BASE_FLEET_ROWS[
        index % BASE_FLEET_ROWS.length
      ];

    const day = 1 + (index % 31);

    const peak = Number(
      (
        base.peak +
        ((index % 7) - 3) * 0.18
      ).toFixed(2)
    );

    return {
      ...base,
      id: index + 1,
      date: `Oct ${String(day).padStart(
        2,
        "0"
      )}, 2023`,
      peak: Math.max(1.2, peak),
      time: base.time,
    };
  }
);

/* =========================================================
   CHART DATA
========================================================= */

const WEEKLY_PEAK = [
  {
    label: "Week 1",
    value: 7.2,
  },
  {
    label: "Week 2",
    value: 8.5,
  },
  {
    label: "Week 3",
    value: 11.1,
  },
  {
    label: "Week 4",
    value: 12.84,
  },
];

const SCALE_POINTS = [
  { x: 4, y: 4.2 },
  { x: 8, y: 4.0 },
  { x: 24, y: 5.0 },
  { x: 80, y: 3.2 },
  { x: 280, y: 4.3 },
  { x: 900, y: 4.8 },
  { x: 1000, y: 4.1, hot: true },
];

const DAILY_PEAKS = [
  {
    label: "Oct 1",
    value: 3.8,
  },
  {
    label: "Oct 5",
    value: 4.2,
  },
  {
    label: "Oct 10",
    value: 2.9,
  },
  {
    label: "Oct 15",
    value: 8.1,
    suspicious: true,
  },
  {
    label: "Oct 20",
    value: 5.7,
  },
  {
    label: "Oct 25",
    value: 5.2,
  },
  {
    label: "Oct 28",
    value: 7.5,
    suspicious: true,
  },
  {
    label: "Oct 31",
    value: 4.2,
  },
];

const makeMeterDailyRows = (msn) =>
  Array.from(
    { length: 31 },
    (_, index) => {
      const day = 31 - index;

      const pattern = [
        4.12,
        8.42,
        5.01,
        4.88,
        5.35,
        4.62,
        7.42,
        12.84,
        5.74,
        4.91,
        5.28,
      ];

      const peak = Number(
        (
          pattern[
            index % pattern.length
          ] +
          ((index % 3) - 1) * 0.12
        ).toFixed(2)
      );

      return {
        id: `${msn}-${day}`,
        date: `2023-10-${String(
          day
        ).padStart(2, "0")}`,
        peak: Math.max(1.1, peak),
        time: [
          "19:15",
          "18:45",
          "20:30",
          "17:00",
          "18:20",
          "16:45",
          "18:10",
        ][index % 7],
      };
    }
  );

/* =========================================================
   FIND METER
========================================================= */

function findMeter(msn) {
  const normalized =
    normalizeMSN(msn);

  const fromDummy =
    DUMMY_METERS.find(
      (meter) =>
        normalizeMSN(
          meter.msn
        ) === normalized
    );

  if (fromDummy) {
    return fromDummy;
  }

  const fromExistingData =
    getMeterByMSN(normalized);

  if (fromExistingData) {
    return fromExistingData;
  }

  return (
    meters?.find(
      (meter) =>
        normalizeMSN(
          getMeterMSN(meter)
        ) === normalized
    ) || null
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function PeakLoad() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const urlMSN = normalizeMSN(
    searchParams.get("msn")
  );

  const [
    topbarSearch,
    setTopbarSearch,
  ] = useState("");

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    allFilter,
    setAllFilter,
  ] = useState(false);

  const [
    meterFilter,
    setMeterFilter,
  ] = useState(false);

  /* =========================================================
     SELECTED METER
  ========================================================= */

  const selectedMeter =
    useMemo(
      () =>
        urlMSN
          ? findMeter(urlMSN)
          : null,
      [urlMSN]
    );

  /* =========================================================
     URL CHANGE
  ========================================================= */

  useEffect(() => {
    setTopbarSearch(
      urlMSN || ""
    );

    setSearchError("");
  }, [urlMSN]);

  /* =========================================================
     FLEET ROWS
  ========================================================= */

  const allRows =
    useMemo(
      () =>
        allFilter
          ? ALL_METER_PEAK_ROWS.filter(
              (row) =>
                row.peak >= 7
            )
          : ALL_METER_PEAK_ROWS,
      [allFilter]
    );

  /* =========================================================
     METER ROWS
  ========================================================= */

  const meterRows =
    useMemo(() => {
      if (!selectedMeter) {
        return [];
      }

      const rows =
        makeMeterDailyRows(
          getMeterMSN(
            selectedMeter
          )
        );

      return meterFilter
        ? rows.filter(
            (row) =>
              row.peak >= 7
          )
        : rows;
    }, [
      selectedMeter,
      meterFilter,
    ]);

  /* =========================================================
     TOPBAR SEARCH
  ========================================================= */

  const handleTopbarSearchChange =
    (value) => {
      setTopbarSearch(value);
      setSearchError("");
    };

  const handleTopbarSearch =
    () => {
      const msn =
        normalizeMSN(
          topbarSearch
        );

      if (!msn) {
        setSearchError(
          "Enter an MSN first."
        );
        return;
      }

      const meter =
        findMeter(msn);

      if (!meter) {
        setSearchError(
          "Meter not found. Try 3799210412 or another dummy MSN."
        );
        return;
      }

      setSearchError("");

      localStorage.setItem(
        "lescoSelectedMeter",
        JSON.stringify(meter)
      );

      localStorage.setItem(
        "lescoSelectedMSN",
        msn
      );

      setSearchParams({
        msn,
      });
    };

  /* =========================================================
     NEW ANALYSIS / CLEAR
  ========================================================= */

  const handleClearMeter =
    () => {
      localStorage.removeItem(
        "lescoSelectedMeter"
      );

      localStorage.removeItem(
        "lescoSelectedMSN"
      );

      setTopbarSearch("");
      setSearchError("");

      setSearchParams({});
    };

  /* =========================================================
     NAVIGATE TO METER (for clickable MSN)
  ========================================================= */

  const navigateToMeter = (msn) => {
    const normalized = normalizeMSN(msn);
    if (!normalized) return;

    const meter = findMeter(normalized);
    if (!meter) return;

    setTopbarSearch(normalized);
    setSearchError("");

    localStorage.setItem(
      "lescoSelectedMeter",
      JSON.stringify(meter)
    );
    localStorage.setItem(
      "lescoSelectedMSN",
      normalized
    );

    setSearchParams({ msn: normalized });
  };

  /* =========================================================
     EXPORT
  ========================================================= */

  const handleExport =
    () => {
      const rows =
        selectedMeter
          ? meterRows
          : allRows;

      const csvRows = [
        selectedMeter
          ? [
              "DATE",
              "PEAK LOAD (KW)",
              "TIME OF PEAK",
            ]
          : [
              "#",
              "MSN",
              "REF. NO.",
              "DATE",
              "PEAK LOAD (KW)",
              "TIME OF PEAK",
              "MF SCALE",
            ],

        ...rows.map(
          (
            row,
            index
          ) =>
            selectedMeter
              ? [
                  row.date,
                  row.peak.toFixed(
                    2
                  ),
                  row.time,
                ]
              : [
                  index + 1,
                  row.msn,
                  row.ref,
                  row.date,
                  row.peak.toFixed(
                    2
                  ),
                  row.time,
                  row.mf,
                ]
        ),
      ];

      const csv =
        csvRows
          .map(
            (row) =>
              row
                .map(
                  (value) =>
                    `"${String(
                      value ?? ""
                    ).replace(
                      /"/g,
                      '""'
                    )}"`
                )
                .join(",")
          )
          .join("\n");

      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;",
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
        selectedMeter
          ? `peak-load-${getMeterMSN(
              selectedMeter
            )}.csv`
          : "peak-load-report.csv";

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

  /* =========================================================
     KPI VALUES
  ========================================================= */

  const fleetPeakValues =
    BASE_FLEET_ROWS.map(
      (row) => row.peak
    );

  const fleetHighest =
    Math.max(
      ...fleetPeakValues
    );

  const fleetAverage =
    fleetPeakValues.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
    fleetPeakValues.length;

  const fleetLoadFactor =
    0.7;

  const meterPeakValues =
    meterRows.map(
      (row) => row.peak
    );

  const meterMaxPeak =
    meterPeakValues.length
      ? Math.max(
          ...meterPeakValues
        )
      : 0;

  const meterAveragePeak =
    meterPeakValues.length
      ? meterPeakValues.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        meterPeakValues.length
      : 0;

  const meterLoadFactor =
    meterMaxPeak > 0
      ? Math.min(
          0.99,
          meterAveragePeak /
            meterMaxPeak
        )
      : 0;

  /* =========================================================
     TABLE COLUMNS — FLEET (no eye icon)
  ========================================================= */

  const fleetColumns = [
    {
      key: "id",
      label: "#",
      render: (value, row, index) => index + 1,
    },
    {
      key: "msn",
      label: "MSN",
      render: (value) => (
        <button
          type="button"
          className="pl-msn-link"
          onClick={() => navigateToMeter(value)}
        >
          {value}
        </button>
      ),
    },
    { key: "ref", label: "Ref. No." },
    { key: "date", label: "Date" },
    {
      key: "peak",
      label: "Peak Load (kW)",
      render: (value) => (
        <span className="right peak-value">
          {value.toFixed(2)} <small>kW</small>
        </span>
      ),
    },
    { key: "time", label: "Time of Peak" },
  ];

  /* =========================================================
     TABLE COLUMNS — METER
  ========================================================= */

  const meterColumns = [
    { key: "date", label: "Date" },
    {
      key: "peak",
      label: "Peak Load (kW)",
      render: (value) => (
        <span className="right peak-value">
          {value.toFixed(2)} <small>kW</small>
        </span>
      ),
    },
    { key: "time", label: "Time of Peak" },
  ];

  /* =========================================================
     WEEKLY CHART
  ========================================================= */

  const weeklyPoints =
    WEEKLY_PEAK.map(
      (
        point,
        index
      ) => {
        const x =
          10 +
          (index /
            (WEEKLY_PEAK.length -
              1)) *
            90;

        const y =
          92 -
          (point.value /
            14) *
            72;

        return `${x},${y}`;
      }
    ).join(" ");

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="peak-load-page">

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={
          handleTopbarSearchChange
        }
        onSearch={
          handleTopbarSearch
        }
      />

      <div className="pl-layout">

        {/* ===================================================
            SIDEBAR — activeItem="Peak Load"
        =================================================== */}

        <Sidebar activeItem="Peak Load" />

        {/* ===================================================
            MAIN
        =================================================== */}

        <main className="pl-content">

          {/* =================================================
              PAGE HEADER + ACTIONS
          ================================================= */}

          <header className="pl-page-header">

            <div className="pl-page-heading">

              <h1>
                Peak Load
                {selectedMeter
                  ? ` - ${getMeterMSN(
                      selectedMeter
                    )}`
                  : " - LESCO MDM"}
              </h1>

              <p>
                Peak demand across load
                profiles and daily reads.
              </p>

            </div>

            <div className="pl-heading-actions">

              <button
                type="button"
                className="pl-export-button"
                onClick={
                  handleExport
                }
              >
                ⇩ Export Report
              </button>

            </div>

          </header>

          {/* =================================================
              SELECTED METER PILL
          ================================================= */}

          {selectedMeter && (
            <div className="pl-meter-pill">

              Meter{" "}
              {getMeterMSN(
                selectedMeter
              )}

              <button
                type="button"
                onClick={
                  handleClearMeter
                }
                aria-label="Clear selected meter"
              >
                ×
              </button>

            </div>
          )}

          {/* =================================================
              SEARCH ERROR
          ================================================= */}

          {searchError && (
            <div className="pl-search-error">
              {searchError}
            </div>
          )}

          {/* =================================================
              STATE A — FLEET
          ================================================= */}

          {!selectedMeter ? (
            <>
              <section className="pl-kpi-grid pl-fleet-kpis">

                <div className="pl-kpi-card">
                  <span>
                    HIGHEST PEAK LOAD
                  </span>

                  <strong>
                    {fleetHighest.toFixed(
                      2
                    )}
                    <small>
                      {" "}
                      kW
                    </small>
                  </strong>

                  <em>
                    ⚡ Max recorded across
                    fleet
                  </em>
                </div>

                <div className="pl-kpi-card">
                  <span>
                    AVERAGE PEAK LOAD
                  </span>

                  <strong>
                    {fleetAverage.toFixed(
                      2
                    )}
                    <small>
                      {" "}
                      kW
                    </small>
                  </strong>

                  <em>
                    ↗ Mean demand per
                    meter
                  </em>
                </div>

                <div className="pl-kpi-card">
                  <span>
                    METERS ANALYZED
                  </span>

                  <strong>
                    {DUMMY_METERS.length}
                  </strong>

                  <em>
                    Active in current
                    period
                  </em>
                </div>

                <div className="pl-kpi-card">
                  <span>
                    DAILY READINGS
                  </span>

                  <strong>
                    23.8
                    <small>
                      {" "}
                      k
                    </small>
                  </strong>

                  <em>
                    Total data points
                    processed
                  </em>
                </div>

              </section>

              {/* FLEET CHARTS */}

              <section className="pl-state-a-chart-grid">

                <div className="pl-card pl-clock-card fleet-clock-card">

                  <h2>
                    When Peaks Happen
                  </h2>

                  <p>
                    Time of day matters
                    for peak demand.
                  </p>

                  <div className="pl-clock">

                    <span className="clock-top">
                      12 AM
                    </span>

                    <span className="clock-right">
                      6 AM
                    </span>

                    <span className="clock-bottom">
                      12 PM
                    </span>

                    <span className="clock-left">
                      6 PM
                    </span>

                    <i className="clock-dot dot-one" />
                    <i className="clock-dot dot-two" />
                    <i className="clock-dot dot-three" />
                    <i className="clock-dot dot-four" />

                    <div className="clock-inner">
                      ◷
                    </div>

                  </div>

                </div>

                <div className="pl-card pl-scale-card">

                  <h2>
                    Peak Load vs Scale
                    Correction
                  </h2>

                  <p>
                    Do heavily-scaled
                    meters carry the
                    biggest loads?
                  </p>

                  <div className="pl-scatter">

                    <span className="scatter-y">
                      Peak
                    </span>

                    <div className="scatter-grid">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>

                    {SCALE_POINTS.map(
                      (
                        point,
                        index
                      ) => (
                        <b
                          key={index}
                          className={
                            point.hot
                              ? "hot"
                              : ""
                          }
                          style={{
                            left: `${
                              10 +
                              (Math.log10(
                                point.x
                              ) /
                                3) *
                                80
                            }%`,
                            bottom: `${
                              20 +
                              point.y *
                                8
                            }%`,
                          }}
                        />
                      )
                    )}

                    <div className="scatter-x">
                      <span>1</span>
                      <span>10</span>
                      <span>100</span>
                      <span>1000</span>
                    </div>

                  </div>

                </div>

                <div className="pl-card pl-weekly-card">

                  <h2>
                    Weekly Peak
                    Consumption
                  </h2>

                  <p>
                    Peak consumption
                    by week (kWh).
                  </p>

                  <div className="pl-line-chart">

                    <div className="pl-y-labels">
                      <span>14k</span>
                      <span>10k</span>
                      <span>6k</span>
                      <span>2k</span>
                      <span>0</span>
                    </div>

                    <div className="pl-line-area">

                      {[
                        "5%",
                        "30%",
                        "55%",
                        "80%",
                      ].map(
                        (top) => (
                          <div
                            className="pl-grid-line"
                            key={top}
                            style={{
                              top,
                            }}
                          />
                        )
                      )}

                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >

                        <polyline
                          points={
                            weeklyPoints
                          }
                          fill="none"
                          className="pl-weekly-line"
                        />

                        {WEEKLY_PEAK.map(
                          (
                            point,
                            index
                          ) => {
                            const x =
                              10 +
                              (index /
                                3) *
                                90;

                            const y =
                              92 -
                              (point.value /
                                14) *
                                72;

                            return (
                              <circle
                                key={
                                  point.label
                                }
                                cx={x}
                                cy={y}
                                r="1.8"
                                className="pl-line-point"
                              />
                            );
                          }
                        )}

                      </svg>

                    </div>

                  </div>

                  <div className="pl-axis-labels">
                    {WEEKLY_PEAK.map(
                      (point) => (
                        <span
                          key={
                            point.label
                          }
                        >
                          {
                            point.label
                          }
                        </span>
                      )
                    )}
                  </div>

                </div>

                <div className="pl-card pl-gauge-card">

                  <h2>
                    Fleet Load Factor
                  </h2>

                  <p>
                    Average
                    peak-to-demand
                    ratio.
                  </p>

                  <div className="pl-gauge">

                    <div className="pl-gauge-arc" />

                    <div className="pl-gauge-needle fleet-needle" />

                    <div className="pl-gauge-center" />

                    <strong>
                      {fleetLoadFactor.toFixed(
                        1
                      )}
                    </strong>

                    <span>
                      MODERATE
                    </span>

                  </div>

                </div>

              </section>

              {/* FLEET TABLE — ReusableTable (no eye icon) */}

              <section className="pl-card pl-table-card">
                <ReusableTable
                  title="Daily Peak Load Detail"
                  columns={fleetColumns}
                  data={allRows}
                  itemsPerPage={5}
                  className="peak-load-fleet-table"
                />
              </section>
            </>
          ) : (
            /* =================================================
               STATE B — SELECTED METER
            ================================================= */

            <>
              <section className="pl-kpi-grid">

                <div className="pl-kpi-card">

                  <span>
                    PEAK LOAD
                  </span>

                  <strong>
                    {meterMaxPeak.toFixed(
                      2
                    )}
                    <small>
                      {" "}
                      kW
                    </small>
                  </strong>

                  <em>
                    ⚡ Max recorded
                  </em>

                </div>

                <div className="pl-kpi-card">

                  <span>
                    AVERAGE PEAK LOAD
                  </span>

                  <strong>
                    {meterAveragePeak.toFixed(
                      2
                    )}
                    <small>
                      {" "}
                      kW
                    </small>
                  </strong>

                  <em>
                    Mean demand for
                    meter
                  </em>

                </div>

                <div className="pl-kpi-card">

                  <span>
                    LOAD FACTOR
                  </span>

                  <strong>
                    {meterLoadFactor.toFixed(
                      2
                    )}
                  </strong>

                  <em>
                    Average
                    peak-to-demand
                    ratio
                  </em>

                </div>

                <div className="pl-kpi-card">

                  <span>
                    DAYS ANALYZED
                  </span>

                  <strong>
                    31
                  </strong>

                  <em>
                    Daily records
                    available
                  </em>

                </div>

              </section>

              <section className="pl-state-b-chart-grid">

                <div className="pl-card pl-daily-card">

                  <h2>
                    Daily Peak Load
                  </h2>

                  <p>
                    Peak demand
                    recorded for this
                    meter.
                  </p>

                  <div className="pl-bar-chart">

                    <div className="pl-bar-y-labels">
                      <span>10k</span>
                      <span>8k</span>
                      <span>6k</span>
                      <span>4k</span>
                      <span>2k</span>
                      <span>0</span>
                    </div>

                    <div className="pl-bars-area">

                      {[
                        0,
                        20,
                        40,
                        60,
                        80,
                      ].map(
                        (bottom) => (
                          <div
                            key={
                              bottom
                            }
                            className="pl-bar-grid"
                            style={{
                              bottom: `${bottom}%`,
                            }}
                          />
                        )
                      )}

                      {DAILY_PEAKS.map(
                        (item) => (
                          <div
                            className="pl-bar-column"
                            key={
                              item.label
                            }
                          >
                            <div
                              className={`pl-bar ${
                                item.suspicious
                                  ? "suspicious"
                                  : ""
                              }`}
                              style={{
                                height: `${Math.min(
                                  100,
                                  (item.value /
                                    10) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        )
                      )}

                    </div>

                  </div>

                  <div className="pl-bar-axis">

                    {DAILY_PEAKS.map(
                      (item) => (
                        <span
                          key={
                            item.label
                          }
                        >
                          {
                            item.label
                          }
                        </span>
                      )
                    )}

                  </div>

                </div>

                <div className="pl-card pl-clock-card">

                  <h2>
                    When Peaks Happen
                  </h2>

                  <p>
                    Time of day for
                    this meter's peak
                    demand.
                  </p>

                  <div className="pl-clock">

                    <span className="clock-top">
                      0
                    </span>

                    <span className="clock-right">
                      6
                    </span>

                    <span className="clock-bottom">
                      12
                    </span>

                    <span className="clock-left">
                      18
                    </span>

                    <i className="clock-dot dot-one" />
                    <i className="clock-dot dot-two" />
                    <i className="clock-dot dot-three" />

                    <div className="clock-inner">
                      ◷
                    </div>

                  </div>

                </div>

              </section>

              {/* METER TABLE — ReusableTable */}

              <section className="pl-card pl-table-card">
                <ReusableTable
                  title={`Daily Peak Load Detail — ${getMeterMSN(selectedMeter)}`}
                  columns={meterColumns}
                  data={meterRows}
                  itemsPerPage={4}
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
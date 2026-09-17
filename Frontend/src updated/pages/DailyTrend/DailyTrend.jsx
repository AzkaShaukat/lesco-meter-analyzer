import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import {
  meters,
  getMeterByMSN,
} from "../../data/dummyData";

import "./DailyTrend.css";

/* =========================================================
HELPERS
========================================================= */

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
      "24118252..."
  );

/* =========================================================
DAILY TREND DATA
========================================================= */

const TREND_DAYS = [
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
  "2026-07-13",
];

const BASE_CONSUMPTION = [
  10.52,
  11.2,
  8.43,
  9.76,
  10.92,
  8.84,
  11.36,
];

const ACTUAL_VARIATIONS = [
  0.0,
  1.2,
  -1.7,
  -0.8,
  1.48,
  -2.12,
  0.55,
];

/* =========================================================
BUILD DAILY ROWS
========================================================= */

const buildDailyRowsForMeter = (meter, meterIndex = 0) => {
  if (!meter) {
    return [];
  }

  const msn = getMeterMSN(meter);
  const ref = getMeterRef(meter);

  const gaps = meter.gaps || [];

  const gapInfluence =
    gaps.length > 0
      ? gaps.length * 0.08
      : 0;

  return TREND_DAYS.map(
    (date, dayIndex) => {
      const variation =
        ACTUAL_VARIATIONS[
          (dayIndex + meterIndex) %
            ACTUAL_VARIATIONS.length
        ];

      const baseline =
        BASE_CONSUMPTION[
          dayIndex %
            BASE_CONSUMPTION.length
        ] + gapInfluence;

      let consumption =
        baseline + variation;

      consumption +=
        (meterIndex % 5) * 0.16;

      const suspicious =
        consumption <
        baseline * 0.82;

      const gapSuspicion =
        gaps.length >= 4 &&
        dayIndex % 3 === 0;

      const isSuspicious =
        suspicious || gapSuspicion;

      let flag = "NORMAL";

      if (isSuspicious) {
        if (consumption < 0) {
          flag = "NEGATIVE CONSUMPTION";
        } else {
          flag = "SUSPICIOUS LOW";
        }
      }

      if (
        !isSuspicious &&
        dayIndex === 6 &&
        meterIndex % 4 === 0
      ) {
        flag = "INSUFFICIENT DATA";
      }

      return {
        id: `${msn}-${date}-${dayIndex}`,
        msn,
        ref,
        date,

        consumption: Number(
          Math.max(
            -2.4,
            consumption
          ).toFixed(1)
        ),

        baseline: Number(
          baseline.toFixed(2)
        ),

        deviation: Number(
          (
            ((consumption - baseline) /
              baseline) *
            100
          ).toFixed(1)
        ),

        flag,
        suspicious: isSuspicious,
      };
    }
  );
};

/* =========================================================
CREATE ALL FLEET DATA
========================================================= */

const buildAllTrendRows = () => {
  const sourceMeters =
    Array.isArray(meters)
      ? meters
      : [];

  let rows = [];

  sourceMeters.forEach(
    (meter, meterIndex) => {
      rows.push(
        ...buildDailyRowsForMeter(
          meter,
          meterIndex
        )
      );
    }
  );

  return rows;
};

/* =========================================================
FLEET CHART DATA
========================================================= */

const getFleetAverageData = (
  allRows
) => {
  return TREND_DAYS.map(
    (date) => {
      const rows =
        allRows.filter(
          (row) =>
            row.date === date
        );

      if (!rows.length) {
        return {
          date,
          actual: 0,
          baseline: 0,
          suspicious: 0,
        };
      }

      const actual =
        rows.reduce(
          (sum, row) =>
            sum + row.consumption,
          0
        ) / rows.length;

      const baseline =
        rows.reduce(
          (sum, row) =>
            sum + row.baseline,
          0
        ) / rows.length;

      const suspicious =
        rows.filter(
          (row) =>
            row.suspicious
        ).length;

      return {
        date,

        actual: Number(
          actual.toFixed(2)
        ),

        baseline: Number(
          baseline.toFixed(2)
        ),

        suspicious,
      };
    }
  );
};

/* =========================================================
MAIN COMPONENT
========================================================= */

function DailyTrend() {
  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  /* =======================================================
  URL MSN
  ======================================================= */

  const urlMSN =
    normalizeMSN(
      searchParams.get("msn")
    );

  /* =======================================================
  TOPBAR SEARCH
  ======================================================= */

  const [
    topbarSearch,
    setTopbarSearch,
  ] = useState("");

  /* =======================================================
  SELECTED METER
  ======================================================= */

  const initialMeter =
    useMemo(() => {
      if (urlMSN) {
        const meter =
          getMeterByMSN(
            urlMSN
          );

        if (meter) {
          return meter;
        }
      }

      return null;
    }, [urlMSN]);

  const [
    selectedMeter,
    setSelectedMeter,
  ] = useState(
    initialMeter
  );

  /* =======================================================
  KEEP URL METER IN SYNC
  ======================================================= */

  React.useEffect(() => {
    if (!urlMSN) {
      setSelectedMeter(null);
      return;
    }

    const meter = getMeterByMSN(
      urlMSN
    );

    if (meter) {
      setSelectedMeter(
        meter
      );
    }
  }, [urlMSN]);

  /* =======================================================
  ALL DAILY ROWS
  ======================================================= */

  const allRows = useMemo(
    () =>
      buildAllTrendRows(),
    []
  );

  /* =======================================================
  OPEN DAILY RESULT
  ======================================================= */

  const openDailyResult =
    (meterOrMSN) => {
      let meter = null;

      if (
        typeof meterOrMSN ===
        "object"
      ) {
        meter =
          meterOrMSN;
      }

      if (!meter) {
        const normalized =
          normalizeMSN(
            meterOrMSN
          );

        if (!normalized) {
          return;
        }

        meter =
          getMeterByMSN(
            normalized
          );
      }

      if (!meter) {
        return;
      }

      const msn =
        normalizeMSN(
          getMeterMSN(
            meter
          )
        );

      if (!msn) {
        return;
      }

      setSelectedMeter(
        meter
      );

      localStorage.setItem(
        "lescoSelectedMeter",
        JSON.stringify(
          meter
        )
      );

      localStorage.setItem(
        "lescoSelectedMSN",
        msn
      );

      setSearchParams({
        msn,
      });

      navigate(
        `/daily-result?msn=${encodeURIComponent(
          msn
        )}`
      );
    };

  /* =======================================================
  TOPBAR SEARCH
  ======================================================= */

  const handleTopbarSearch =
    () => {
      const normalized =
        normalizeMSN(
          topbarSearch
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

      openDailyResult(
        meter
      );
    };

  /* =======================================================
  SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const sourceRows =
        allRows;

      const uniqueMeters =
        new Set(
          sourceRows.map(
            (row) =>
              row.msn
          )
        ).size;

      const suspiciousDays =
        sourceRows.filter(
          (row) =>
            row.suspicious
        ).length;

      const insufficient =
        sourceRows.filter(
          (row) =>
            row.flag ===
            "INSUFFICIENT DATA"
        ).length;

      const normalDays =
        Math.max(
          0,
          sourceRows.length -
            suspiciousDays -
            insufficient
        );

      return {
        suspiciousDays,
        uniqueMeters,
        normalDays,
        insufficient,
      };
    }, [allRows]);

  /* =======================================================
  FLEET CHART
  ======================================================= */

  const fleetData =
    useMemo(
      () =>
        getFleetAverageData(
          allRows
        ),
      [allRows]
    );

  /* =======================================================
  SUSPICIOUS METERS
  ======================================================= */

  const suspiciousMeters =
    useMemo(() => {
      const meterMap =
        new Map();

      allRows.forEach(
        (row) => {
          if (!row.suspicious) {
            return;
          }

          const previous =
            meterMap.get(
              row.msn
            ) || {
              msn: row.msn,
              count: 0,
            };

          previous.count += 1;

          meterMap.set(
            row.msn,
            previous
          );
        }
      );

      return Array.from(
        meterMap.values()
      )
        .sort(
          (a, b) =>
            b.count -
            a.count
        )
        .slice(0, 5);
    }, [allRows]);

  /* =======================================================
  MAX SUSPICIOUS COUNT
  ======================================================= */

  const maxSuspicious =
    Math.max(
      1,
      ...suspiciousMeters.map(
        (item) =>
          item.count
      )
    );

  /* =======================================================
  HEATMAP
  ======================================================= */

  const heatmap =
    useMemo(() => {
      const days = [
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
        "19",
        "20",
        "21",
        "22",
        "23",
        "24",
        "25",
        "26",
        "27",
        "28",
      ];

      return days.map(
        (
          day,
          index
        ) => {
          const source =
            allRows[
              index %
                Math.max(
                  allRows.length,
                  1
                )
            ];

          let level = 0;

          if (
            source?.suspicious
          ) {
            level =
              Math.min(
                4,
                2 +
                  (index % 3)
              );
          } else {
            level =
              index % 5 === 0
                ? 1
                : 0;
          }

          return {
            day,
            level,
          };
        }
      );
    }, [allRows]);

  /* =======================================================
  SEVERITY DATA
  ======================================================= */

  const severityData =
    useMemo(() => {
      const buckets = [
        {
          label: "50-60%",
          min: 50,
          max: 60,
          count: 0,
        },
        {
          label: "60-70%",
          min: 60,
          max: 70,
          count: 0,
        },
        {
          label: "70-80%",
          min: 70,
          max: 80,
          count: 0,
        },
        {
          label: "80-90%",
          min: 80,
          max: 90,
          count: 0,
        },
        {
          label: "90-100%",
          min: 90,
          max: 100,
          count: 0,
        },
      ];

      allRows
        .filter(
          (row) =>
            row.suspicious
        )
        .forEach(
          (row) => {
            const ratio =
              Math.max(
                0,
                Math.min(
                  100,
                  (row.consumption /
                    row.baseline) *
                    100
                )
              );

            const bucket =
              buckets.find(
                (item) =>
                  ratio >=
                    item.min &&
                  ratio <
                    item.max
              );

            if (bucket) {
              bucket.count += 1;
            }
          }
        );

      return buckets;
    }, [allRows]);

  /* =======================================================
  EXPORT REPORT
  ======================================================= */

  const handleExport = () => {
    const exportData =
      allRows.map(
        (row) => ({
          MSN: row.msn,
          "Ref. No.": row.ref,
          Date: row.date,
          "Consumption (kWh)":
            row.consumption,
          "Baseline (kWh)":
            row.baseline,
          Deviation:
            `${row.deviation}%`,
          Flag: row.flag,
        })
      );

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
      "daily-trend-report.json";

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

  /* =======================================================
  SVG LINE CHART
  ======================================================= */

  const chartWidth = 700;
  const chartHeight = 220;

  const getChartX =
    (index, length) =>
      length <= 1
        ? chartWidth / 2
        : (index /
            (length - 1)) *
          chartWidth;

  const getChartY =
    (value) => {
      const max = 14;
      const min = 0;

      const clamped =
        Math.max(
          min,
          Math.min(
            max,
            value
          )
        );

      return (
        chartHeight -
        (
          (clamped - min) /
          (max - min)
        ) *
          chartHeight
      );
    };

  const actualPoints =
    fleetData
      .map(
        (
          point,
          index
        ) =>
          `${getChartX(
            index,
            fleetData.length
          )},${getChartY(
            point.actual
          )}`
      )
      .join(" ");

  const baselinePoints =
    fleetData
      .map(
        (
          point,
          index
        ) =>
          `${getChartX(
            index,
            fleetData.length
          )},${getChartY(
            point.baseline
          )}`
      )
      .join(" ");

  /* =======================================================
  TABLE COLUMNS FOR REUSABLE TABLE
  ======================================================= */

  const trendColumns = [
    {
      key: "msn",
      label: "MSN",
      render: (value, row) => (
        <button
          type="button"
          className="dt-msn-link"
          onClick={() => openDailyResult(value)}
        >
          {value}
        </button>
      ),
    },
    { key: "ref", label: "REF. NO." },
    { key: "date", label: "DATE" },
    {
      key: "consumption",
      label: "CONSUMPTION (KWH)",
      render: (value) => value,
    },
    {
      key: "baseline",
      label: "BASELINE (KWH)",
      render: (value) => value,
    },
    {
      key: "flag",
      label: "FLAG",
      render: (value) => (
        <span className={`dt-flag ${value.toLowerCase().replace(/\s+/g, "-")}`}>
          {value}
        </span>
      ),
    },
  ];

  /* =======================================================
  RENDER
  ======================================================= */

  return (
    <>
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
              <h1>Daily Trend</h1>
              <p>
                Flags days where a meter's consumption dropped suspiciously
                below its own baseline.
              </p>
            </div>
            <button
              type="button"
              className="dt-export-top-button"
              onClick={handleExport}
            >
              <span>↓</span>
              Export
            </button>
          </section>

          {/* SELECTED METER */}
          {selectedMeter && (
            <div className="dt-selected-meter">
              <div className="dt-selected-meter-icon">◉</div>
              <div className="dt-selected-meter-info">
                <strong>MSN {getMeterMSN(selectedMeter)}</strong>
                <span>Ref. No. {getMeterRef(selectedMeter)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMeter(null);
                  setTopbarSearch("");
                  setSearchParams({});
                }}
              >
                ×
              </button>
            </div>
          )}

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
                  <span>12</span>
                  <span>9</span>
                  <span>6</span>
                  <span>3</span>
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
              <div className="dt-chart-axis">
                {fleetData.map((point) => (
                  <span key={point.date}>{point.date.slice(5)}</span>
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
                    title={`July ${cell.day}`}
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
              title="Daily Trend Records (Fleet)"
              columns={trendColumns}
              data={allRows}
              itemsPerPage={10}
              className="daily-trend-table"
            />
          </section>

          {/* FOOTER */}
          <div className="dt-demo-status">
            {selectedMeter ? (
              <>
                Showing daily trend for MSN <strong>{getMeterMSN(selectedMeter)}</strong>
                <span>•</span> Search or click an MSN to view details.
              </>
            ) : (
              <>Showing live dummy data for Daily Trend – search an MSN to filter.</>
            )}
          </div>

        </main>
      </div>
    </>
  );
}

export default DailyTrend;
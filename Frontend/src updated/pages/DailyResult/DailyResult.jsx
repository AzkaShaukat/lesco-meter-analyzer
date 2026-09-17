import "./DailyResult.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import {
  getMeterByMSN,
  getMeterSummary,
  getMeterGaps,
  getCoveragePoints,
} from "../../data/dummyData";

const normalizeMSN = (value = "") =>
  String(value).replace(/\D/g, "").trim();

function DailyResult() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlMSN = normalizeMSN(searchParams.get("msn"));
  const [topbarSearch, setTopbarSearch] = useState("");
  const [selectedMeter, setSelectedMeter] = useState(null);

  useEffect(() => {
    if (!urlMSN) {
      setSelectedMeter(null);
      setTopbarSearch("");
      return;
    }
    const meter = getMeterByMSN(urlMSN);
    if (!meter) {
      setSelectedMeter(null);
      setTopbarSearch("");
      return;
    }
    setSelectedMeter(meter);
    setTopbarSearch(urlMSN);
    localStorage.setItem("lescoSelectedMeter", JSON.stringify(meter));
    localStorage.setItem("lescoSelectedMSN", urlMSN);
  }, [urlMSN]);

  const selectMeter = (meter) => {
    if (!meter) return;
    const msn = normalizeMSN(meter.msn);
    setSelectedMeter(meter);
    localStorage.setItem("lescoSelectedMeter", JSON.stringify(meter));
    localStorage.setItem("lescoSelectedMSN", msn);
    navigate(`/daily-result?msn=${encodeURIComponent(msn)}`, { replace: true });
  };

  const handleTopbarSearch = () => {
    const normalized = normalizeMSN(topbarSearch);
    if (!normalized) return;
    const meter = getMeterByMSN(normalized);
    if (meter) selectMeter(meter);
  };

  const handleTopbarSearchChange = (value) => setTopbarSearch(value);

  const summary = useMemo(() => {
    if (!selectedMeter) return null;
    return getMeterSummary(selectedMeter);
  }, [selectedMeter]);

  const meterGaps = useMemo(() => {
    if (!selectedMeter) return [];
    return getMeterGaps(selectedMeter);
  }, [selectedMeter]);

  const coveragePoints = useMemo(() => {
    if (!selectedMeter) return [];
    return getCoveragePoints(selectedMeter);
  }, [selectedMeter]);

  const handleNewAnalysis = () => {
    setSelectedMeter(null);
    setTopbarSearch("");
    localStorage.removeItem("lescoSelectedMeter");
    localStorage.removeItem("lescoSelectedMSN");
    setSearchParams({});
  };

  const handleExportReport = () => {
    if (!selectedMeter) return;
    const rows = meterGaps.map((gap) => {
      const isSuspicious = gap.classification.includes("NO MATCHING");
      return [
        selectedMeter.msn,
        selectedMeter.ref,
        getShortDate(gap.start),
        getConsumption(gap),
        getBaseline(gap),
        isSuspicious ? "SUSPICIOUS LOW" : "NORMAL",
      ];
    });
    const csvRows = [
      ["MSN", "REF. NO.", "DATE", "CONSUMPTION (KWH)", "BASELINE (KWH)", "FLAG"],
      ...rows,
    ];
    const csvContent = csvRows
      .map((row) =>
        row
          .map((value) => {
            const safeValue = String(value ?? "").replace(/"/g, '""');
            return `"${safeValue}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-trend-${selectedMeter.msn}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getShortDate = (dateString) => {
    if (!dateString) return "--";
    return dateString.split(" ")[0] || "--";
  };

  const getConsumption = (gap) => {
    const value = Number(gap.missing || 0) * 0.8;
    return value.toFixed(1);
  };

  const getBaseline = (gap) => {
    const coverage = Number(String(gap.coverage).replace("%", ""));
    if (!coverage) return "0.0";
    const value = Number(gap.missing || 0) * (100 / coverage);
    return value.toFixed(1);
  };

  const totalDays = 31;
  const suspiciousDays = summary ? summary.needsReview : 0;
  const suspiciousPercentage = totalDays > 0 ? Math.round((suspiciousDays / totalDays) * 100) : 0;
  const normalDays = Math.max(0, totalDays - suspiciousDays);

  // Define columns for the ReusableTable
  const dailyColumns = [
    { key: "msn", label: "MSN" },
    { key: "ref", label: "REF. NO." },
    {
      key: "start",
      label: "DATE",
      render: (value) => getShortDate(value),
    },
    {
      key: "missing",
      label: "CONSUMPTION (KWH)",
      render: (value, row) => getConsumption(row),
    },
    {
      key: "coverage",
      label: "BASELINE (KWH)",
      render: (value, row) => getBaseline(row),
    },
    {
      key: "classification",
      label: "FLAG",
      render: (value) => {
        const isSuspicious = value && value.includes("NO MATCHING");
        return (
          <span className={`dr-flag ${isSuspicious ? "suspicious" : "normal"}`}>
            {isSuspicious ? "SUSPICIOUS LOW" : "NORMAL"}
          </span>
        );
      },
    },
  ];

  const tableData = useMemo(() => {
    if (!selectedMeter) return [];
    return meterGaps.map((gap) => ({
      ...gap,
      msn: selectedMeter.msn,
      ref: selectedMeter.ref,
    }));
  }, [selectedMeter, meterGaps]);

  // Chart helpers
  const maxCoverage = 100;
  const getDateNumber = (dateString) => {
    if (!dateString) return "--";
    const datePart = dateString.split(" ")[0];
    const parts = datePart.split("-");
    return parts[2] || "--";
  };

  return (
    <>
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={handleTopbarSearchChange}
        onSearch={handleTopbarSearch}
      />

      <div className="dr-layout">
        <Sidebar activeItem="Daily Trend" />

        <main className="dr-content">
          {/* HEADER */}
          <header className="dr-page-header">
            <div>
              <h1>Daily Trend Result</h1>
              <p>Flags days where a meter's consumption dropped suspiciously below its own baseline.</p>
            </div>
            <button type="button" className="dr-export-report" onClick={handleExportReport} disabled={!selectedMeter}>
              <span>⇩</span> Export
            </button>
          </header>

          {/* SELECTED METER */}
          {selectedMeter && (
            <div className="dr-selected-meter">
              <div className="dr-meter-status-icon">◉</div>
              <div className="dr-selected-meter-text">
                <strong>MSN {selectedMeter.msn}</strong>
                <span>Ref. No. {selectedMeter.ref}</span>
                <span>{selectedMeter.location}</span>
                <span>{selectedMeter.feeder}</span>
              </div>
              <button type="button" onClick={handleNewAnalysis} aria-label="Clear selected meter">×</button>
            </div>
          )}

          {/* EMPTY STATE */}
          {!selectedMeter && (
            <div className="dr-no-meter-selected">
              <div>◉</div>
              <h3>Search for a meter</h3>
              <p>Enter an MSN in the search bar above to view its daily trend, charts and records.</p>
            </div>
          )}

          {/* SUMMARY CARDS */}
          {selectedMeter && summary && (
            <div className="dr-summary-grid">
              <div className="dr-summary-card red">
                <span>SUSPICIOUS DAYS</span>
                <strong>{summary.needsReview}</strong>
                <small>/ {totalDays}</small>
                <i>⚠</i>
              </div>
              <div className="dr-summary-card red">
                <span>WORST DEVIATION</span>
                <strong>{summary.longestGap}</strong>
                <small>hrs</small>
                <i>↘</i>
              </div>
              <div className="dr-summary-card teal">
                <span>NORMAL DAYS</span>
                <strong>{normalDays}</strong>
                <i>✓</i>
              </div>
              <div className="dr-summary-card gray">
                <span>INSUFFICIENT DATA</span>
                <strong>{summary.lowCoverage}</strong>
                <i>◌</i>
              </div>
            </div>
          )}

          {/* CHARTS – only when meter selected */}
          {selectedMeter && (
            <div className="dr-chart-grid">
              {/* DAILY TREND LINE CHART */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">This meter, consumption vs baseline</div>
                <div className="dr-chart-legend">
                  <span><i className="legend-actual" />Actual</span>
                  <span><i className="legend-baseline" />Baseline</span>
                  <span><i className="legend-suspicious" />Suspicious day</span>
                </div>
                <div className="dr-line-chart">
                  <div className="dr-line-y">
                    <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                  </div>
                  <div className="dr-line-area">
                    <div className="dr-grid-line line-1" />
                    <div className="dr-grid-line line-2" />
                    <div className="dr-grid-line line-3" />
                    <div className="dr-grid-line line-4" />
                    {coveragePoints.length > 0 && (
                      <svg className="dr-line-svg" viewBox="0 0 500 150" preserveAspectRatio="none">
                        <polyline
                          points={coveragePoints.map((_, index) => {
                            const x = coveragePoints.length === 1 ? 250 : (index / (coveragePoints.length - 1)) * 500;
                            return `${x},55`;
                          }).join(" ")}
                          fill="none"
                          className="dr-baseline-path"
                        />
                        <polyline
                          points={coveragePoints.map((point, index) => {
                            const x = coveragePoints.length === 1 ? 250 : (index / (coveragePoints.length - 1)) * 500;
                            const y = 145 - (point.y / maxCoverage) * 120;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none"
                          className="dr-actual-path"
                        />
                        {coveragePoints.map((point, index) => {
                          const x = coveragePoints.length === 1 ? 250 : (index / (coveragePoints.length - 1)) * 500;
                          const y = 145 - (point.y / maxCoverage) * 120;
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="4"
                              className={point.type === "review" ? "dr-suspicious-point" : "dr-normal-point"}
                            />
                          );
                        })}
                      </svg>
                    )}
                  </div>
                </div>
                <div className="dr-chart-axis">
                  {coveragePoints.map((_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
              </section>

              {/* DEVIATION BARS */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">Deviation % per suspicious day</div>
                <div className="dr-deviation-chart">
                  {meterGaps.filter((gap) => gap.classification.includes("NO MATCHING")).length > 0 ? (
                    meterGaps
                      .filter((gap) => gap.classification.includes("NO MATCHING"))
                      .slice(0, 5)
                      .map((gap, index) => {
                        const coverage = Number(String(gap.coverage).replace("%", ""));
                        const deviation = Math.max(0, 100 - coverage);
                        return (
                          <div className="dr-deviation-row" key={index}>
                            <span>{getShortDate(gap.start)}</span>
                            <div className="dr-deviation-track">
                              <div className="dr-deviation-fill" style={{ width: `${Math.max(deviation, 4)}%` }} />
                            </div>
                            <strong>{deviation}%</strong>
                          </div>
                        );
                      })
                  ) : (
                    <div className="dr-no-chart-data">No suspicious days</div>
                  )}
                </div>
              </section>

              {/* DONUT */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">Day mix this month</div>
                <div className="dr-donut-wrapper">
                  <div
                    className="dr-donut"
                    style={{ "--suspicious": `${suspiciousPercentage}%` }}
                  >
                    <div className="dr-donut-inner">
                      <strong>{suspiciousPercentage}%</strong>
                      <span>suspicious</span>
                    </div>
                  </div>
                </div>
                <div className="dr-donut-text">{suspiciousDays} of {totalDays} days suspicious</div>
                <div className="dr-donut-legend">
                  <span><i className="normal-dot" />Normal</span>
                  <span><i className="suspicious-dot" />Suspicious</span>
                </div>
              </section>

              {/* HEATMAP */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">Suspicious days by date</div>
                <div className="dr-heatmap">
                  {Array.from({ length: 31 }, (_, index) => {
                    const day = index + 1;
                    const gap = meterGaps.find(
                      (item) => getDateNumber(item.start) === String(day).padStart(2, "0")
                    );
                    let level = 0;
                    if (gap) {
                      const coverage = Number(String(gap.coverage).replace("%", ""));
                      if (gap.classification.includes("NO MATCHING")) {
                        if (coverage === 0) level = 4;
                        else if (coverage < 30) level = 3;
                        else level = 2;
                      } else {
                        level = 1;
                      }
                    }
                    return (
                      <div
                        key={day}
                        className={`dr-heat-cell level-${level}`}
                        title={`July ${day}${gap ? ` — ${gap.coverage}` : ""}`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div className="dr-heatmap-legend">
                  <span>Less</span>
                  <i className="level-0" />
                  <i className="level-1" />
                  <i className="level-2" />
                  <i className="level-3" />
                  <i className="level-4" />
                  <span>More</span>
                </div>
              </section>
            </div>
          )}

          {/* --- TABLE SECTION (REUSABLE) --- */}
          {selectedMeter && (
            <section className="dr-table-card">
              <ReusableTable
                title={`Daily Trend Records — ${selectedMeter.msn}`}
                columns={dailyColumns}
                data={tableData}
                itemsPerPage={10}
                className="daily-result-table"
              />
            </section>
          )}

          {/* FOOTER */}
          <div className="dr-demo-status">
            {selectedMeter ? (
              <>
                Showing daily trend for MSN <strong>{selectedMeter.msn}</strong>
                <span>•</span> Search another MSN to switch meter.
              </>
            ) : (
              <>Search an MSN from the top bar to view daily trend data.</>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default DailyResult;
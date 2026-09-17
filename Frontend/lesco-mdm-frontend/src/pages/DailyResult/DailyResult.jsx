import "./DailyResult.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";
import { useAxisLabelStep } from "../../hooks/useMediaQuery";

import { useJobData } from "../../services/useJobData";
import {
  normalizeMSN,
  findMeterInfo,
  meterTrendDetail,
  trendSummary,
} from "../../services/meterResults";

function DailyResult() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMSN = normalizeMSN(searchParams.get("msn"));

  const { trendRows, meters } = useJobData();

  const [topbarSearch, setTopbarSearch] = useState("");
  const [selectedMSN, setSelectedMSN] = useState(urlMSN || "");

  useEffect(() => {
    if (urlMSN) {
      setSelectedMSN(urlMSN);
      setTopbarSearch(urlMSN);
    } else {
      setSelectedMSN("");
      setTopbarSearch("");
    }
  }, [urlMSN]);

  const meterInfo = useMemo(
    () => (selectedMSN ? findMeterInfo(meters, selectedMSN) : null),
    [meters, selectedMSN]
  );

  const allRows = useMemo(
    () => (selectedMSN ? meterTrendDetail(trendRows, selectedMSN) : []),
    [trendRows, selectedMSN]
  );

  const filterDefs = useMemo(() => [
    {
      key: "flag", label: "Day type", type: "select",
      options: [
        { value: "suspicious", label: "Suspicious low only" },
        { value: "normal", label: "Normal days only" },
      ],
      test: (r, v) => (v === "suspicious" ? !!r.suspicious : !r.suspicious),
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

  const [filterValues, setFilterValues, rows] = useFilters(allRows, filterDefs);

  const summary = useMemo(() => (rows.length ? trendSummary(rows) : null), [rows]);

  const selectMeter = (msn) => {
    const normalized = normalizeMSN(msn);
    if (!normalized) return;
    setSelectedMSN(normalized);
    localStorage.setItem("lescoSelectedMSN", normalized);
    navigate(`/daily-result?msn=${encodeURIComponent(normalized)}`, { replace: true });
  };

  const handleTopbarSearch = () => {
    const nm = normalizeMSN(topbarSearch);
    if (!nm) return;
    const meter = (meters || []).find(
      (m) =>
        normalizeMSN(m.MSN) === nm ||
        String(m["Ref. No."] || "").toLowerCase() === topbarSearch.trim().toLowerCase()
    );
    if (meter) selectMeter(meter.MSN);
  };

  const handleTopbarSearchChange = (value) => setTopbarSearch(value);

  const handleNewAnalysis = () => {
    setSelectedMSN("");
    setTopbarSearch("");
    localStorage.removeItem("lescoSelectedMSN");
    setSearchParams({});
  };

  const dayNum = (dateString) => String(dateString || "").slice(8, 10);

  const consMax = useMemo(
    () =>
      Math.max(
        1,
        ...rows
          .filter((r) => r.consumption != null && r.baseline != null)
          .map((r) => Math.max(r.consumption, r.baseline))
      ) * 1.1,
    [rows]
  );

  const linePoints = useMemo(
    () => rows.filter((r) => r.consumption != null && r.baseline != null),
    [rows]
  );

  // thin the date labels so they stay readable on a phone
  const lineAxisStep = useAxisLabelStep(linePoints.length);

  const suspiciousRows = useMemo(() => rows.filter((r) => r.suspicious), [rows]);

  const totalDays = summary ? summary.totalDays : 0;
  const suspiciousDays = summary ? summary.suspiciousDays : 0;
  const normalDays = summary ? summary.normalDays : 0;
  const suspiciousPercentage =
    totalDays > 0 ? Math.round((suspiciousDays / totalDays) * 100) : 0;

  const handleExportReport = () => {
    if (!rows.length) return;
    const csvRows = [
      ["MSN", "REF. NO.", "DATE", "CONSUMPTION (KWH)", "BASELINE (KWH)", "DEVIATION", "FLAG"],
      ...rows.map((r) => [
        meterInfo?.msn,
        meterInfo?.ref,
        r.date,
        r.consumption ?? "",
        r.baseline ?? "",
        r.deviation == null ? "" : `${r.deviation}%`,
        r.flag,
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-trend-${meterInfo?.msn}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const dailyColumns = [
    { key: "msn", label: "MSN", render: () => meterInfo?.msn },
    { key: "ref", label: "REF. NO.", render: () => meterInfo?.ref },
    { key: "date", label: "DATE" },
    {
      key: "consumption",
      label: "CONSUMPTION (KWH)",
      render: (value) => (value == null ? "—" : value),
    },
    {
      key: "baseline",
      label: "BASELINE (KWH)",
      render: (value) => (value == null ? "—" : value),
    },
    {
      key: "flag",
      label: "FLAG",
      render: (value) => (
        <span className={`dr-flag ${value.toLowerCase().replace(/\s+/g, "-")}`}>{value}</span>
      ),
    },
  ];

  return (
    /* real page container - was a bare fragment, so .daily-result-page matched
       nothing and the whole document scrolled */
    <div className="daily-result-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={handleTopbarSearchChange}
        onSearch={handleTopbarSearch}
      />

      <div className="dr-layout">
        <Sidebar />

        <main className="dr-content">
          <header className="dr-page-header">
            <div>
              <h1>Daily Trend Result</h1>
              <p>Flags days where a meter's consumption dropped suspiciously below its own baseline.</p>
            </div>
            <div className="page-header-actions">
              <button
                type="button"
                className="page-back-button"
                onClick={() => navigate("/daily-trend")}
              >
                <span>←</span> Back
              </button>
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={rows.length}
                totalCount={allRows.length}
              />
              <button
              type="button"
              className="page-export-button"
              onClick={handleExportReport}
              disabled={!rows.length}
            >
              <span>↓</span> Export
            </button>
            </div>
          </header>

          {meterInfo && (
            <div className="dr-selected-meter">
              <div className="dr-meter-status-icon">◉</div>
              <div className="dr-selected-meter-text">
                <strong>MSN {meterInfo.msn}</strong>
                <span>Ref. No. {meterInfo.ref}</span>
                <span>{meterInfo.location}</span>
                <span>{meterInfo.feeder}</span>
              </div>
            </div>
          )}

          {!selectedMSN && (
            <div className="dr-no-meter-selected">
              <div>◉</div>
              <h3>Search for a meter</h3>
              <p>Enter an MSN in the search bar above to view its daily trend, charts and records.</p>
            </div>
          )}

          {selectedMSN && !rows.length && (
            <div className="dr-no-meter-selected">
              <div>◉</div>
              <h3>No daily trend data</h3>
              <p>This analysis has no Daily Reads records for MSN {selectedMSN}.</p>
            </div>
          )}

          {summary && (
            <div className="dr-summary-grid">
              <div className="dr-summary-card red">
                <span>SUSPICIOUS DAYS</span>
                <strong>{suspiciousDays}</strong>
                <small>/ {totalDays}</small>
                <i>⚠</i>
              </div>
              <div className="dr-summary-card red">
                <span>WORST DEVIATION</span>
                <strong>{summary.worstDeviation}</strong>
                <small>%</small>
                <i>↘</i>
              </div>
              <div className="dr-summary-card teal">
                <span>NORMAL DAYS</span>
                <strong>{normalDays}</strong>
                <i>✓</i>
              </div>
              <div className="dr-summary-card gray">
                <span>INSUFFICIENT DATA</span>
                <strong>{summary.insufficient}</strong>
                <i>◌</i>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="dr-chart-grid">
              {/* CONSUMPTION VS BASELINE */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">This meter, consumption vs baseline</div>
                <div className="dr-chart-legend">
                  <span><i className="legend-actual" />Actual</span>
                  <span><i className="legend-baseline" />Baseline</span>
                  <span><i className="legend-suspicious" />Suspicious day</span>
                </div>
                <div className="dr-line-chart">
                  <div className="dr-line-y">
                    <span>{consMax.toFixed(1)}</span>
                    <span>{(consMax * 0.75).toFixed(1)}</span>
                    <span>{(consMax * 0.5).toFixed(1)}</span>
                    <span>{(consMax * 0.25).toFixed(1)}</span>
                    <span>0</span>
                  </div>
                  <div className="dr-line-area">
                    <div className="dr-grid-line line-1" />
                    <div className="dr-grid-line line-2" />
                    <div className="dr-grid-line line-3" />
                    <div className="dr-grid-line line-4" />
                    {linePoints.length > 0 && (
                      <svg className="dr-line-svg" viewBox="0 0 500 150" preserveAspectRatio="none">
                        <polyline
                          points={linePoints
                            .map((p, index) => {
                              const x = linePoints.length === 1 ? 250 : (index / (linePoints.length - 1)) * 500;
                              const y = 145 - (p.baseline / consMax) * 120;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                          fill="none"
                          className="dr-baseline-path"
                        />
                        <polyline
                          points={linePoints
                            .map((p, index) => {
                              const x = linePoints.length === 1 ? 250 : (index / (linePoints.length - 1)) * 500;
                              const y = 145 - (p.consumption / consMax) * 120;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                          fill="none"
                          className="dr-actual-path"
                        />
                        {linePoints.map((p, index) => {
                          const x = linePoints.length === 1 ? 250 : (index / (linePoints.length - 1)) * 500;
                          const y = 145 - (p.consumption / consMax) * 120;
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="4"
                              className={p.suspicious ? "dr-suspicious-point" : "dr-normal-point"}
                            />
                          );
                        })}
                      </svg>
                    )}
                  </div>
                </div>
                <div className="dr-chart-axis">
                  {linePoints.map((p, index) => (
                    <span key={index}>
                      {index % lineAxisStep === 0 ? String(p.date).slice(5) : ""}
                    </span>
                  ))}
                </div>
              </section>

              {/* DEVIATION BARS */}
              <section className="dr-chart-card">
                <div className="dr-chart-title">Deviation % per suspicious day</div>
                <div className="dr-deviation-chart">
                  {suspiciousRows.length > 0 ? (
                    suspiciousRows.slice(0, 5).map((r, index) => {
                      const deviation = r.deviation != null ? Math.round(r.deviation) : 0;
                      return (
                        <div className="dr-deviation-row" key={index}>
                          <span>{String(r.date).slice(5)}</span>
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
                <div className="dr-chart-title">Day mix this period</div>
                <div className="dr-donut-wrapper">
                  <div className="dr-donut" style={{ "--suspicious": `${suspiciousPercentage}%` }}>
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
                    const row = rows.find((item) => dayNum(item.date) === String(day).padStart(2, "0"));
                    let level = 0;
                    if (row) {
                      if (row.suspicious) level = row.deviation >= 80 ? 4 : row.deviation >= 60 ? 3 : 2;
                      else if (row.flag === "INSUFFICIENT DATA") level = 1;
                      else level = 1;
                    }
                    return (
                      <div
                        key={day}
                        className={`dr-heat-cell level-${level}`}
                        title={`Day ${day}${row ? ` — ${row.flag}` : ""}`}
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

          {rows.length > 0 && (
            <section className="dr-table-card">
              <ReusableTable
                title={`Daily Trend Records — ${meterInfo?.msn}`}
                columns={dailyColumns}
                data={rows}
                itemsPerPage={10}
                className="daily-result-table"
              />
            </section>
          )}

          <div className="dr-demo-status">
            {selectedMSN ? (
              <>
                Showing daily trend for MSN <strong>{selectedMSN}</strong>
                <span>•</span> Search another MSN to switch meter.
              </>
            ) : (
              <>Search an MSN from the top bar to view daily trend data.</>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DailyResult;

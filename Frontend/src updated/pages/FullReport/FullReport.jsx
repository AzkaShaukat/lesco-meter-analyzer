import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";
import "./FullReport.css";

import {
  getSummaryData,
  getAttentionItems,
  getLongestGaps,
  getMeterEntries,
  meters,
} from "../../data/dummyData";

const FullReport = () => {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("overview");
  const [searchValue, setSearchValue] = useState("");

  // Live dummy data
  const summaryData = useMemo(() => getSummaryData(), []);
  const attentionItems = useMemo(() => getAttentionItems(), []);
  const longestGaps = useMemo(() => getLongestGaps(), []);
  const meterEntries = useMemo(() => getMeterEntries(), []);

  // ── Meter detail navigation ──
  const openMeterDetail = (msn) => {
    const meter = meters.find((item) => item.msn === String(msn));
    if (!meter) return;
    localStorage.setItem("lescoSelectedMeter", JSON.stringify(meter));
    localStorage.setItem("lescoSelectedMSN", meter.msn);
    navigate(`/meter-detail?msn=${encodeURIComponent(meter.msn)}`);
  };

  // ── TopBar Search (navigates to meter detail) ──
  const handleSearch = (value) => {
    setSearchValue(value);
    const query = value.trim();
    if (!query) return;
    const exactMeter = meters.find(
      (m) => m.msn === query || m.ref.toLowerCase() === query.toLowerCase()
    );
    if (exactMeter) openMeterDetail(exactMeter.msn);
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

  // ── Export ──
  const handleExport = () => {
    const data = JSON.stringify(
      { summary: summaryData, meters: meterEntries },
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lesco-full-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // ── Table columns ──
  const gapColumns = [
    {
      key: "msn",
      label: "MSN",
      render: (value, row) => (
        <button
          type="button"
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            font: "inherit",
            color: "inherit",
          }}
          onClick={() => openMeterDetail(value)}
        >
          {value}
        </button>
      ),
    },
    { key: "ref", label: "Ref. No." },
    { key: "gapStart", label: "Gap start" },
    { key: "gapEnd", label: "Gap end" },
    { key: "hours", label: "Hours" },
    {
      key: "status",
      label: "Status",
      render: (value, row) => (
        <span className={`status-badge status-${row.statusType}`}>
          {value}
        </span>
      ),
    },
  ];

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
                  ? "Gap Analysis"
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
            <button
              type="button"
              className="report-export-button"
              onClick={handleExport}
            >
              <span className="report-export-icon">↓</span>
              Export
            </button>
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
              <span className="summary-label">TOTAL GAPS</span>
              <strong className="summary-value">
                {summaryData.totalGaps.toLocaleString()}
              </strong>
            </div>
            <div className="report-summary-card">
              <span className="summary-label">ALIGNS WITH OUTAGE</span>
              <strong className="summary-value">
                {summaryData.alignsWithOutage.toLocaleString()}
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
                        {item.meter !== "—" && (
                          <button
                            type="button"
                            className="attention-meter"
                            onClick={() => {
                              const msn = item.meter
                                .replace("MSN ", "")
                                .trim();
                              openMeterDetail(msn);
                            }}
                          >
                            {item.meter}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gap Resolution Donut */}
              <div className="report-data-card gap-resolution-card">
                <div className="report-card-header">
                  <div>
                    <p className="report-card-eyebrow">GAP RESOLUTION</p>
                    <h2>Gap Resolution</h2>
                  </div>
                </div>
                <div className="donut-chart-area">
                  <div
                    className="donut-chart"
                    style={{
                      background: `conic-gradient(
                        #c3212b 0deg ${
                          (summaryData.needsReview /
                            Math.max(summaryData.totalGaps, 1)) *
                          360
                        }deg,
                        #1687e8 ${
                          (summaryData.needsReview /
                            Math.max(summaryData.totalGaps, 1)) *
                          360
                        }deg 360deg
                      )`,
                    }}
                  >
                    <div className="donut-center">
                      <strong>{summaryData.totalGaps.toLocaleString()}</strong>
                      <span>TOTAL</span>
                    </div>
                  </div>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-dot review-dot"></i>
                    Review ({summaryData.needsReview.toLocaleString()})
                  </span>
                  <span>
                    <i className="legend-dot outage-dot"></i>
                    Outage ({summaryData.alignsWithOutage.toLocaleString()})
                  </span>
                </div>
              </div>

              {/* Longest Gaps */}
              <div className="report-data-card longest-gaps-card">
                <div className="report-card-header">
                  <div>
                    <p className="report-card-eyebrow">LONGEST GAPS</p>
                    <h2>Longest gaps (top 8)</h2>
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
            title={
              activeSection === "overview"
                ? "Gaps + Event Match"
                : activeSection === "gaps"
                ? "Gap Events"
                : activeSection === "outage"
                ? "Outage Correlation"
                : activeSection === "daily"
                ? "Daily Trend Data"
                : activeSection === "peak"
                ? "Peak Load Data"
                : "Analysis Data"
            }
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
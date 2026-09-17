import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";
import { getExportUrl } from "../../services/api";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";

import { useJobData } from "../../services/useJobData";
import {
  normalizeMSN,
  findMeterInfo,
  meterGapDetail,
  gapSummary,
  gapDurationDistribution,
  gapCoveragePoints,
  gapTimeline,
} from "../../services/meterResults";

import "./GapResult.css";

function GapResult() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMSN = normalizeMSN(searchParams.get("msn"));

  const { job, gapRows, meters } = useJobData();

  const [selectedMSN, setSelectedMSN] = useState(urlMSN || "");
  const [topbarSearch, setTopbarSearch] = useState("");

  // keep the selected meter in sync with the URL; default to first meter
  useEffect(() => {
    if (urlMSN) setSelectedMSN(urlMSN);
    else if (meters.length && !selectedMSN) setSelectedMSN(normalizeMSN(meters[0].MSN));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMSN, meters]);

  const activeMSN = selectedMSN || urlMSN;

  const currentMeter = useMemo(
    () => ({
      ...findMeterInfo(meters, activeMSN),
      gaps: meterGapDetail(gapRows, activeMSN),
    }),
    [meters, gapRows, activeMSN]
  );

  const summary = gapSummary(currentMeter.gaps);
  const durationDistribution = gapDurationDistribution(currentMeter.gaps);
  const maxDurationValue = Math.max(1, ...durationDistribution.map((d) => d.value));
  const coveragePoints = gapCoveragePoints(currentMeter.gaps);
  const timeline = gapTimeline(currentMeter.gaps);

  const selectMeter = (meterNumber) => {
    const normalized = normalizeMSN(meterNumber);
    if (!normalized) return;
    setSelectedMSN(normalized);
    setSearchParams({ msn: normalized });
    localStorage.setItem("lescoSelectedMSN", normalized);
  };

  const handleTopbarSearch = (value) => setTopbarSearch(value);

  const handleTopbarSearchSubmit = (value) => {
    const query = String(value || "").trim();
    if (!query) return;
    const nm = normalizeMSN(query);
    const meter = (meters || []).find(
      (m) =>
        normalizeMSN(m.MSN) === nm ||
        String(m["Ref. No."] || "").toLowerCase() === query.toLowerCase()
    );
    if (meter) selectMeter(meter.MSN);
  };

  const handleTopbarSearchKeyDown = (event) => {
    if (event.key === "Enter") handleTopbarSearchSubmit(topbarSearch);
  };

  const filterDefs = useMemo(() => [
    {
      key: "type", label: "Break type", type: "select",
      options: [
        { value: "review", label: "Unexplained" },
        { value: "low", label: "Low coverage" },
        { value: "outage", label: "Aligns with outage" },
      ],
      test: (r, v) => r.type === v,
    },
    {
      key: "minHours", label: "Minimum duration", type: "number", suffix: "h",
      test: (r, v) => Number(r.duration) >= Number(v),
    },
    {
      key: "minCoverage", label: "Minimum outage coverage", type: "number", suffix: "%",
      test: (r, v) => Number(r.coverageNum) >= Number(v),
    },
  ], []);

  const [filterValues, setFilterValues, filteredGaps] =
    useFilters(currentMeter.gaps || [], filterDefs);

  const gapColumns = [
    { key: "start", label: "BREAK START", sortable: true },
    { key: "end", label: "BREAK END" },
    {
      key: "duration",
      label: "DURATION",
      sortable: true,
      render: (value) => `${value} h`,
    },
    { key: "missing", label: "MISSING READINGS" },
    {
      key: "classification",
      label: "STATUS",
      render: (value) => {
        const isReview = value && value.includes("NO MATCHING");
        return (
          <span className={`md-status-badge ${isReview ? "review" : "outage"}`}>
            {isReview ? "Needs Review" : "Outage Aligned"}
          </span>
        );
      },
    },
    { key: "coverage", label: "COVERAGE IMPACT" },
  ];

  return (
    <div className="meter-detail-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={handleTopbarSearch}
        onSearch={handleTopbarSearchSubmit}
        onSearchKeyDown={handleTopbarSearchKeyDown}
      />

      <div className="md-layout">
        <Sidebar />

        <main className="md-content">
          <section className="md-page-header">
            <div>
              <p className="md-eyebrow">LOAD PROFILE BREAK RESULTS</p>
              <h1>Load Profile Break results</h1>
              <p className="md-description">
                Missing intervals for this meter, checked against outage events.
                Unexplained breaks are flagged for grid-integrity review.
              </p>
            </div>
            <div className="page-header-actions">
              <button
                type="button"
                className="page-back-button"
                onClick={() => navigate("/gap-detection")}
              >
                <span>←</span> Back
              </button>
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={filteredGaps.length}
                totalCount={(currentMeter.gaps || []).length}
              />
              <button
                type="button"
                className="page-export-button"
                onClick={() => {
                  if (job?.jobId)
                    window.location.href = getExportUrl(job.jobId, currentMeter.msn);
                }}
              >
                <span>↓</span> Export
              </button>
            </div>
          </section>


          <section className="md-selected-meter">
            <div className="md-selected-meter-icon">◉</div>
            <div className="md-selected-meter-text">
              <span>MSN {currentMeter.msn}</span>
              <span>• Ref. No. {currentMeter.ref}</span>
              <span>• {currentMeter.location}</span>
              <span>/ {currentMeter.feeder}</span>
            </div>
          </section>

          <section className="md-summary-grid">
            <div className="md-summary-card">
              <div className="md-summary-label">TOTAL BREAKS</div>
              <div className="md-summary-value">{summary.totalGaps}</div>
              <span className="md-summary-icon blue">▥</span>
            </div>
            <div className="md-summary-card review">
              <div className="md-summary-label">NEEDS REVIEW</div>
              <div className="md-summary-value">{summary.needsReview}</div>
              <span className="md-summary-icon red">△</span>
            </div>
            <div className="md-summary-card aligns">
              <div className="md-summary-label">ALIGNS</div>
              <div className="md-summary-value">{summary.aligns}</div>
              <span className="md-summary-icon teal">✓</span>
            </div>
            <div className="md-summary-card">
              <div className="md-summary-label">LOW COVERAGE</div>
              <div className="md-summary-value">{summary.lowCoverage}</div>
              <span className="md-summary-icon gray">◫</span>
            </div>
            <div className="md-summary-card">
              <div className="md-summary-label">LONGEST BREAK</div>
              <div className="md-summary-value md-gap-value">
                {summary.longestGap}
                <small>h</small>
              </div>
              <span className="md-summary-icon gray">◷</span>
            </div>
          </section>

          <section className="md-chart-grid">
            <div className="md-chart-card">
              <div className="md-chart-title">BREAK DURATION DISTRIBUTION</div>
              <div className="md-chart-body bar-chart">
                <div className="md-y-lines">
                  <span></span><span></span><span></span><span></span>
                </div>
                <div className="md-bars">
                  {durationDistribution.map((item) => (
                    <div className="md-bar-column" key={item.label}>
                      <div className="md-bar-area">
                        <div
                          className="md-bar"
                          style={{
                            height: `${Math.max(6, (item.value / maxDurationValue) * 92)}px`,
                            background: item.color,
                          }}
                          title={`${item.value} gaps`}
                        />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="md-chart-card">
              <div className="md-chart-title">DURATION VS COVERAGE</div>
              <div className="md-scatter-chart">
                <div className="md-scatter-y-label">COVERAGE %</div>
                <div className="md-scatter-area">
                  <div className="scatter-grid-line line-1"></div>
                  <div className="scatter-grid-line line-2"></div>
                  <div className="scatter-grid-line line-3"></div>
                  <div className="scatter-grid-line line-4"></div>
                  {coveragePoints.map((point, index) => (
                    <span
                      key={index}
                      className={`md-scatter-point ${point.type}`}
                      style={{
                        left: `${Math.min(96, point.x * 4.1)}%`,
                        bottom: `${point.y}%`,
                      }}
                      title={`${point.x}h / ${point.y}% coverage`}
                    />
                  ))}
                  <span className="scatter-y-high">100</span>
                  <span className="scatter-y-mid">50</span>
                  <span className="scatter-y-low">0</span>
                </div>
                <div className="md-scatter-x-label">
                  <span>0</span><span>10</span><span>20</span><span>30</span>
                  <small>DURATION (HOURS)</small>
                </div>
                <div className="md-scatter-legend">
                  <span><i className="legend-blue"></i>Aligned</span>
                  <span><i className="legend-red"></i>Critical</span>
                </div>
              </div>
            </div>
          </section>

          <section className="md-timeline-card">
            <div className="md-chart-title">BREAK TIMELINE</div>
            <div className="md-timeline">
              <div className="md-timeline-labels">
                <span>Day 1</span><span>Day 15</span><span>Day 30</span>
              </div>
              <div className="md-timeline-track">
                {timeline.map((event, index) => (
                  <div
                    key={index}
                    className={`md-timeline-event ${event.type}`}
                    style={{
                      left: `${Math.max(0, Math.min(100, ((event.day - 1) / 29) * 100))}%`,
                    }}
                    title={`Day ${event.day}: ${event.type}`}
                  />
                ))}
              </div>
              <div className="md-timeline-legend">
                <span><i className="timeline-blue"></i>Aligned Gap</span>
                <span><i className="timeline-red"></i>Needs Review</span>
                <span><i className="timeline-orange"></i>Low Coverage</span>
              </div>
            </div>
          </section>

          <section className="md-table-card">
            <ReusableTable
              title={`Load Profile Breaks — ${currentMeter.msn}`}
              columns={gapColumns}
              data={filteredGaps}
              itemsPerPage={10}
              className="gap-result-table"
            />
          </section>

          <div className="md-demo-status">
            Showing gap detail for MSN <strong>{currentMeter.msn}</strong>
            <span>•</span> Feeder: <strong>{currentMeter.feeder}</strong>
          </div>
        </main>
      </div>
    </div>
  );
}

export default GapResult;

import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";
import { useAxisLabelStep } from "../../hooks/useMediaQuery";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";
import {
  normalizeMSN,
  findMeterInfo,
  meterGapDetail,
  gapSummary,
  gapTimeline,
  meterTrendDetail,
} from "../../services/meterResults";

import "./MeterDetail.css";

function MeterDetail() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMSN = normalizeMSN(searchParams.get("msn"));

  const { job, gapRows, trendRows, peakRows, meters } = useJobData();

  const [selectedMSN, setSelectedMSN] = useState(urlMSN || "");
  const [topbarSearch, setTopbarSearch] = useState("");

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
  ], []);

  const [filterValues, setFilterValues, visibleGaps] =
    useFilters(currentMeter.gaps, filterDefs);

  const summary = gapSummary(currentMeter.gaps);
  const timeline = gapTimeline(currentMeter.gaps);

  // this meter's daily consumption vs baseline (from real trend rows)
  const dailyConsumption = useMemo(() => {
    return meterTrendDetail(trendRows, activeMSN)
      .filter((r) => r.consumption != null && r.baseline != null)
      .map((r) => ({
        day: String(r.date).slice(5),
        actual: r.consumption,
        baseline: r.baseline,
      }));
  }, [trendRows, activeMSN]);

  // thin the date labels so they stay readable on a phone
  const dailyAxisStep = useAxisLabelStep(dailyConsumption.length);

  const consMax = useMemo(
    () =>
      Math.max(
        1,
        ...dailyConsumption.map((p) => Math.max(p.actual, p.baseline))
      ) * 1.1,
    [dailyConsumption]
  );

  const meterPeak = useMemo(() => {
    const nm = normalizeMSN(activeMSN);
    const peaks = (peakRows || [])
      .filter((r) => normalizeMSN(r["MSN"]) === nm)
      .map((r) => Number(r["Peak Load (kW)"]) || 0);
    return peaks.length ? Math.max(...peaks) : null;
  }, [peakRows, activeMSN]);

  const selectMeter = (meterNumber) => {
    const normalized = normalizeMSN(meterNumber);
    if (!normalized) return;
    setSelectedMSN(normalized);
    setTopbarSearch(normalized);
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

  const handleTableAction = (gap) => {
    navigate(`/gap-result?msn=${encodeURIComponent(currentMeter.msn)}`);
  };

  const gapColumns = [
    {
      key: "start",
      label: "DATE & TIME",
      sortable: true,
      render: (value) => <span className="md-date-cell">{value}</span>,
    },
    { key: "duration", label: "DURATION", sortable: true, render: (value) => `${value}h` },
    {
      key: "classification",
      label: "BREAK TYPE",
      // Three real categories. The old version tested only for "NO MATCHING"
      // and labelled everything else "Outage Logged", which hid low-coverage
      // and no-event-data gaps behind the wrong badge.
      render: (value, row) => {
        const label =
          row.type === "outage" ? "Outage Logged"
          : row.type === "low" ? "Low Coverage"
          : "Unexplained";
        return (
          <span className={`md-gap-type ${row.type}`} title={value}>
            {label}
          </span>
        );
      },
    },
    {
      key: "missing",
      label: "MISSING READINGS",
      render: (value) => value,
    },
    {
      key: "actions",
      label: "ACTIONS",
      render: (value, row) => (
        <button
          type="button"
          className="md-action-button"
          onClick={() => handleTableAction(row)}
        >
          Analyze
        </button>
      ),
    },
  ];

  return (
    <div className="meter-detail-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={topbarSearch}
        onSearchChange={handleTopbarSearch}
        onSearch={handleTopbarSearchSubmit}
      />

      <div className="md-layout">
        <Sidebar />

        <main className="md-content">
          <section className="md-page-header">
            <div>
              <p className="md-eyebrow">FULL REPORT</p>
              <h1>Meter Detail</h1>
            </div>
            <div className="page-header-actions">
              <button
                type="button"
                className="page-back-button"
                onClick={() => navigate("/full-report")}
              >
                <span>←</span> Back
              </button>
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={visibleGaps.length}
                totalCount={currentMeter.gaps.length}
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
              <span className="md-feeder-box">{currentMeter.feeder}</span>
            </div>
          </section>

          <section className="md-summary-grid">
            <div className="md-summary-card">
              <span className="md-summary-label">TOTAL BREAKS</span>
              <strong>{summary.totalGaps}</strong>
              <span className="md-summary-icon blue">▥</span>
            </div>
            <div className="md-summary-card review">
              <span className="md-summary-label">NEEDS REVIEW</span>
              <strong>{summary.needsReview}</strong>
              <span className="md-summary-icon red">△</span>
            </div>
            <div className="md-summary-card aligns">
              <span className="md-summary-label">ALIGNS WITH OUTAGE</span>
              <strong>{summary.aligns}</strong>
              <span className="md-summary-icon teal">✓</span>
            </div>
            <div className="md-summary-card">
              <span className="md-summary-label">LONGEST BREAK</span>
              <strong>
                {summary.longestGap}
                <small>h</small>
              </strong>
              <span className="md-summary-icon gray">◷</span>
            </div>
            <div className="md-summary-card">
              <span className="md-summary-label">PEAK LOAD</span>
              <strong>
                {meterPeak == null ? "—" : meterPeak.toFixed(1)}
                <small>{meterPeak == null ? "" : " kW"}</small>
              </strong>
              <span className="md-summary-icon gray">↗</span>
            </div>
          </section>

          <section className="md-chart-grid">
            {/* BREAK TIMELINE */}
            <div className="md-chart-card">
              <div className="md-chart-header">
                <div>
                  <span className="md-chart-eyebrow">BREAK TIMELINE</span>
                  <h2>Break Timeline</h2>
                </div>
                <div className="md-chart-legend">
                  <span><i className="legend-red" />Unexplained</span>
                  <span><i className="legend-teal" />Outage</span>
                </div>
              </div>
              <div className="md-timeline-chart">
                <div className="md-timeline-y">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
                <div className="md-timeline-area">
                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />
                  <div className="md-timeline-grid-line" />
                  {timeline.map((event, index) => (
                    <span
                      key={index}
                      className={`md-timeline-bar ${event.type}`}
                      style={{
                        left: `${Math.min(82, Math.max(3, ((event.day - 1) / 29) * 90))}%`,
                        top: `${(index % 5) * 18 + 8}%`,
                        width: "18px",
                      }}
                      title={`Day ${event.day}`}
                    />
                  ))}
                </div>
              </div>
              <div className="md-timeline-axis">
                <span>Day 1</span><span>Day 8</span><span>Day 15</span>
                <span>Day 22</span><span>Day 30</span>
              </div>
            </div>

            {/* DAILY CONSUMPTION */}
            <div className="md-chart-card">
              <div className="md-chart-header">
                <div>
                  <span className="md-chart-eyebrow">DAILY CONSUMPTION</span>
                  <h2>Daily Consumption vs Baseline</h2>
                </div>
                <div className="md-chart-legend">
                  <span><i className="legend-blue-line" />Actual</span>
                  <span><i className="legend-dashed" />Baseline</span>
                </div>
              </div>
              <div className="md-line-chart">
                <div className="md-line-y">
                  <span>{consMax.toFixed(1)}</span>
                  <span>{(consMax * 0.75).toFixed(1)}</span>
                  <span>{(consMax * 0.5).toFixed(1)}</span>
                  <span>{(consMax * 0.25).toFixed(1)}</span>
                  <span>0</span>
                </div>
                <div className="md-line-area">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="md-line-grid" style={{ top: `${line * 25}%` }} />
                  ))}
                  {dailyConsumption.length > 0 && (
                    <svg className="md-line-svg" viewBox="0 0 700 220" preserveAspectRatio="none">
                      <polyline
                        points={dailyConsumption
                          .map((point, index) => {
                            const x =
                              dailyConsumption.length === 1
                                ? 350
                                : (index / (dailyConsumption.length - 1)) * 700;
                            const y = 220 - (point.baseline / consMax) * 220;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        className="md-baseline-line"
                      />
                      <polyline
                        points={dailyConsumption
                          .map((point, index) => {
                            const x =
                              dailyConsumption.length === 1
                                ? 350
                                : (index / (dailyConsumption.length - 1)) * 700;
                            const y = 220 - (point.actual / consMax) * 220;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        className="md-actual-line"
                      />
                      {dailyConsumption.map((point, index) => {
                        const x =
                          dailyConsumption.length === 1
                            ? 350
                            : (index / (dailyConsumption.length - 1)) * 700;
                        const y = 220 - (point.actual / consMax) * 220;
                        return <circle key={index} cx={x} cy={y} r="4" className="md-actual-point" />;
                      })}
                    </svg>
                  )}
                </div>
              </div>
              <div className="md-line-axis">
                {dailyConsumption.map((point, index) => (
                  <span key={index}>
                    {index % dailyAxisStep === 0 ? point.day : ""}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="md-table-card">
            <ReusableTable
              title={`Load Profile Breaks — ${currentMeter.msn}`}
              columns={gapColumns}
              data={visibleGaps}
              itemsPerPage={10}
              className="meter-detail-table"
            />
          </section>

          <div className="md-demo-status">
            Showing meter detail for MSN <strong>{currentMeter.msn}</strong>
            <span>•</span> {currentMeter.location}
          </div>
        </main>
      </div>
    </div>
  );
}

export default MeterDetail;

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import ReusableTable from "../../components/Table/ReusableTable";

import { useJobData } from "../../services/useJobData";
import { getExportUrl } from "../../services/api";
import FilterButton from "../../components/Filters/FilterButton";
import { useFilters } from "../../components/Filters/useFilters";

import "./Worklist.css";

const normalizeMSN = (v = "") => String(v).replace(/\D/g, "").trim();

function Worklist() {
  const navigate = useNavigate();
  const { job, summary, meters, worklistRows, screenRows, signalWeights } = useJobData();

  const [search, setSearch] = useState("");

  const scr = summary?.screen || {};
  const inspect = scr.inspect ?? 0;
  const review = scr.review ?? 0;
  const total = screenRows.length || (summary?.meters_analyzed ?? 0);
  const noAction = Math.max(0, total - inspect - review);

  const filterDefs = useMemo(() => [
    {
      key: "priority", label: "Priority", type: "select",
      options: [
        { value: "INSPECT", label: "Inspect" },
        { value: "REVIEW", label: "Review" },
      ],
      test: (r, v) => r.Priority === v,
    },
    {
      key: "minScore", label: "Minimum score", type: "number",
      test: (r, v) => Number(r.Score) >= Number(v),
    },
    {
      key: "tier1", label: "Evidence", type: "select",
      options: [
        { value: "1a", label: "Has strong (Tier 1A) signal" },
        { value: "1b", label: "Has any tamper event" },
      ],
      test: (r, v) =>
        v === "1a"
          ? Number(r["Tier 1A Signals"]) > 0
          : Number(r["Tier 1A Signals"]) + Number(r["Tier 1B Signals"]) > 0,
    },
    {
      key: "minMF", label: "Minimum MF", type: "number",
      test: (r, v) => Number(r.MF) >= Number(v),
    },
  ], []);

  const [filterValues, setFilterValues, filteredRows] = useFilters(worklistRows, filterDefs);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredRows;
    return filteredRows.filter(
      (x) =>
        String(x.MSN).toLowerCase().includes(q) ||
        String(x["Ref. No."] ?? "").toLowerCase().includes(q)
    );
  }, [filteredRows, search]);

  const openMeter = (msn) => {
    const n = normalizeMSN(msn);
    if (!n) return;
    localStorage.setItem("lescoSelectedMSN", n);
    navigate(`/meter-detail?msn=${encodeURIComponent(n)}`);
  };

  const handleExport = () => {
    if (job?.jobId) window.location.href = getExportUrl(job.jobId);
  };

  const columns = [
    {
      key: "Score",
      label: "SCORE",
      sortable: true,
      render: (v) => (
        <span className={`wl-score ${v >= 70 ? "high" : v >= 40 ? "mid" : "low"}`}>{v}</span>
      ),
    },
    {
      key: "Priority",
      label: "PRIORITY",
      render: (v) => (
        <span className={`wl-priority ${String(v).toLowerCase().replace(/\s+/g, "-")}`}>{v}</span>
      ),
    },
    {
      key: "MSN",
      label: "MSN",
      render: (v) => (
        <button type="button" className="wl-msn-link" onClick={() => openMeter(v)}>
          {v}
        </button>
      ),
    },
    { key: "Ref. No.", label: "REF. NO." },
    { key: "Why Flagged", label: "WHY FLAGGED" },
    {
      key: "Peak Load (kW)",
      label: "PEAK (KW)",
      sortable: true,
      render: (v) => (v == null ? "—" : Number(v).toFixed(1)),
    },
    { key: "MF", label: "MF" },
  ];

  return (
    <div className="wl-page">
      <TopBar
        variant="report"
        showSearch={true}
        searchValue={search}
        onSearchChange={setSearch}
        onSearch={setSearch}
      />

      <div className="wl-layout">
        <Sidebar />

        <main className="wl-content">
          <section className="wl-header">
            <div>
              <p className="wl-eyebrow">THEFT SCREENING</p>
              <h1>Inspection Worklist</h1>
              <p className="wl-sub">
                Meters ranked by how much they look like theft, so only a few need manual
                checking. A high score means <strong>most worth a visit</strong> — not proof.
              </p>
            </div>
            <div className="page-header-actions">
              <FilterButton
                filters={filterDefs}
                values={filterValues}
                onChange={setFilterValues}
                resultCount={rows.length}
                totalCount={(worklistRows || []).length}
              />
              <button type="button" className="page-export-button" onClick={handleExport}>
                <span>↓</span> Export
              </button>
            </div>
          </section>

          {/* KPI CARDS */}
          <section className="wl-kpi-grid">
            <div className="wl-kpi inspect">
              <span>INSPECT</span>
              <strong>{inspect}</strong>
              <small>strong evidence — visit these</small>
            </div>
            <div className="wl-kpi review">
              <span>REVIEW</span>
              <strong>{review}</strong>
              <small>worth a second look</small>
            </div>
            <div className="wl-kpi ok">
              <span>NO ACTION</span>
              <strong>{noAction}</strong>
              <small>nothing unusual found</small>
            </div>
            <div className="wl-kpi neutral">
              <span>METERS SCREENED</span>
              <strong>{total}</strong>
              <small>
                narrowed to {total ? Math.round((100 * inspect) / total) : 0}% for inspection
              </small>
            </div>
          </section>

          {/* FILTER PILLS */}
          <section className="wl-filters">
            <span className="wl-count">
              {rows.length.toLocaleString()} of {(worklistRows || []).length.toLocaleString()} flagged meters shown
            </span>
          </section>

          {/* WORKLIST TABLE */}
          <section className="wl-table-card">
            <ReusableTable
              title="Ranked worklist"
              columns={columns}
              data={rows}
              itemsPerPage={15}
              className="worklist-table"
            />
          </section>

          {/* WHY THESE SIGNALS — transparency panel */}
          {signalWeights.length > 0 && (
            <section className="wl-weights-card">
              <div className="wl-weights-head">
                <h2>How the ranking was calculated</h2>
                <p>
                  Each signal is weighted by how rare it is <em>in this fleet</em> — a symptom
                  most meters share carries almost no weight, a rare one carries a lot.
                </p>
              </div>
              <div className="wl-weights">
                {signalWeights.map((w) => (
                  <div className="wl-weight-row" key={w.Signal}>
                    <span className={`wl-tier tier-${String(w.Tier).toLowerCase()}`}>
                      {w.Tier}
                    </span>
                    <span className="wl-weight-name">{w.Signal}</span>
                    <span className="wl-weight-track">
                      <span
                        className="wl-weight-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            (Number(w.Weight) /
                              Math.max(...signalWeights.map((x) => Number(x.Weight) || 1))) *
                              100
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="wl-weight-meta">
                      {w["Meters Tripping"]} meters ({w["% of Fleet"]}%)
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="wl-footnote">
            Signals come from the meters' own event logs and consumption history. The same
            patterns can be caused by faulty CTs, misprogrammed meters or wiring errors — treat
            this as a review queue, not an accusation.
          </div>
        </main>
      </div>
    </div>
  );
}

export default Worklist;

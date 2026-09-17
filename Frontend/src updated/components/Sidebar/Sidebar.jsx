import { useLocation, useNavigate } from "react-router-dom";
import { useAnalysis } from "../../context/AnalysisContext";
import "./Sidebar.css";

function Sidebar({ activeItem = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { analysisType } = useAnalysis();

  // Lock rules (unchanged)
  const lockRules = {
    gaps: {
      "/full-report": true,
      "/gap-detection": false,
      "/outage-correlation": true,
      "/daily-trend": true,
      "/peak-load": true,
    },
    correlation: {
      "/full-report": true,
      "/gap-detection": false,
      "/outage-correlation": false,
      "/daily-trend": true,
      "/peak-load": true,
    },
    trend: {
      "/full-report": true,
      "/gap-detection": true,
      "/outage-correlation": true,
      "/daily-trend": false,
      "/peak-load": true,
    },
    peak: {
      "/full-report": true,
      "/gap-detection": true,
      "/outage-correlation": true,
      "/daily-trend": true,
      "/peak-load": false,
    },
    full: {
      "/full-report": false,
      "/gap-detection": false,
      "/outage-correlation": false,
      "/daily-trend": false,
      "/peak-load": false,
    },
  };

  const isLocked = (path) => {
    const rules = lockRules[analysisType];
    return rules ? rules[path] : false;
  };

  const handleNavigation = (path, event) => {
    if (isLocked(path)) {
      event.preventDefault();
      return;
    }
    navigate(path);
  };

  // ----- Determine which item should be active -----
  const getActiveItem = () => {
    if (activeItem) return activeItem; // prop overrides

    const path = location.pathname;
    if (path === "/full-report" || path === "/meter-detail") return "Overview";
    if (path === "/gap-detection") return "Gap detection";
    if (path === "/outage-correlation") return "Outage correlation";
    if (path === "/daily-trend" || path === "/daily-result") return "Daily Trend";
    if (path === "/peak-load") return "Peak load";
    return null;
  };

  const active = getActiveItem();

  // ----- Render -----
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">REPORT SECTIONS</div>

        {/* OVERVIEW */}
        <button
          type="button"
          className={`sidebar-item ${active === "Overview" ? "active" : ""} ${
            isLocked("/full-report") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/full-report", e)}
        >
          <span className="sidebar-icon overview-icon">▦</span>
          <span className="sidebar-item-text">Overview</span>
          {isLocked("/full-report") && <span className="lock-icon">🔒</span>}
        </button>

        {/* GAP DETECTION */}
        <button
          type="button"
          className={`sidebar-item ${active === "Gap detection" ? "active" : ""} ${
            isLocked("/gap-detection") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/gap-detection", e)}
        >
          <span className="sidebar-icon">⌁</span>
          <span className="sidebar-item-text">Gap detection</span>
          {isLocked("/gap-detection") && <span className="lock-icon">🔒</span>}
        </button>

        {/* OUTAGE CORRELATION */}
        <button
          type="button"
          className={`sidebar-item ${active === "Outage correlation" ? "active" : ""} ${
            isLocked("/outage-correlation") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/outage-correlation", e)}
        >
          <span className="sidebar-icon">⌁</span>
          <span className="sidebar-item-text">Outage correlation</span>
          {isLocked("/outage-correlation") && <span className="lock-icon">🔒</span>}
        </button>

        {/* DAILY TREND */}
        <button
          type="button"
          className={`sidebar-item ${active === "Daily Trend" ? "active" : ""} ${
            isLocked("/daily-trend") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/daily-trend", e)}
        >
          <span className="sidebar-icon">↗</span>
          <span className="sidebar-item-text">Daily trend</span>
          {isLocked("/daily-trend") && <span className="lock-icon">🔒</span>}
        </button>

        {/* PEAK LOAD */}
        <button
          type="button"
          className={`sidebar-item ${active === "Peak load" ? "active" : ""} ${
            isLocked("/peak-load") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/peak-load", e)}
        >
          <span className="sidebar-icon">↗</span>
          <span className="sidebar-item-text">Peak load</span>
          {isLocked("/peak-load") && <span className="lock-icon">🔒</span>}
        </button>
      </div>

      {/* NEW ANALYSIS – always clickable */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-new-analysis"
          onClick={() => navigate("/")}
        >
          <span className="sidebar-new-icon">+</span>
          <span>New Analysis</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
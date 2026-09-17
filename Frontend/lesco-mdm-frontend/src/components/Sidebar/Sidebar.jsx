import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAnalysis } from "../../context/AnalysisContext";
import { useMobileNav } from "../../context/MobileNavContext";
import "./Sidebar.css";

function Sidebar({ activeItem = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { analysisType } = useAnalysis();
  const { isOpen, close, registerSidebar } = useMobileNav();

  // tell the TopBar a sidebar exists on this page, so it shows its menu button
  useEffect(() => registerSidebar(), [registerSidebar]);

  // Which sections each analysis type unlocks (true = locked)
  const lockRules = {
    gaps: {
      "/worklist": true,
      "/full-report": true,
      "/gap-detection": false,
      "/outage-correlation": true,
      "/daily-trend": true,
      "/peak-load": true,
    },
    correlation: {
      "/worklist": true,
      "/full-report": true,
      "/gap-detection": false,
      "/outage-correlation": false,
      "/daily-trend": true,
      "/peak-load": true,
    },
    trend: {
      "/worklist": true,
      "/full-report": true,
      "/gap-detection": true,
      "/outage-correlation": true,
      "/daily-trend": false,
      "/peak-load": true,
    },
    peak: {
      "/worklist": true,
      "/full-report": true,
      "/gap-detection": true,
      "/outage-correlation": true,
      "/daily-trend": true,
      "/peak-load": false,
    },
    // the theft screen produces only the worklist sheets
    screen: {
      "/worklist": false,
      "/full-report": true,
      "/gap-detection": true,
      "/outage-correlation": true,
      "/daily-trend": true,
      "/peak-load": true,
    },
    full: {
      "/worklist": false,
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
    close();          // on a phone the drawer covers the page it just opened
    navigate(path);
  };

  // ----- Determine which item should be active -----
  const getActiveItem = () => {
    if (activeItem) return activeItem; // prop overrides

    const path = location.pathname;
    if (path === "/worklist") return "Worklist";
    if (path === "/full-report" || path === "/meter-detail") return "Full report";
    if (
      path === "/gap-detection" ||
      path === "/outage-correlation" ||
      path === "/gap-result"          // single-meter gap view
    )
      return "Load Profile Break";
    if (path === "/daily-trend" || path === "/daily-result") return "Daily Trend";
    if (path === "/peak-load") return "Peak load";
    return null;
  };

  const active = getActiveItem();

  // ----- Render -----
  return (
    <>
      {/* Scrim behind the drawer. Only rendered while open, and CSS keeps it
          invisible above the breakpoint where the sidebar is permanent. */}
      {isOpen && (
        <div
          className="sidebar-scrim"
          onClick={close}
          role="presentation"
        />
      )}

    <aside className={`sidebar ${isOpen ? "is-open" : ""}`}>
      <div className="sidebar-section">
        <div className="sidebar-section-title">REPORT SECTIONS</div>

        {/* WORKLIST — the "who to inspect first" list, so it sits at the top */}
        <button
          type="button"
          className={`sidebar-item ${active === "Worklist" ? "active" : ""} ${
            isLocked("/worklist") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/worklist", e)}
        >
          <span className="sidebar-icon">◎</span>
          <span className="sidebar-item-text">Worklist</span>
          {isLocked("/worklist") && <span className="lock-icon">🔒</span>}
        </button>

        {/* OVERVIEW */}
        <button
          type="button"
          className={`sidebar-item ${active === "Full report" ? "active" : ""} ${
            isLocked("/full-report") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/full-report", e)}
        >
          <span className="sidebar-icon overview-icon">▦</span>
          <span className="sidebar-item-text">Full report</span>
          {isLocked("/full-report") && <span className="lock-icon">🔒</span>}
        </button>

        {/* LOAD PROFILE BREAK */}
        <button
          type="button"
          className={`sidebar-item ${active === "Load Profile Break" ? "active" : ""} ${
            isLocked("/gap-detection") ? "locked" : ""
          }`}
          onClick={(e) => handleNavigation("/gap-detection", e)}
        >
          <span className="sidebar-icon">⌁</span>
          <span className="sidebar-item-text">Load Profile Break</span>
          {isLocked("/gap-detection") && <span className="lock-icon">🔒</span>}
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
          <span className="sidebar-item-text">Daily trend analysis</span>
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
          onClick={() => {
            close();
            navigate("/");
          }}
        >
          <span className="sidebar-new-icon">+</span>
          <span>New Analysis</span>
        </button>
      </div>
    </aside>
    </>
  );
}

export default Sidebar;
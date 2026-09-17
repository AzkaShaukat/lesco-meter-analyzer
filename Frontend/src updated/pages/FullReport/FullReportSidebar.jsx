import "./FullReport.css";

const FullReportSidebar = ({
  activeSection = "overview",
  onSectionChange,
  onNewUpload,
}) => {
  const menuItems = [
    {
      id: "overview",
      label: "Overview",
      icon: "▦",
    },
    {
      id: "gap",
      label: "Gap detection",
      icon: "⌁",
    },
    {
      id: "outage",
      label: "Outage correlation",
      icon: "⌁",
    },
    {
      id: "trend",
      label: "Daily trend",
      icon: "⌁",
    },
    {
      id: "peak",
      label: "Peak load",
      icon: "↗",
    },
  ];

  return (
    <aside className="report-sidebar">

      {/* REPORT SECTIONS */}
      <nav className="sidebar-navigation">

        <p className="sidebar-section-title">
          REPORT SECTIONS
        </p>

        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-item ${
              activeSection === item.id ? "active" : ""
            }`}
            onClick={() => onSectionChange?.(item.id)}
          >
            <span className="sidebar-nav-icon">
              {item.icon}
            </span>

            <span className="sidebar-nav-label">
              {item.label}
            </span>
          </button>
        ))}

      </nav>


      {/* BOTTOM ACTION */}
      <div className="sidebar-bottom">

        <button
          type="button"
          className="sidebar-action-button upload-button"
          onClick={onNewUpload}
        >
          <span className="sidebar-action-icon">
            +
          </span>

          <span>
            New Analysis
          </span>
        </button>

      </div>

    </aside>
  );
};

export default FullReportSidebar;
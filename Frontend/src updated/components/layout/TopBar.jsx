import { useNavigate } from "react-router-dom";
import "./TopBar.css";

const TopBar = ({
  showSearch = false,
  searchValue = "",
  onSearchChange,
  onSearch,
  variant = "landing",
}) => {
  const navigate = useNavigate();

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && onSearch) {
      onSearch(searchValue);
    }
  };

  const handleHelpClick = () => {
    navigate("/help");
  };

  return (
    <header className={`topbar topbar-${variant}`}>

      {/* BRAND — Logo (image) + Title */}
      <div className="topbar-brand">
        <img src="/logo.png" alt="LESCO" className="brand-logo-image" />
        <span className="brand-title">LESCO Theft Detection</span>
      </div>

      {/* SEARCH — Full Report only (unchanged) */}
      {showSearch && (
        <div className="topbar-search">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search meters, users..."
            aria-label="Search meter"
          />
        </div>
      )}

      {/* RIGHT SIDE — Only Help + Profile */}
      <div className="topbar-actions">

        {/* Help Icon */}
        <button
          type="button"
          className="topbar-icon-button"
          onClick={handleHelpClick}
          aria-label="Help"
        >
          <span className="help-icon">?</span>
        </button>

        {/* Profile Icon
        <button
          type="button"
          className="profile-button"
          aria-label="Profile"
        >
          <span className="profile-placeholder">U</span>
        </button> */}

      </div>

    </header>
  );
};

export default TopBar;
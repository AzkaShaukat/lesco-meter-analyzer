import { useNavigate } from "react-router-dom";
import { useMobileNav } from "../../context/MobileNavContext";
import "./TopBar.css";

const TopBar = ({
  showSearch = false,
  searchValue = "",
  onSearchChange,
  onSearch,
  variant = "landing",
}) => {
  const navigate = useNavigate();
  const { isOpen, toggle, hasSidebar } = useMobileNav();

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

      {/* MENU — phones only (CSS hides it above the breakpoint). Rendered only
          when a Sidebar is actually on the page, so the Landing page does not
          get a button that opens nothing. */}
      {hasSidebar && (
        <button
          type="button"
          className="topbar-menu-button"
          onClick={toggle}
          aria-label={isOpen ? "Close sections menu" : "Open sections menu"}
          aria-expanded={isOpen}
        >
          <span className={`menu-bars ${isOpen ? "is-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      )}

      {/* BRAND — Logo (image) + Title */}
      <div className="topbar-brand">
        <img src="/logo.png" alt="LESCO" className="brand-logo-image" />
        {/* the short form is swapped in by CSS on narrow screens, where the
            full title wrapped onto two lines and broke the bar's height */}
        <span className="brand-title">LESCO Theft Detection</span>
        <span className="brand-title-short" aria-hidden="true">LESCO</span>
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
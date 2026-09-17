import { useEffect, useMemo, useRef, useState } from "react";
import "./FilterButton.css";
import "./PageActions.css";

/**
 * One filter control, used identically on every page.
 *
 * Each page passes its own `filters` definitions; the button, panel, active
 * count badge and "Clear all" behave the same everywhere so the control is
 * learned once.
 *
 * A filter definition:
 *   {
 *     key:     "status",                       // unique within the page
 *     label:   "Break type",
 *     type:    "select" | "number",
 *     options: [{ value, label }],             // select only
 *     suffix:  "h",                            // number only, shown in the box
 *     test:    (row, value) => boolean         // how the value filters a row
 *   }
 *
 * `value` is always a string. "" means "not set" and the filter is skipped,
 * so `test` never has to handle the empty case.
 */
function FilterButton({ filters = [], values = {}, onChange, resultCount, totalCount }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const activeCount = useMemo(
    () => filters.filter((f) => (values[f.key] ?? "") !== "").length,
    [filters, values]
  );

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!filters.length) return null;

  const set = (key, value) => onChange({ ...values, [key]: value });
  const clearAll = () => onChange({});

  return (
    <div className="fb-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`fb-button ${activeCount ? "has-active" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="fb-icon" aria-hidden="true">⛃</span>
        <span>Filters</span>
        {activeCount > 0 && <span className="fb-badge">{activeCount}</span>}
        <span className="fb-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="fb-panel" role="dialog" aria-label="Filters">
          <div className="fb-panel-head">
            <strong>Filters</strong>
            {activeCount > 0 && (
              <button type="button" className="fb-clear" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>

          <div className="fb-fields">
            {filters.map((f) => {
              const v = values[f.key] ?? "";
              return (
                <label className="fb-field" key={f.key}>
                  <span className="fb-field-label">{f.label}</span>

                  {f.type === "number" ? (
                    <span className="fb-number">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={f.placeholder || "Any"}
                        value={v}
                        min={f.min ?? 0}
                        step={f.step ?? "any"}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                      {f.suffix && <em>{f.suffix}</em>}
                    </span>
                  ) : (
                    <select value={v} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">{f.anyLabel || "All"}</option>
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              );
            })}
          </div>

          {totalCount != null && (
            <div className="fb-result">
              Showing <strong>{Number(resultCount).toLocaleString()}</strong> of{" "}
              {Number(totalCount).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterButton;

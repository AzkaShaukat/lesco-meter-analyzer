import { useMemo, useState } from "react";

/**
 * Applies FilterButton definitions to a row list.
 *
 * Each definition supplies its own `test(row, value)`, so the semantics stay
 * with the page that understands its data while the UI stays shared.
 * A value of "" (or missing) means the filter is off and is skipped entirely.
 *
 *   const [values, setValues, rows] = useFilters(allRows, filterDefs);
 */
export function useFilters(rows, filters) {
  const [values, setValues] = useState({});

  const filtered = useMemo(() => {
    const active = filters.filter(
      (f) => (values[f.key] ?? "") !== "" && typeof f.test === "function"
    );
    if (!active.length) return rows || [];
    return (rows || []).filter((row) =>
      active.every((f) => f.test(row, values[f.key]))
    );
  }, [rows, filters, values]);

  return [values, setValues, filtered];
}

/** Shared numeric comparison used by most "minimum" filters. */
export const atLeast = (n) => (v) => Number(v) >= Number(n);

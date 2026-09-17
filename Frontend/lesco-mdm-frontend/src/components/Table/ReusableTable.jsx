import { useMemo, useState } from "react";
import "./ReusableTable.css";

const ReusableTable = ({
  title,
  columns,
  data = [],   // ✅ default empty array
  itemsPerPage = 10,
  className = "",
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  /* Sorting is opt-in per column: mark a column `sortable: true`. Clicking its
     header cycles desc -> asc -> off. `sortValue(row)` lets a column sort on a
     different value than it displays (e.g. a formatted string). */
  const [sort, setSort] = useState(null); // { key, dir: "asc" | "desc" }

  const rawData = Array.isArray(data) ? data : [];

  const safeData = useMemo(() => {
    if (!sort) return rawData;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rawData;

    const valueOf = (row) =>
      typeof col.sortValue === "function" ? col.sortValue(row) : row[col.key];

    const sign = sort.dir === "asc" ? 1 : -1;
    // slice() so the caller's array is never mutated
    return rawData.slice().sort((a, b) => {
      const x = valueOf(a);
      const y = valueOf(b);

      const bothNumeric =
        x !== "" && y !== "" && !Number.isNaN(Number(x)) && !Number.isNaN(Number(y));
      if (bothNumeric) return (Number(x) - Number(y)) * sign;

      // nulls always sink, whichever direction
      if (x == null) return 1;
      if (y == null) return -1;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * sign;
    });
  }, [rawData, sort, columns]);

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setCurrentPage(1); // a re-sort makes the old page number meaningless
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: "desc" };
      if (prev.dir === "desc") return { key: col.key, dir: "asc" };
      return null;
    });
  };

  const totalPages = Math.max(1, Math.ceil(safeData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, safeData.length);
  const currentData = safeData.slice(startIndex, endIndex);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className={`reusable-table-container ${className}`}>
      {title && <h3 className="reusable-table-title">{title}</h3>}

      <div className="reusable-table-wrapper">
        <table className="reusable-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort && sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`${col.sortable ? "is-sortable" : ""} ${
                      active ? "is-sorted" : ""
                    }`}
                    onClick={() => toggleSort(col)}
                    title={col.sortable ? "Click to sort" : undefined}
                  >
                    {col.label}
                    {col.sortable && (
                      <span className="rt-sort-arrow">
                        {active ? (sort.dir === "desc" ? "▼" : "▲") : "↕"}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? (
              currentData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row[col.key], row, idx) // ✅ now passes index
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="reusable-empty">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {safeData.length > 0 && (
        <div className="reusable-table-footer">
          <span className="reusable-info">
            Showing {startIndex + 1} to {endIndex} of {safeData.length} entries
          </span>
          {totalPages > 1 && (
            <div className="reusable-pagination">
              <button
                className="reusable-page-btn"
                onClick={handlePrev}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="reusable-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="reusable-page-btn"
                onClick={handleNext}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReusableTable;
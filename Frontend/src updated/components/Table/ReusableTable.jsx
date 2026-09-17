import { useState } from "react";
import "./ReusableTable.css";

const ReusableTable = ({
  title,
  columns,
  data = [],   // ✅ default empty array
  itemsPerPage = 10,
  className = "",
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const safeData = Array.isArray(data) ? data : [];
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
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
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
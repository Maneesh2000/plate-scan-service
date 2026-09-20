import React from "react";

export default function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Generate page numbers with a sliding window
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of{" "}
        <strong>{total}</strong> cases
      </div>

      <div className="pagination-controls">
        <div className="page-size-selector">
          <label htmlFor="page-size">Per page:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="pagination-nav">
          <button
            className="btn btn-sm btn-icon"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            title="First Page"
          >
            ««
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            title="Previous Page"
          >
            ‹ Prev
          </button>

          {getPageNumbers().map((num) => (
            <button
              key={num}
              className={`btn btn-sm ${num === page ? "btn-primary active" : ""}`}
              onClick={() => onPageChange(num)}
            >
              {num}
            </button>
          ))}

          <button
            className="btn btn-sm btn-icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            title="Next Page"
          >
            Next ›
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            title="Last Page"
          >
            »»
          </button>
        </div>
      </div>
    </div>
  );
}


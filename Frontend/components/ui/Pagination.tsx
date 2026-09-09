"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemLabel = "records",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        padding: "14px 18px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
        marginTop: 16,
      }}
    >
      {/* Left Summary and Page Size Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
          Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="input-field"
              style={{
                width: "auto",
                padding: "3px 8px",
                fontSize: "0.8rem",
                borderRadius: "var(--radius-sm)",
                height: 28,
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Navigation Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="btn btn-secondary btn-sm"
          style={{
            padding: "4px 10px",
            fontSize: "0.8rem",
            opacity: currentPage <= 1 ? 0.45 : 1,
            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
          }}
          aria-label="Previous Page"
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.82rem",
                    color: "var(--text-muted)",
                    userSelect: "none",
                  }}
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                style={{
                  minWidth: 30,
                  height: 30,
                  padding: "0 8px",
                  borderRadius: "var(--radius-sm)",
                  border: isCurrent ? "1px solid var(--color-primary-500)" : "1px solid var(--border-subtle)",
                  background: isCurrent ? "var(--color-primary-600)" : "transparent",
                  color: isCurrent ? "#ffffff" : "var(--text-secondary)",
                  fontWeight: isCurrent ? 700 : 500,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="btn btn-secondary btn-sm"
          style={{
            padding: "4px 10px",
            fontSize: "0.8rem",
            opacity: currentPage >= totalPages ? 0.45 : 1,
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
          }}
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

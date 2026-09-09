"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard view rendering error:", error);
  }, [error]);

  return (
    <div
      className="card"
      style={{
        maxWidth: 600,
        margin: "40px auto",
        textAlign: "center",
        padding: "48px 32px",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.15)",
          color: "var(--color-rose-400)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 18px",
        }}
      >
        <AlertCircle size={30} />
      </div>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
        Failed to load this module
      </h2>

      <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 20 }}>
        {error.message || "An unexpected error occurred while loading this dashboard view."}
      </p>

      {error.digest && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 20 }}>
          Digest: {error.digest}
        </div>
      )}

      <button onClick={() => reset()} className="btn btn-primary" style={{ margin: "0 auto" }}>
        <RefreshCw size={15} /> Reload Module
      </button>
    </div>
  );
}

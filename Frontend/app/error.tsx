"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error to console
    console.error("EMS App Router Error Caught:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-app)",
        padding: 24,
        color: "var(--text-primary)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          padding: "48px 36px",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.15)",
            color: "var(--color-rose-400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <AlertTriangle size={32} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
          Something went wrong
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 24 }}>
          {error.message || "An unexpected application error occurred while rendering this view."}
        </p>

        {error.digest && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 24 }}>
            Error Digest: {error.digest}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => reset()} className="btn btn-primary">
            <RefreshCw size={15} /> Try Again
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            <Home size={15} /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

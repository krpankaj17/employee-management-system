import React from "react";
import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
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
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          padding: "50px 32px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.15)",
            color: "var(--color-primary-400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <FileQuestion size={32} />
        </div>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            color: "var(--color-primary-400)",
            fontWeight: 700,
          }}
        >
          404 NOT FOUND
        </span>

        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 8, marginBottom: 12 }}>
          Page Not Found
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 28 }}>
          The enterprise resource or route you requested could not be found or has moved.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <Link href="/dashboard" className="btn btn-primary">
            <Home size={15} /> Dashboard Home
          </Link>
          <Link href="/login" className="btn btn-secondary">
            <ArrowLeft size={15} /> Sign In Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

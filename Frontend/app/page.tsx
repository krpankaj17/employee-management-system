"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_CONFIG } from "@/lib/config";

export default function Home() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      const user = localStorage.getItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER);
      const target = (token || user) ? "/dashboard" : "/login";
      window.location.replace(target);
    } catch {
      window.location.replace("/login");
    }

    // If redirect takes more than 1.5 seconds, reveal manual navigation links
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Immediate zero-delay redirect script before React hydration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var token = localStorage.getItem("${API_CONFIG.STORAGE_KEYS.AUTH_TOKEN}");
                var user = localStorage.getItem("${API_CONFIG.STORAGE_KEYS.CURRENT_USER}");
                if (token || user) {
                  window.location.replace("/dashboard");
                } else {
                  window.location.replace("/login");
                }
              } catch(e) {
                window.location.replace("/login");
              }
            })();
          `,
        }}
      />
      <noscript>
        <meta httpEquiv="refresh" content="0; url=/login" />
      </noscript>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app, #080914)",
          color: "var(--text-primary, #ffffff)",
          fontFamily: "var(--font-sans, sans-serif)",
          gap: 20,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(99, 102, 241, 0.2)",
            borderTopColor: "var(--color-primary-500, #6366f1)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px 0", color: "#f8fafc" }}>
            Employee Management Portal
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #94a3b8)", margin: 0 }}>
            Redirecting to your workspace...
          </p>
        </div>

        {/* Fallback buttons if browser blocks redirect or slow dev compilation */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 12,
            opacity: showFallback ? 1 : 0.6,
            transition: "opacity 0.3s ease",
          }}
        >
          <Link
            href="/dashboard"
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "#a5b4fc",
              fontSize: "0.82rem",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Go to Dashboard &rarr;
          </Link>
          <Link
            href="/login"
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#94a3b8",
              fontSize: "0.82rem",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Sign In
          </Link>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}


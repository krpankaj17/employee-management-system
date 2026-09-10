"use client";

import React, { useState, useEffect } from "react";
import {
  BACKEND_SERVERS,
  getBaseUrl,
} from "@/lib/config";
import { AlertTriangle, RefreshCw, X, Server } from "lucide-react";

export function BackendOfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineDetail, setOfflineDetail] = useState<string>("");
  const [reconnecting, setReconnecting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOffline = (e: any) => {
      setIsOffline(true);
      setDismissed(false);
      if (e.detail?.message) {
        setOfflineDetail(e.detail.message);
      }
    };

    window.addEventListener("ems_backend_offline", handleOffline);

    return () => {
      window.removeEventListener("ems_backend_offline", handleOffline);
    };
  }, []);

  const currentServer = BACKEND_SERVERS.python;

  const handleRetry = async () => {
    setReconnecting(true);
    try {
      const res = await fetch(`${currentServer.url}/health`, { method: "GET" }).catch(() =>
        fetch(`${currentServer.url}/`)
      );
      if (res && res.ok) {
        setIsOffline(false);
        setDismissed(true);
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } else {
        setIsOffline(true);
      }
    } catch (e) {
      setIsOffline(true);
    } finally {
      setReconnecting(false);
    }
  };

  if (!isOffline || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))",
        borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        zIndex: 50,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#f87171",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={17} />
        </div>
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Backend Connection Offline ({currentServer.name})
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
            Cannot reach <code style={{ color: "var(--color-primary-400)" }}>{currentServer.url}</code>. Serving resilient fallback data without crashes.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleRetry}
          disabled={reconnecting}
          className="btn btn-secondary btn-sm"
          style={{
            fontSize: "0.76rem",
            padding: "5px 12px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={13} className={reconnecting ? "animate-spin" : ""} />
          {reconnecting ? "Testing..." : "Retry"}
        </button>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            borderRadius: 4,
          }}
          title="Dismiss warning"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

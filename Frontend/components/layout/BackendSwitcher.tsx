"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getActiveBackend,
  setActiveBackend,
  BACKEND_SERVERS,
  BackendType,
  getBaseUrl,
} from "@/lib/config";
import { Server, ChevronDown, Check, RefreshCw, Zap } from "lucide-react";

export function BackendSwitcher() {
  const [activeBackend, setActiveBackendState] = useState<BackendType>("python");
  const [isOpen, setIsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<Record<string, "connected" | "offline" | "checking">>({
    java: "checking",
    python: "checking",
  });
  const [latency, setLatency] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveBackendState(getActiveBackend());

    const handleBackendChange = () => {
      setActiveBackendState(getActiveBackend());
    };

    window.addEventListener("ems_backend_changed", handleBackendChange);
    return () => window.removeEventListener("ems_backend_changed", handleBackendChange);
  }, []);

  // Ping backend health
  const checkHealth = async (type: "java" | "python") => {
    const server = BACKEND_SERVERS[type];
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${server.url}/health`, {
        method: "GET",
        signal: controller.signal,
      }).catch(async () => {
        // Fallback ping to root /
        return fetch(`${server.url}/`, { signal: controller.signal });
      });
      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - start);
      if (res && res.ok) {
        setHealthStatus((prev) => ({ ...prev, [type]: "connected" }));
        if (type === activeBackend) setLatency(elapsed);
      } else {
        setHealthStatus((prev) => ({ ...prev, [type]: "offline" }));
      }
    } catch (e) {
      setHealthStatus((prev) => ({ ...prev, [type]: "offline" }));
    }
  };

  useEffect(() => {
    checkHealth("python");
    checkHealth("java");
    const interval = setInterval(() => {
      checkHealth("python");
      checkHealth("java");
    }, 15000);
    return () => clearInterval(interval);
  }, [activeBackend]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (target: BackendType) => {
    setActiveBackend(target);
    setActiveBackendState(target);
    setIsOpen(false);
  };

  const getStatusColor = (target: BackendType) => {
    if (target === "mock") return "var(--color-primary-400)";
    const st = healthStatus[target];
    if (st === "connected") return "#10b981"; // Emerald green
    if (st === "checking") return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const getActiveLabel = () => {
    if (activeBackend === "java") return "Java :8080";
    if (activeBackend === "python") return "Python :8000";
    return "Mock Mode";
  };

  const getActiveIcon = () => {
    if (activeBackend === "java") return "☕";
    if (activeBackend === "python") return "🐍";
    return "🧪";
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-surface-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "5px 12px",
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "all var(--transition-fast)",
        }}
        title={`Active Target: ${activeBackend.toUpperCase()}`}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: getStatusColor(activeBackend),
            boxShadow: `0 0 6px ${getStatusColor(activeBackend)}`,
            display: "inline-block",
          }}
        />
        <span>{getActiveIcon()}</span>
        <span>{getActiveLabel()}</span>
        {latency !== null && activeBackend !== "mock" && healthStatus[activeBackend] === "connected" && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>
            {latency}ms
          </span>
        )}
        <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 280,
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
            zIndex: 100,
            overflow: "hidden",
            padding: 8,
            animation: "modalEnter 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Target Backend Server</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                checkHealth("python");
                checkHealth("java");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.72rem",
              }}
              title="Re-check health"
            >
              <RefreshCw size={12} /> Ping
            </button>
          </div>

          {/* Option 1: Python */}
          <div
            onClick={() => handleSelect("python")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeBackend === "python" ? "var(--bg-surface-active)" : "transparent",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                activeBackend === "python" ? "var(--bg-surface-active)" : "transparent")
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1rem" }}>🐍</span>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Python FastAPI
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {BACKEND_SERVERS.python.url}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor:
                    healthStatus.python === "connected"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color: healthStatus.python === "connected" ? "#10b981" : "#ef4444",
                  fontWeight: 600,
                }}
              >
                {healthStatus.python === "connected" ? "Online" : "Offline"}
              </span>
              {activeBackend === "python" && <Check size={16} style={{ color: "var(--color-primary-500)" }} />}
            </div>
          </div>

          {/* Option 2: Java */}
          <div
            onClick={() => handleSelect("java")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeBackend === "java" ? "var(--bg-surface-active)" : "transparent",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                activeBackend === "java" ? "var(--bg-surface-active)" : "transparent")
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1rem" }}>☕</span>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Java Spring Boot
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {BACKEND_SERVERS.java.url}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor:
                    healthStatus.java === "connected"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color: healthStatus.java === "connected" ? "#10b981" : "#ef4444",
                  fontWeight: 600,
                }}
              >
                {healthStatus.java === "connected" ? "Online" : "Offline"}
              </span>
              {activeBackend === "java" && <Check size={16} style={{ color: "var(--color-primary-500)" }} />}
            </div>
          </div>

          {/* Option 3: Mock */}
          <div
            onClick={() => handleSelect("mock")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              background: activeBackend === "mock" ? "var(--bg-surface-active)" : "transparent",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                activeBackend === "mock" ? "var(--bg-surface-active)" : "transparent")
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1rem" }}>🧪</span>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Mock Standalone
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  In-memory demo data
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  color: "var(--color-primary-400)",
                  fontWeight: 600,
                }}
              >
                Offline
              </span>
              {activeBackend === "mock" && <Check size={16} style={{ color: "var(--color-primary-500)" }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

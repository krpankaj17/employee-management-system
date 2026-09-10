"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export interface ToastEventDetail {
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Trigger an in-app toast notification from anywhere in client-side code.
 */
export function showToast(message: string, type: ToastType = "info", duration = 4500) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ems_toast", {
      detail: { message, type, duration },
    })
  );
}

showToast.success = (message: string, duration = 4000) => showToast(message, "success", duration);
showToast.error = (message: string, duration = 6000) => showToast(message, "error", duration);
showToast.warning = (message: string, duration = 5000) => showToast(message, "warning", duration);
showToast.info = (message: string, duration = 4000) => showToast(message, "info", duration);

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Intercept native browser alert to guarantee zero "localhost says" popups anywhere
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      const text = typeof msg === "string" ? msg : String(msg ?? "");
      showToast(text, "info");
    };

    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>;
      if (!customEvent.detail || !customEvent.detail.message) return;

      const { message, type = "info", duration = 4500 } = customEvent.detail;
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    window.addEventListener("ems_toast", handleToastEvent);
    return () => {
      window.removeEventListener("ems_toast", handleToastEvent);
      window.alert = originalAlert;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 420,
        width: "calc(100% - 48px)",
        pointerEvents: "none",
      }}
      role="region"
      aria-live="polite"
      aria-label="System Notifications"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";

        const accentColor = isSuccess
          ? "#10b981"
          : isError
          ? "#ef4444"
          : isWarning
          ? "#f59e0b"
          : "#6366f1";

        const border = isSuccess
          ? "1px solid #dcfce7"
          : isError
          ? "1px solid #fee2e2"
          : isWarning
          ? "1px solid #fef3c7"
          : "1px solid #e0e7ff";

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: "12px",
              background: "#ffffff",
              border,
              borderLeft: `4px solid ${accentColor}`,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)",
              color: "#0f172a",
              fontSize: "0.86rem",
              fontWeight: 500,
              lineHeight: 1.45,
              animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <div style={{ color: accentColor, flexShrink: 0, display: "flex", alignItems: "center" }}>
              {isSuccess && <CheckCircle2 size={18} />}
              {isError && <AlertCircle size={18} />}
              {isWarning && <AlertTriangle size={18} />}
              {!isSuccess && !isError && !isWarning && <Info size={18} />}
            </div>

            <div style={{ flex: 1, wordBreak: "break-word", color: "#0f172a", fontWeight: 600 }}>
              {toast.message}
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#334155";
                e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

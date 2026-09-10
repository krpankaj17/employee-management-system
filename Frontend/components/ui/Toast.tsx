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

        const bg = isSuccess
          ? "rgba(16, 185, 129, 0.12)"
          : isError
          ? "rgba(239, 68, 68, 0.14)"
          : isWarning
          ? "rgba(245, 158, 11, 0.12)"
          : "rgba(59, 130, 246, 0.12)";

        const border = isSuccess
          ? "1px solid rgba(16, 185, 129, 0.3)"
          : isError
          ? "1px solid rgba(239, 68, 68, 0.35)"
          : isWarning
          ? "1px solid rgba(245, 158, 11, 0.3)"
          : "1px solid rgba(59, 130, 246, 0.3)";

        const iconColor = isSuccess
          ? "var(--color-emerald-400, #34d399)"
          : isError
          ? "var(--color-rose-400, #f87171)"
          : isWarning
          ? "var(--color-amber-400, #fbbf24)"
          : "var(--color-cyan-400, #22d3ee)";

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 16px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${bg}, rgba(15, 23, 42, 0.96))`,
              border,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
              color: "var(--text-primary, #ffffff)",
              fontSize: "0.86rem",
              lineHeight: 1.45,
              animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <div style={{ color: iconColor, flexShrink: 0, marginTop: 2 }}>
              {isSuccess && <CheckCircle2 size={18} />}
              {isError && <AlertCircle size={18} />}
              {isWarning && <AlertTriangle size={18} />}
              {!isSuccess && !isError && !isWarning && <Info size={18} />}
            </div>

            <div style={{ flex: 1, wordBreak: "break-word" }}>
              {toast.message}
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                flexShrink: 0,
                transition: "color 0.15s ease",
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

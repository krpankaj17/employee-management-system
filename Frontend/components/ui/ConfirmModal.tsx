"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, UserMinus, X, Info } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  icon?: "trash" | "user-minus" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon = "warning",
  isLoading = false,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen || !mounted) return null;

  // Icon mapping
  const renderIcon = () => {
    const iconSize = 22;
    switch (icon) {
      case "trash":
        return <Trash2 size={iconSize} />;
      case "user-minus":
        return <UserMinus size={iconSize} />;
      case "info":
        return <Info size={iconSize} />;
      case "warning":
      default:
        return <AlertTriangle size={iconSize} />;
    }
  };

  // Color theme by variant
  const getThemeStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconBg: "rgba(239, 68, 68, 0.14)",
          iconBorder: "rgba(239, 68, 68, 0.3)",
          iconColor: "var(--color-rose-400, #f87171)",
          btnClass: "btn btn-danger",
          btnGlow: "0 0 16px rgba(239, 68, 68, 0.4)",
        };
      case "warning":
        return {
          iconBg: "rgba(245, 158, 11, 0.14)",
          iconBorder: "rgba(245, 158, 11, 0.3)",
          iconColor: "var(--color-amber-400, #fbbf24)",
          btnClass: "btn btn-warning",
          btnGlow: "0 0 16px rgba(245, 158, 11, 0.4)",
        };
      case "primary":
      default:
        return {
          iconBg: "rgba(6, 182, 212, 0.14)",
          iconBorder: "rgba(6, 182, 212, 0.3)",
          iconColor: "var(--color-cyan-400, #22d3ee)",
          btnClass: "btn btn-primary",
          btnGlow: "0 0 16px rgba(6, 182, 212, 0.4)",
        };
    }
  };

  const theme = getThemeStyles();

  const modalNode = (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="modal-card"
        style={{
          maxWidth: 480,
          padding: "26px 28px",
          background: "rgba(18, 20, 36, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 24px 60px -12px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.12)",
          borderRadius: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "14px",
              background: theme.iconBg,
              border: `1px solid ${theme.iconBorder}`,
              color: theme.iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 14px -2px ${theme.iconBg}`,
            }}
          >
            {renderIcon()}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: isLoading ? "not-allowed" : "pointer",
              padding: 4,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color var(--transition-fast)",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Title & Body */}
        <div style={{ marginBottom: 24 }}>
          <h3
            id="confirm-modal-title"
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
          <div
            style={{
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}
          >
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{ padding: "8px 18px", fontSize: "0.88rem" }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={theme.btnClass}
            style={{
              padding: "8px 20px",
              fontSize: "0.88rem",
              fontWeight: 600,
              boxShadow: theme.btnGlow,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              transition: "all var(--transition-fast)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isLoading && (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  borderTopColor: "#ffffff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

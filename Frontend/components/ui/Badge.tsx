import React from "react";
import { StatusBadgeVariant } from "@/types/common";

interface BadgeProps {
  children: React.ReactNode;
  variant?: StatusBadgeVariant;
  showDot?: boolean;
}

export function Badge({ children, variant = "primary", showDot = false }: BadgeProps) {
  const variantClass = `badge-${variant}`;

  return (
    <span className={`badge ${variantClass}`}>
      {showDot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

/**
 * Helper to automatically pick badge color for common status strings
 */
export function StatusBadge({ status, label, showDot = false }: { status: string; label?: string; showDot?: boolean }) {
  let variant: StatusBadgeVariant = "neutral";
  const s = String(status || "").toLowerCase();

  if (["active", "present", "approved", "paid", "completed", "verified"].includes(s)) {
    variant = "success";
  } else if (["pending", "pending_verification", "half_day", "late", "planning", "on_hold", "draft", "warning"].includes(s)) {
    variant = "warning";
  } else if (["on_leave", "on leave", "leave", "inactive", "absent", "rejected", "failed", "cancelled", "terminated", "critical", "danger"].includes(s)) {
    variant = "danger";
  } else if (["submitted", "hybrid", "remote", "office", "info"].includes(s)) {
    variant = "info";
  }

  const formatted = label || String(status || "Active").replace(/_/g, " ");

  return <Badge variant={variant} showDot={showDot}>{formatted}</Badge>;
}

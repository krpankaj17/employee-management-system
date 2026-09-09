"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Building,
  User,
  LogOut,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function OnboardingPendingPage() {
  const router = useRouter();
  const { user, role, isPendingOnboarding, logout } = useAuth();

  const handleCheckStatus = () => {
    if (!isPendingOnboarding) {
      router.push("/dashboard");
    } else {
      window.location.reload();
    }
  };

  const handleSignOut = () => {
    logout(router);
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Pending Status Header Card */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(34, 211, 238, 0.08))",
          border: "1px solid var(--border-strong)",
          textAlign: "center",
          padding: "48px 36px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(245, 158, 11, 0.15)",
            color: "var(--color-amber-400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Clock size={34} />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 14px",
            borderRadius: 20,
            background: "rgba(245, 158, 11, 0.15)",
            color: "var(--color-amber-400)",
            fontSize: "0.8rem",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <Clock size={13} /> STAGE 3 OF 4 • PENDING ADMINISTRATIVE PROVISIONING
        </div>

        <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 12 }}>
          Welcome, {user?.display_name || "New Team Member"}!
        </h1>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.98rem", lineHeight: 1.6, maxWidth: 580, margin: "0 auto 28px" }}>
          Your user profile has been created and your corporate email (<code>{user?.email}</code>) has been successfully verified.
          Your account is currently in the <strong>HR Operations Queue</strong> awaiting administrative role assignment, department allocation, and employee provisioning.
        </p>

        {/* Verification Summary Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
            padding: "8px 18px",
            borderRadius: 30,
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-emerald-400)", fontWeight: 600 }}>
            <CheckCircle2 size={16} /> Email OTP Authenticated
          </div>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <div style={{ color: "var(--text-muted)" }}>
            Registered: {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Today"}
          </div>
        </div>
      </div>

      {/* Corporate Lifecycle Stepper */}
      <div className="card">
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          Onboarding Verification Pipeline
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-emerald-500)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.92rem" }}>
                1. Account Registration & Credential Generation
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Corporate email credentials created and securely hashed.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-emerald-500)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.92rem" }}>
                2. 6-Digit Email Verification (OTP)
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Identity confirmed via one-time verification token.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(245, 158, 11, 0.2)", color: "var(--color-amber-400)", border: "2px solid var(--color-amber-500)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--color-amber-400)", fontSize: "0.92rem" }}>
                3. HR Role Assignment & Employee Record Provisioning (Active Step)
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                The HR Manager or System Administrator will assign your organizational role (e.g. Employee, Project Manager), department, designation, and compensation parameters.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: 0.6 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              4
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.92rem" }}>
                4. Full Portal & Timesheet Activation
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Direct access to daily biometric shift punches, leave requests, and payslips.
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={handleSignOut} className="btn btn-secondary">
            <LogOut size={16} /> Sign Out
          </button>
          <button onClick={handleCheckStatus} className="btn btn-primary">
            <RefreshCw size={16} /> Check Onboarding Status
          </button>
        </div>
      </div>
    </div>
  );
}

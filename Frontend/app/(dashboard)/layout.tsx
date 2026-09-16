"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { BackendOfflineBanner } from "@/components/layout/BackendOfflineBanner";
import { API_CONFIG } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import OnboardingPendingPage from "./onboarding-pending/page";

import { ToastContainer } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { user, isPendingOnboarding, mounted, logout } = useAuth();

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        const user = localStorage.getItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER);
        if (!token && !user) {
          setIsAuthenticated(false);
          router.replace("/login");
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        setIsAuthenticated(false);
        router.replace("/login");
      }
    };

    checkAuth();

    window.addEventListener("ems_auth_changed", checkAuth);
    window.addEventListener("storage", checkAuth);
    return () => {
      window.removeEventListener("ems_auth_changed", checkAuth);
      window.removeEventListener("storage", checkAuth);
    };
  }, [router, pathname]);

  // Trap unassigned users to /onboarding-pending if they attempt to navigate to any internal page
  useEffect(() => {
    if (isAuthenticated && mounted && isPendingOnboarding && pathname !== "/onboarding-pending") {
      router.replace("/onboarding-pending");
    }
  }, [isAuthenticated, mounted, isPendingOnboarding, pathname, router]);

  // While checking auth status, show clean security loader and prevent internal dashboard flash
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app, #f7f5ee)",
          color: "var(--text-primary, #111827)",
          fontFamily: "var(--font-sans, sans-serif)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(234, 179, 8, 0.2)",
            borderTopColor: "var(--color-amber-500, #eab308)",
            animation: "authSpin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.88rem", color: "var(--text-secondary, #64748b)", letterSpacing: "0.02em" }}>
          Verifying security session...
        </span>
        <style>{`
          @keyframes authSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated: will be redirected to /login by useEffect
  if (!isAuthenticated) {
    return null;
  }

  // User has no assigned roles: STRICTLY show ONLY the pending role page.
  // All internal dashboard tabs, metrics, project cards, and topbar navigation are restricted.
  if (isPendingOnboarding) {
    return (
      <div className="app-layout" style={{ minHeight: "100vh", background: "var(--bg-app, #f7f5ee)" }}>
        <div className="main-content-wrapper">
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 32px",
              background: "var(--bg-surface, #ffffff)",
              borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary, #111827)", letterSpacing: "-0.01em" }}>
                Corporate Portal
              </span>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "var(--color-amber-500, #d97706)",
                  letterSpacing: "0.02em",
                }}
              >
                Role Allocation Pending
              </span>
            </div>

            <button
              type="button"
              onClick={() => logout(router)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                borderRadius: "8px",
                color: "#e11d48",
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.22)",
                cursor: "pointer",
              }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </header>

          <main className="page-container" style={{ padding: "24px 16px" }}>
            <OnboardingPendingPage />
          </main>
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar removed per user request: Unified top navbar layout */}
      <div className="main-content-wrapper">
        <Topbar />
        <BackendOfflineBanner />
        <main className="page-container">{children}</main>
      </div>
      <ToastContainer />
    </div>
  );
}


"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BackendOfflineBanner } from "@/components/layout/BackendOfflineBanner";
import { API_CONFIG } from "@/lib/config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
          background: "var(--bg-app, #080914)",
          color: "var(--text-primary, #ffffff)",
          fontFamily: "var(--font-sans, sans-serif)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(99, 102, 241, 0.2)",
            borderTopColor: "var(--color-primary-500, #6366f1)",
            animation: "authSpin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: "0.88rem", color: "var(--text-secondary, #94a3b8)", letterSpacing: "0.02em" }}>
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

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content-wrapper">
        <Topbar />
        <BackendOfflineBanner />
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}


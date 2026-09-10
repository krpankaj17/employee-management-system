"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown, CheckSquare, Megaphone, CalendarCheck2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isHR, isAdmin, isEmployee, logout, mounted } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  // Primary Core Modules: Restrict administrative modules from regular employees
  const primaryNavItems = [
    { label: "Dashboard", href: "/dashboard" },
    ...(!isEmployee ? [{ label: "Employees", href: "/employees" }] : []),
    { label: "Attendance", href: "/attendance" },
    { label: "Leaves", href: "/leaves" },
    { label: "Salary", href: "/payroll" },
    { label: "Projects", href: "/projects" },
    { label: "Reviews", href: "/reviews" },
    ...(!isEmployee ? [{ label: "Departments", href: "/departments" }] : []),
  ];

  // Secondary & Governance Modules inside "More ▾"
  const moreNavItems = [
    ...(isAdmin || isHR
      ? [{ label: "Approvals", href: "/approvals", icon: CheckSquare }]
      : []),
    { label: "Announcements", href: "/announcements", icon: Megaphone },
    { label: "Holidays", href: "/holidays", icon: CalendarCheck2 },
    ...(isAdmin
      ? [
          { label: "Roles & Governance", href: "/roles", icon: ShieldCheck },
          { label: "Security Audit Logs", href: "/audit-logs", icon: ShieldAlert },
        ]
      : []),
  ];

  const isMoreActive = moreNavItems.some((item) => pathname.startsWith(item.href));

  return (
    <div className="studio-floating-nav-wrapper">
      <nav className="studio-floating-nav-island" aria-label="Main floating navigation">
        {primaryNavItems.map((item) => {
          const active = isNavActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`studio-nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}

        {/* More ▾ Dropdown for Approvals, Announcements, Holidays, Admin Governance */}
        <div
          ref={moreRef}
          style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
        >
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`studio-nav-item ${isMoreActive ? "active" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: isMoreOpen ? "rgba(0,0,0,0.05)" : undefined,
            }}
            aria-expanded={isMoreOpen}
          >
            <span>More</span>
            <ChevronDown
              size={13}
              style={{
                transform: isMoreOpen ? "rotate(180deg)" : "none",
                transition: "transform 150ms ease",
              }}
            />
          </button>

          {isMoreOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 210,
                background: "#ffffff",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                borderRadius: 14,
                boxShadow: "0 14px 34px -4px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
                padding: "6px",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {moreNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      fontWeight: active ? 600 : 500,
                      color: active ? "#111827" : "#4b5563",
                      background: active ? "rgba(254, 240, 138, 0.35)" : "transparent",
                      textDecoration: "none",
                      transition: "all 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "#f4f4f5";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Icon size={15} style={{ color: active ? "#ca8a04" : "#6b7280" }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <Link
          href="/profile"
          className={`studio-nav-item ${pathname.startsWith("/profile") ? "active" : ""}`}
          aria-label="Account Settings"
        >
          Settings
        </Link>

        {/* Prominent, accessible Sign Out button */}
        <button
          type="button"
          onClick={() => logout(router)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "6px 14px",
            fontSize: "0.82rem",
            fontWeight: 600,
            borderRadius: "8px",
            color: "#e11d48",
            background: "rgba(244, 63, 94, 0.08)",
            border: "1px solid rgba(244, 63, 94, 0.22)",
            cursor: "pointer",
            transition: "all 140ms ease",
            boxShadow: "0 1px 2px rgba(244, 63, 94, 0.05)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(244, 63, 94, 0.16)";
            e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(244, 63, 94, 0.08)";
            e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.22)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          title={mounted && user?.display_name ? `Sign out (${user.display_name})` : "Sign out"}
          aria-label="Sign out"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </nav>
    </div>
  );
}

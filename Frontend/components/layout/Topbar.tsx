"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isHR, isAdmin, logout, mounted } = useAuth();
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

  // Core backend routes only (no speculative features like Hiring or Devices)
  const coreNavItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "People", href: "/employees" },
    { label: "Attendance", href: "/attendance" },
    { label: "Leaves", href: "/leaves" },
    { label: "Salary", href: "/payroll" },
    { label: "Projects", href: "/projects" },
    { label: "Reviews", href: "/reviews" },
    { label: "Departments", href: "/departments" },
    ...(isAdmin || isHR ? [{ label: "Approvals", href: "/approvals" }] : []),
    { label: "Announcements", href: "/announcements" },
    { label: "Holidays", href: "/holidays" },
  ];

  const adminItems = [
    { label: "Roles & Governance", href: "/roles" },
    { label: "Security Audit Logs", href: "/audit-logs" },
  ];

  const isAdminMenuActive = adminItems.some((item) => pathname.startsWith(item.href));

  return (
    <div className="studio-floating-nav-wrapper">
      <nav className="studio-floating-nav-island" aria-label="Main floating navigation">
        {coreNavItems.map((item) => {
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

        {/* Admin Governance Dropdown if Admin */}
        {isAdmin && (
          <div className="capsule-dropdown-trigger" ref={moreRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`studio-nav-item ${isAdminMenuActive ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              aria-expanded={isMoreOpen}
            >
              <span>Admin</span>
              <ChevronDown
                size={13}
                style={{
                  transform: isMoreOpen ? "rotate(180deg)" : "none",
                  transition: "transform 150ms ease",
                }}
              />
            </button>

            {isMoreOpen && (
              <div className="capsule-dropdown-menu">
                {adminItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={`capsule-dropdown-item ${active ? "active" : ""}`}
                    >
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Pill */}
        <Link
          href="/profile"
          className={`studio-nav-item ${pathname.startsWith("/profile") ? "active" : ""}`}
        >
          Settings
        </Link>

        {/* Clean Sign Out */}
        <button
          type="button"
          onClick={() => logout(router)}
          className="studio-nav-item"
          style={{
            padding: "8px 12px",
            color: "var(--color-rose-500, #f43f5e)",
            opacity: 0.85,
          }}
          title={mounted && user?.display_name ? `Sign out (${user.display_name})` : "Sign out"}
          aria-label="Sign out"
        >
          <LogOut size={15} />
        </button>
      </nav>
    </div>
  );
}

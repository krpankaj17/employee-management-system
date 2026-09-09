"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Search,
  ChevronDown,
  Shield,
  LogOut,
  Settings,
  ShieldCheck,
  Megaphone,
  CheckCheck,
  ExternalLink,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Avatar } from "../ui/Avatar";
import { BackendSwitcher } from "./BackendSwitcher";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import { Announcement } from "@/types/announcement";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isHR, isAdmin, logout, mounted } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notification Center Popover
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.announcements.list().then((list) => {
      setAnnouncements(list.slice(0, 4));
      setUnreadCount(list.length);
    }).catch(() => {
      setAnnouncements([]);
      setUnreadCount(0);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPageTitle = () => {
    if (pathname === "/dashboard") return role === "Employee" ? "Employee Workspace" : "Dashboard Overview";
    if (pathname.startsWith("/employees")) return "Employee Directory";
    if (pathname.startsWith("/attendance")) return role === "Employee" ? "My Attendance & Timesheets" : "Attendance & Timesheets";
    if (pathname.startsWith("/leaves")) return role === "Employee" ? "My Leave Balances & Requests" : "Leave Management";
    if (pathname.startsWith("/payroll")) return role === "Employee" ? "My Salary & Payslips" : "Compensation & Payroll";
    if (pathname.startsWith("/projects")) return "Projects & Operations";
    if (pathname.startsWith("/reviews")) return role === "Employee" ? "My Performance Reviews" : "Performance Evaluations";
    if (pathname.startsWith("/departments")) return "Departments & Hierarchy";
    if (pathname.startsWith("/announcements")) return "Company Bulletin";
    if (pathname.startsWith("/holidays")) return "Company Holiday Calendar";
    if (pathname.startsWith("/roles")) return "Role & Permission Governance";
    if (pathname.startsWith("/audit-logs")) return "Security Audit Logs";
    if (pathname.startsWith("/profile")) return "My Profile & Settings";
    if (pathname.startsWith("/onboarding-pending")) return "Onboarding Verification";
    return "Employee Management System";
  };

  const handleSignOut = () => {
    logout(router);
  };

  return (
    <header
      style={{
        height: "var(--topbar-height)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 40,
        transition: "background-color var(--transition-base)",
        gap: 20,
      }}
    >
      {/* Search Bar Pill */}
      <div style={{ flex: 1, maxWidth: 360 }}>
        <div className="glass-search-pill">
          <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            className="glass-search-input"
            aria-label="Search"
          />
        </div>
      </div>

      {/* Right Controls: Notifications, Theme Toggle, User Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 180, justifyContent: "flex-end" }}>
        {/* Live Backend Target Switcher */}
        <BackendSwitcher />

        {/* Notifications Icon & Popover */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="action-icon-btn"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: isNotifOpen ? "var(--bg-surface-active)" : "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              position: "relative",
            }}
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell size={18} style={{ color: isNotifOpen ? "var(--color-cyan-400)" : "var(--text-secondary)" }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 9,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#f43f5e",
                  boxShadow: "0 0 8px #f43f5e",
                }}
              />
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotifOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                right: 0,
                width: 380,
                maxWidth: "calc(100vw - 32px)",
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-xl)",
                zIndex: 60,
                overflow: "hidden",
                animation: "modalEnter 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-surface-elevated)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 10,
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "var(--color-primary-400)",
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setUnreadCount(0)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-primary-400)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification Items */}
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {announcements.map((ann, idx) => (
                  <Link
                    key={ann.public_id}
                    href="/announcements"
                    onClick={() => {
                      setIsNotifOpen(false);
                      setUnreadCount(Math.max(0, unreadCount - 1));
                    }}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      textDecoration: "none",
                      background: idx < unreadCount ? "rgba(99, 102, 241, 0.05)" : "transparent",
                      transition: "background var(--transition-fast)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: ann.priority === "Urgent" ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: ann.priority === "Urgent" ? "var(--color-rose-400)" : "var(--color-primary-400)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Megaphone size={15} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
                        <h4
                          style={{
                            fontSize: "0.84rem",
                            fontWeight: idx < unreadCount ? 700 : 600,
                            color: "var(--text-primary)",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ann.title}
                        </h4>
                        {idx < unreadCount && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "var(--color-primary-400)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>

                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-secondary)",
                          margin: 0,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {ann.content}
                      </p>

                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                        {ann.author_name} • {new Date(ann.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </Link>
                ))}

                {announcements.length === 0 && (
                  <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.84rem" }}>
                    No new company announcements or notifications.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--bg-surface-elevated)",
                  borderTop: "1px solid var(--border-subtle)",
                  textAlign: "center",
                }}
              >
                <Link
                  href="/announcements"
                  onClick={() => setIsNotifOpen(false)}
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-primary-400)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  View all bulletins & announcements <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Mode Toggle */}
        <ThemeToggle />

        {/* User Account Menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            suppressHydrationWarning
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 12px 4px 4px",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: isMenuOpen ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.04)",
              backdropFilter: "blur(16px)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            <Avatar name={mounted ? (user?.display_name || "User") : "Corporate User"} size={34} ring={true} />
            <div suppressHydrationWarning style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, textAlign: "left" }}>
              <span suppressHydrationWarning style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {mounted ? (user?.display_name || "User") : "Corporate User"}
              </span>
              <span suppressHydrationWarning style={{ fontSize: "0.7rem", color: "var(--color-cyan-400)", fontWeight: 500 }}>
                {mounted ? String(role || "Employee").replace(/_/g, " ") : "Employee"}
              </span>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: "var(--text-muted)",
                transition: "transform var(--transition-fast)",
                transform: isMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Elevated Account Menu */}
          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 260,
                background: "var(--bg-card, #0f1325)",
                backdropFilter: "blur(24px)",
                border: "1px solid var(--border-strong, rgba(255, 255, 255, 0.12))",
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)",
                padding: "8px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                animation: "modalFadeIn 0.15s ease-out",
              }}
            >
              {/* Account Header */}
              <div
                style={{
                  padding: "10px 12px 12px",
                  borderBottom: "1px solid var(--border-subtle)",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {user?.display_name}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  {user?.email}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "var(--color-primary-400)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                  }}
                >
                  <Shield size={12} />
                  <span>{String(role || "Employee").replace(/_/g, " ")}</span>
                </div>
              </div>

              {/* Links */}
              <Link
                href="/profile"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                <Settings size={15} />
                <span>My Profile & Settings</span>
              </Link>

              {isAdmin && (
                <Link
                  href="/roles"
                  onClick={() => setIsMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  <ShieldCheck size={15} style={{ color: "var(--color-cyan-400)" }} />
                  <span>Roles & Permissions</span>
                </Link>
              )}

              <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

              <button
                onClick={handleSignOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-rose-400)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

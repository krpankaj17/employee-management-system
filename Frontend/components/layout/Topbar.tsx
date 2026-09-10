"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Bell,
  Settings,
  ShieldCheck,
  UserCheck,
  Megaphone,
  CalendarCheck2,
  ExternalLink,
  LogOut,
  Shield,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import { Announcement } from "@/types/announcement";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isHR, isAdmin, logout, mounted } = useAuth();

  // Navigation Items
  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "People", href: "/employees" },
    { label: "Hiring", href: "/onboarding-pending" },
    { label: "Attendance", href: "/attendance" },
    { label: "Leaves", href: "/leaves" },
    { label: "Salary", href: "/payroll" },
    { label: "Projects", href: "/projects" },
    { label: "Reviews", href: "/reviews" },
    { label: "Departments", href: "/departments" },
  ];

  // More Dropdown State
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // User Account Popover
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Notification Popover
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.announcements
      .list()
      .then((list) => {
        setAnnouncements(list.slice(0, 4));
        setUnreadCount(list.length);
      })
      .catch(() => {
        setAnnouncements([]);
        setUnreadCount(0);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const moreItems = [
    ...(isAdmin || isHR
      ? [{ label: "User Approvals", href: "/approvals", icon: UserCheck }]
      : []),
    { label: "Company Bulletin", href: "/announcements", icon: Megaphone },
    { label: "Holiday Calendar", href: "/holidays", icon: CalendarCheck2 },
    ...(isAdmin
      ? [
          { label: "Roles & Governance", href: "/roles", icon: ShieldCheck },
          { label: "Security Audit Logs", href: "/audit-logs", icon: ShieldCheck },
        ]
      : []),
  ];

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  const handleSignOut = () => {
    logout(router);
  };

  return (
    <div className="studio-floating-nav-wrapper">
      <nav className="studio-floating-nav-island" aria-label="Main floating navigation">
        {/* Core Primary Navigation Pills */}
        {navItems.map((item) => {
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

        {/* More ▾ Dropdown Capsule */}
        <div className="capsule-dropdown-trigger" ref={moreRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`studio-nav-item ${isMoreActive ? "active" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: isMoreOpen ? "rgba(0, 0, 0, 0.06)" : undefined,
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
            <div className="capsule-dropdown-menu">
              {moreItems.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={`capsule-dropdown-item ${active ? "active" : ""}`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings Pill (Direct link to Settings/Profile) */}
        <Link
          href="/profile"
          className={`studio-nav-item ${pathname.startsWith("/profile") ? "active" : ""}`}
        >
          Settings
        </Link>

        {/* Subtle Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border-subtle, rgba(0, 0, 0, 0.1))",
            margin: "0 4px",
            flexShrink: 0,
          }}
        />

        {/* Notification Bell Popover */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="action-icon-btn"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: isNotifOpen ? "var(--bg-surface-active)" : "transparent",
              border: "none",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: isNotifOpen ? "#ca8a04" : "#52525b",
            }}
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#f43f5e",
                }}
              />
            )}
          </button>

          {isNotifOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                right: 0,
                width: 360,
                maxWidth: "calc(100vw - 32px)",
                background: "var(--bg-card, #ffffff)",
                borderRadius: "var(--radius-lg, 16px)",
                border: "1px solid var(--border-strong, rgba(0,0,0,0.1))",
                boxShadow: "var(--shadow-xl, 0 20px 48px -8px rgba(0,0,0,0.12))",
                zIndex: 60,
                overflow: "hidden",
                animation: "modalEnter 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--bg-surface-elevated, #f7f5ee)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: "#fef08a",
                        color: "#713f12",
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
                      color: "#b45309",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {announcements.map((ann, idx) => (
                  <Link
                    key={ann.public_id}
                    href="/announcements"
                    onClick={() => setIsNotifOpen(false)}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      textDecoration: "none",
                      background: idx < unreadCount ? "rgba(254, 240, 138, 0.14)" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: ann.priority === "Urgent" ? "rgba(244, 63, 94, 0.15)" : "#fef08a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {ann.priority === "Urgent" ? (
                        <AlertCircle size={14} style={{ color: "#e11d48" }} />
                      ) : (
                        <Megaphone size={14} style={{ color: "#713f12" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: "0.82rem",
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
                      <p
                        style={{
                          fontSize: "0.74rem",
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
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subtle Theme Toggle */}
        <ThemeToggle />

        {/* User Avatar Circle */}
        <div style={{ position: "relative" }} ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 2,
            }}
            title={mounted ? (user?.display_name || "Account") : "Account"}
            aria-label="User Account"
          >
            <Avatar name={mounted ? (user?.display_name || "User") : "User"} size={30} ring={true} />
          </button>

          {isUserMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: 240,
                background: "var(--bg-card, #ffffff)",
                backdropFilter: "blur(24px)",
                border: "1px solid var(--border-strong, rgba(0,0,0,0.1))",
                borderRadius: "var(--radius-lg, 16px)",
                boxShadow: "var(--shadow-xl, 0 20px 48px -8px rgba(0,0,0,0.12))",
                padding: "8px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                animation: "modalEnter 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border-subtle)",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {user?.display_name || "Corporate User"}
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  {user?.email}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "#fef08a",
                    color: "#713f12",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                  }}
                >
                  <Shield size={11} />
                  <span>{String(role || "Employee").replace(/_/g, " ")}</span>
                </div>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsUserMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md, 10px)",
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
                  onClick={() => setIsUserMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md, 10px)",
                    color: "var(--text-secondary)",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  <ShieldCheck size={15} style={{ color: "#ca8a04" }} />
                  <span>Roles & Governance</span>
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
                  borderRadius: "var(--radius-md, 10px)",
                  color: "var(--color-rose-500)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
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
      </nav>
    </div>
  );
}

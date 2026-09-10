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
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Avatar } from "../ui/Avatar";
import { CapsuleNav } from "./CapsuleNav";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import { Announcement } from "@/types/announcement";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isHR, isAdmin, logout, mounted } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  // Notification Center Popover
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/employees?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = () => {
    logout(router);
  };

  return (
    <header
      style={{
        height: "var(--topbar-height, 64px)",
        background: "var(--bg-glass, rgba(247, 245, 238, 0.92))",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 40,
        transition: "background-color var(--transition-base)",
        gap: 16,
      }}
    >
      {/* ── Left Area: Crextio Brand Capsule ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 180 }}>
        <Link href="/dashboard" className="crextio-brand-pill" title="Crextio Studio Workspace">
          <span className="crextio-brand-icon">✦</span>
          <span className="crextio-brand-text">Crextio</span>
          <span
            style={{
              fontSize: "0.68rem",
              padding: "1px 7px",
              borderRadius: 9999,
              background: "#fef08a",
              color: "#713f12",
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            EMS
          </span>
        </Link>
      </div>

      {/* ── Center Area: Floating Studio Capsule Navigation (All Features) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flex: 2,
          minWidth: 0,
        }}
      >
        <CapsuleNav />
      </div>

      {/* ── Right Area: Fast Search, Settings, Notifications, Theme, User Profile ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 260,
          justifyContent: "flex-end",
        }}
      >
        {/* Search Bar Pill */}
        <div style={{ maxWidth: 210, width: "100%" }}>
          <div className="glass-search-pill">
            <Search size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search people..."
              className="glass-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search people"
            />
          </div>
        </div>

        {/* Quick Settings Shortcut */}
        <Link
          href="/profile"
          className="action-icon-btn"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: pathname === "/profile" ? "var(--bg-surface-active)" : "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          title="Account Settings & Profile"
          aria-label="Settings"
        >
          <Settings size={17} />
        </Link>

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            title="Bulletins & Notifications"
            aria-label="View notifications"
          >
            <Bell size={17} style={{ color: isNotifOpen ? "#ca8a04" : "var(--text-secondary)" }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 7,
                  right: 8,
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
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Announcements List */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {announcements.map((ann, idx) => (
                  <Link
                    key={ann.public_id}
                    href="/announcements"
                    onClick={() => setIsNotifOpen(false)}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "14px 18px",
                      borderBottom: "1px solid var(--border-subtle)",
                      textDecoration: "none",
                      background: idx < unreadCount ? "rgba(254, 240, 138, 0.14)" : "transparent",
                      transition: "background var(--transition-fast)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: ann.priority === "Urgent" ? "rgba(244, 63, 94, 0.15)" : "#fef08a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {ann.priority === "Urgent" ? (
                        <AlertCircle size={15} style={{ color: "#e11d48" }} />
                      ) : (
                        <Megaphone size={15} style={{ color: "#713f12" }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
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
                              background: "#eab308",
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
                    color: "#854d0e",
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

        {/* Theme Toggle (Sun/Moon) */}
        <ThemeToggle />

        {/* User Account Menu Capsule */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            suppressHydrationWarning
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px 4px 4px",
              borderRadius: "9999px",
              border: "1px solid var(--border-subtle)",
              background: isMenuOpen ? "var(--bg-surface-active)" : "var(--bg-surface-elevated)",
              backdropFilter: "blur(16px)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
            title="User Profile & Session"
            aria-label="User Account"
          >
            <Avatar name={mounted ? (user?.display_name || "User") : "Corporate User"} size={32} ring={true} />
            <div suppressHydrationWarning style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, textAlign: "left" }}>
              <span suppressHydrationWarning style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {mounted ? (user?.display_name || "User") : "Corporate User"}
              </span>
              <span suppressHydrationWarning style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                {mounted ? String(role || "Employee").replace(/_/g, " ") : "Employee"}
              </span>
            </div>
            <ChevronDown
              size={13}
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
                width: 250,
                background: "var(--bg-card, #ffffff)",
                backdropFilter: "blur(24px)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xl)",
                padding: "8px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                animation: "modalEnter 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
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
                    background: "#fef08a",
                    color: "#713f12",
                    fontSize: "0.72rem",
                    fontWeight: 700,
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
                  borderRadius: "var(--radius-md)",
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
      </div>
    </header>
  );
}

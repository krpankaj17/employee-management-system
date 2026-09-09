"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  CalendarDays,
  WalletCards,
  FolderKanban,
  Award,
  Building2,
  Megaphone,
  CalendarCheck2,
  ShieldCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { UserRole } from "@/types/common";
import { API_CONFIG } from "@/lib/config";
import { api } from "@/lib/apiClient";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  allowedRoles: UserRole[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Employees",
    href: "/employees",
    icon: <Users size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager"],
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: <Clock size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: <WalletCards size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Leave Management",
    href: "/leaves",
    icon: <CalendarDays size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "User Approvals",
    href: "/approvals",
    icon: <UserCheck size={20} />,
    allowedRoles: ["Admin", "HR_Manager"],
  },
  {
    label: "Projects",
    href: "/projects",
    icon: <FolderKanban size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Performance Reviews",
    href: "/reviews",
    icon: <Award size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Departments",
    href: "/departments",
    icon: <Building2 size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head"],
  },
  {
    label: "Announcements",
    href: "/announcements",
    icon: <Megaphone size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Holiday Calendar",
    href: "/holidays",
    icon: <CalendarCheck2 size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    icon: <ShieldCheck size={20} />,
    allowedRoles: ["Admin"],
  },
  {
    label: "Security Audit Logs",
    href: "/audit-logs",
    icon: <ShieldCheck size={20} />,
    allowedRoles: ["Admin"],
  },
  {
    label: "Settings",
    href: "/profile",
    icon: <Settings size={20} />,
    allowedRoles: ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, mounted, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  // Clear optimistic active state when route finishes navigating
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", collapsed ? "94px" : "256px");
    }
  }, [collapsed]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", next ? "94px" : "256px");
      document.documentElement.setAttribute("data-sidebar-collapsed", next ? "true" : "false");
    }
  };

  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPending = async () => {
      if (role === "Admin" || role === "HR_Manager") {
        try {
          const pending = await api.auth.listPendingUsers();
          if (isMounted) setPendingCount(pending.length);
        } catch (e) {
          if (isMounted) setPendingCount(0);
        }
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    window.addEventListener("refresh-pending-count", fetchPending);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("refresh-pending-count", fetchPending);
    };
  }, [role]);

  const activeRole = mounted ? role : "Employee";
  const visibleItems = NAV_ITEMS.filter((item) => item.allowedRoles.includes(activeRole)).map((item) => {
    if (item.href === "/approvals") {
      return {
        ...item,
        badge: pendingCount > 0 ? String(pendingCount) : undefined,
      };
    }
    if (item.href === "/payroll" && activeRole === "Employee") {
      return {
        ...item,
        label: "My Payslips",
      };
    }
    return item;
  });

  // Preload all dashboard section chunks in the background for zero-latency instant transitions
  useEffect(() => {
    const prefetchRoutes = () => {
      visibleItems.forEach((item) => {
        try {
          router.prefetch(item.href);
        } catch (e) {}
      });
    };

    if (typeof window !== "undefined") {
      const timer = setTimeout(prefetchRoutes, 50);
      return () => clearTimeout(timer);
    }
  }, [router, activeRole]);

  return (
    <aside
      style={{
        width: collapsed ? "74px" : "240px",
        background: "var(--bg-sidebar, rgba(14, 16, 28, 0.70))",
        border: "1px solid var(--border-glass, rgba(255, 255, 255, 0.09))",
        borderRadius: "24px",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: "16px",
        bottom: "16px",
        left: "16px",
        height: "calc(100vh - 32px)",
        zIndex: 50,
        transition: "width var(--transition-smooth)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)",
        overflow: "hidden",
      }}
    >
      {/* Header / Brand */}
      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 14px",
          borderBottom: "1px solid var(--border-glass, rgba(255, 255, 255, 0.06))",
        }}
      >
        {collapsed ? (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.02em",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(6, 182, 212, 0.4)",
            }}
            onClick={toggleCollapse}
            title="Expand sidebar"
          >
            EMS
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(6, 182, 212, 0.35)",
                }}
              >
                EMS
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Employee Management
                </span>
                <span style={{ fontSize: "0.68rem", color: "var(--color-cyan-400)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  System
                </span>
              </div>
            </div>
            <button
              onClick={toggleCollapse}
              className="btn btn-ghost"
              style={{ padding: 6, borderRadius: "50%", color: "var(--text-muted)", cursor: "pointer" }}
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {visibleItems.map((item) => {
          const effectivePath = optimisticPath || pathname;
          const isActive = effectivePath === item.href || (item.href !== "/dashboard" && effectivePath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onMouseEnter={() => {
                try { router.prefetch(item.href); } catch (e) {}
              }}
              onFocus={() => {
                try { router.prefetch(item.href); } catch (e) {}
              }}
              onPointerDown={() => {
                setOptimisticPath(item.href);
                try { router.prefetch(item.href); } catch (e) {}
              }}
              onClick={() => setOptimisticPath(item.href)}
              title={collapsed ? item.label : undefined}
              className={`sidebar-nav-link ${isActive ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "11px 0" : "10px 14px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "14px",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--bg-surface-active)" : "transparent",
                border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.88rem",
                position: "relative",
                transition: "all var(--transition-fast)",
                width: "100%",
              }}
            >
              <span
                style={{
                  color: isActive ? "var(--color-cyan-400)" : "inherit",
                  display: "flex",
                  alignItems: "center",
                  filter: isActive ? "drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))" : "none",
                  transition: "color var(--transition-fast), filter var(--transition-fast)",
                }}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
              {!collapsed && item.badge && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "10px",
                    background: isActive ? "rgba(6, 182, 212, 0.25)" : "rgba(255, 255, 255, 0.1)",
                    color: isActive ? "var(--color-cyan-400)" : "var(--text-muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "14px 10px",
          borderTop: "1px solid var(--border-glass, rgba(255, 255, 255, 0.06))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {!collapsed && (
          <div style={{ paddingInline: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-emerald-400)", boxShadow: "0 0 8px var(--color-emerald-400)" }} />
              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                {String(role || "Employee").replace(/_/g, " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => logout(router)}
              className="action-icon-btn"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => logout(router)}
            className="action-icon-btn"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}

"use client";

import React, { useEffect, useState, useRef } from "react";
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

// Prefetch tab dataset into memory cache for instant 0ms transitions
function prefetchTabData(href: string, employeePublicId?: string | null, isEmployeeRole?: boolean) {
  try {
    switch (href) {
      case "/employees":
        api.employees.search({ skip: 0, limit: 10 }).catch(() => {});
        api.departments.list().catch(() => {});
        api.designations.list().catch(() => {});
        api.dashboard.getSummary().catch(() => {});
        break;
      case "/attendance": {
        const empId = isEmployeeRole && employeePublicId ? employeePublicId : undefined;
        api.attendance.getRecords({ limit: 500, employee_public_id: empId }).catch(() => {});
        api.employees.list({ limit: 100 }).catch(() => {});
        api.leaves.getRequests({ limit: 100, employee_public_id: empId }).catch(() => {});
        if (isEmployeeRole) {
          api.leaves.getBalances().catch(() => {});
        }
        api.attendance.getSettings().catch(() => {});
        break;
      }
      case "/leaves":
        api.leaves.getBalances().catch(() => {});
        api.leaves.getRequests().catch(() => {});
        api.leaves.listTypes().catch(() => {});
        break;
      case "/projects":
        api.projects.list().catch(() => {});
        break;
      case "/departments":
        api.departments.list().catch(() => {});
        api.departments.listDesignations().catch(() => {});
        break;
      case "/roles":
        api.auth.listRolesDetailed().catch(() => {});
        api.auth.listPermissions().catch(() => {});
        break;
      case "/approvals":
        api.auth.listPendingUsers().catch(() => {});
        break;
      case "/announcements":
        api.announcements.list().catch(() => {});
        break;
      case "/holidays":
        api.holidays.list().catch(() => {});
        break;
    }
  } catch (e) {}
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, isEmployee, mounted, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const hoverTimerRef = useRef<any>(null);

  const handleLinkMouseEnter = (href: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      try { router.prefetch(href); } catch (e) {}
      prefetchTabData(href, user?.employee_public_id, isEmployee);
    }, 150);
  };

  const handleLinkMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleImmediatePrefetch = (href: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    try { router.prefetch(href); } catch (e) {}
    prefetchTabData(href, user?.employee_public_id, isEmployee);
  };

  // Load saved preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ems_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch (e) {}
  }, []);

  // Clear optimistic active state when route finishes navigating
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", collapsed ? "72px" : "250px");
      document.documentElement.setAttribute("data-sidebar-collapsed", collapsed ? "true" : "false");
    }
  }, [collapsed]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("ems_sidebar_collapsed", String(next));
    } catch (e) {}
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-width", next ? "72px" : "250px");
      document.documentElement.setAttribute("data-sidebar-collapsed", next ? "true" : "false");
    }
  };

  useEffect(() => {
    const handleGlobalToggle = () => {
      toggleCollapse();
    };
    window.addEventListener("ems_toggle_sidebar", handleGlobalToggle);
    return () => window.removeEventListener("ems_toggle_sidebar", handleGlobalToggle);
  }, [collapsed]);

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



  // Approach B: Silently pre-warm top 2 visited tabs when browser is idle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const warmIdle = () => {
      prefetchTabData("/employees");
      prefetchTabData("/attendance");
    };
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(warmIdle, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const timer = setTimeout(warmIdle, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeRole]);

  return (
    <aside
      className="app-sidebar"
      style={{
        width: collapsed ? "72px" : "250px",
        background: "var(--bg-sidebar, var(--bg-surface))",
        borderRight: "1px solid var(--border-subtle)",
        borderTop: "none",
        borderLeft: "none",
        borderBottom: "none",
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        height: "100vh",
        zIndex: 50,
        transition: "width var(--transition-smooth)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: collapsed
          ? "2px 0 16px rgba(0, 0, 0, 0.08)"
          : "4px 0 24px rgba(0, 0, 0, 0.14)",
        overflow: "visible",
      }}
    >

      {/* Header / Brand */}
      <div
        style={{
          height: "var(--topbar-height, 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "0 10px" : "0 16px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
            onClick={toggleCollapse}
            title="Click to expand sidebar"
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
                boxShadow: "0 0 16px rgba(6, 182, 212, 0.4)",
                transition: "transform var(--transition-fast)",
              }}
            >
              EMS
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.76rem",
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
                    fontSize: "0.86rem",
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
                <span style={{ fontSize: "0.68rem", color: "var(--color-cyan-400)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  System Portal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleCollapse}
              className="action-icon-btn"
              style={{
                width: 30,
                height: 30,
                borderRadius: "8px",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav
        className="sidebar-nav-container"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: collapsed ? "14px 8px" : "14px 12px",
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
              aria-label={item.label}
              prefetch={true}
              onMouseEnter={() => handleLinkMouseEnter(item.href)}
              onMouseLeave={handleLinkMouseLeave}
              onFocus={() => handleImmediatePrefetch(item.href)}
              onPointerDown={() => {
                setOptimisticPath(item.href);
                handleImmediatePrefetch(item.href);
              }}
              onClick={() => setOptimisticPath(item.href)}
              className={`sidebar-nav-link ${isActive ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "10px 0" : "10px 14px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "12px",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--bg-surface-active)" : "transparent",
                border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.88rem",
                position: "relative",
                transition: "all var(--transition-fast)",
                width: "100%",
                textDecoration: "none",
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

              {/* Instant sleek tooltip when collapsed */}
              {collapsed && (
                <span className="sidebar-hover-tooltip">
                  {item.label}
                  {item.badge ? ` (${item.badge})` : ""}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: collapsed ? "12px 6px" : "14px 14px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-emerald-400)", boxShadow: "0 0 8px var(--color-emerald-400)" }} />
              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                {String(role || "Employee").replace(/_/g, " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => logout(router)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "8px 12px",
                fontSize: "0.82rem",
                fontWeight: 600,
                borderRadius: "8px",
                color: "#e11d48",
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.22)",
                cursor: "pointer",
                transition: "all 140ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(244, 63, 94, 0.16)";
                e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(244, 63, 94, 0.08)";
                e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.22)";
              }}
              title="Sign out"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => logout(router)}
            title="Sign out"
            aria-label="Sign out"
            style={{
              width: 42,
              height: 42,
              borderRadius: "10px",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              background: "rgba(244, 63, 94, 0.08)",
              color: "#e11d48",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
              transition: "all 140ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(244, 63, 94, 0.18)";
              e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(244, 63, 94, 0.08)";
              e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.25)";
            }}
          >
            <LogOut size={18} />
            <span className="sidebar-hover-tooltip">Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  WalletCards,
  FolderKanban,
  Award,
  Building2,
  ChevronDown,
  UserCheck,
  Megaphone,
  CalendarCheck2,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface PrimaryNav {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOrHrOnly?: boolean;
}

const PRIMARY_NAVS: PrimaryNav[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/employees", icon: Users, adminOrHrOnly: true },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Leaves", href: "/leaves", icon: CalendarDays },
  { name: "Salary", href: "/payroll", icon: WalletCards },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Reviews", href: "/reviews", icon: Award },
  { name: "Departments", href: "/departments", icon: Building2 },
];

export function CapsuleNav() {
  const pathname = usePathname();
  const { role, isHR, isAdmin } = useAuth();
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

  const isPrimaryActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const moreItems = [
    ...(isAdmin || isHR
      ? [{ name: "User Approvals", href: "/approvals", icon: UserCheck }]
      : []),
    { name: "Hiring & Onboarding", href: "/onboarding-pending", icon: UserCheck },
    { name: "Company Bulletin", href: "/announcements", icon: Megaphone },
    { name: "Holiday Calendar", href: "/holidays", icon: CalendarCheck2 },
    ...(isAdmin
      ? [
          { name: "Role Governance", href: "/roles", icon: ShieldCheck },
          { name: "Security Audit Logs", href: "/audit-logs", icon: ShieldCheck },
        ]
      : []),
  ];

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  // Filter primary nav based on role
  const visiblePrimaryNavs = PRIMARY_NAVS.filter((item) => {
    if (item.adminOrHrOnly && role === "Employee") {
      return false; // Employees access their personal records in dashboard / profile
    }
    return true;
  });

  return (
    <nav className="capsule-nav-wrapper" aria-label="Studio Main Navigation">
      <div className="capsule-nav-bar">
        {visiblePrimaryNavs.map((item) => {
          const active = isPrimaryActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`capsule-tab-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={15} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* More Dropdown Capsule for complete feature accessibility */}
        <div className="capsule-dropdown-trigger" ref={moreRef}>
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`capsule-tab-item ${isMoreActive ? "active" : ""}`}
            style={{
              background: isMoreOpen ? "rgba(0, 0, 0, 0.08)" : undefined,
              border: "none",
            }}
            aria-expanded={isMoreOpen}
          >
            <span>More</span>
            <ChevronDown
              size={13}
              style={{
                transform: isMoreOpen ? "rotate(180deg)" : "rotate(0deg)",
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
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

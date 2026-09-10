"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  WalletCards,
  FolderKanban,
  Award,
  LucideIcon,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon?: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "People", href: "/employees", icon: Users },
  { name: "Hiring", href: "/onboarding-pending", icon: UserCheck },
  { name: "Attendance", href: "/attendance", icon: Clock },
  { name: "Salary", href: "/payroll", icon: WalletCards },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Reviews", href: "/reviews", icon: Award },
];

export function CapsuleNav() {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="capsule-nav-wrapper"
      aria-label="Studio Main Navigation"
      role="tablist"
    >
      <div className="capsule-nav-bar">
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`capsule-tab-item ${active ? "active" : ""}`}
              role="tab"
              aria-selected={active}
            >
              {Icon && <Icon size={15} />}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

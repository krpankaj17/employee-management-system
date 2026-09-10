"use client";

import React, { useState } from "react";
import {
  Users,
  DollarSign,
  Clock,
  Briefcase,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Check,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";

type ThemeDirection = "linear" | "stripe" | "vercel";

export default function DesignDemoPreviewPage() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeDirection>("linear");
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "engineering" | "sales" | "hr">("all");

  const themes = [
    {
      id: "linear" as const,
      name: "Direction 1: Linear / Raycast Pro",
      tagline: "High-Craft Dark Slate • Precision Density • Indigo & Cyan Accents",
      badge: "Popular with Engineers & Power Users",
      desc: "Deep slate zinc (#0B0F19), razor-sharp sub-pixel 1px borders (#1F293D), tabular typography, zero blurry neon blooms, and compact enterprise layout.",
    },
    {
      id: "stripe" as const,
      name: "Direction 2: Stripe & Rippling White-Glove",
      tagline: "Luminous Modern Light • Royal Sapphire • Executive Readability",
      badge: "Enterprise Standard for HR & Executive Portals",
      desc: "Warm off-white canvas (#F8FAFC), pristine white cards with subtle multi-layer elevation shadows, deep navy headers (#0F172A), and clean corporate typography.",
    },
    {
      id: "vercel" as const,
      name: "Direction 3: Vercel / Supabase Minimalist",
      tagline: "True Monochrome Obsidian • Hairline Geometric Gridlines • High Contrast",
      badge: "Clean Precision & Zero Clutter",
      desc: "Pure true blacks (#000000), crisp 1px hairline dividers (#222222), monospaced numeric tabular data, and purposeful micro status dots.",
    },
  ];

  const sampleStats = [
    {
      label: "Total Personnel",
      value: "1,248",
      change: "+3.2%",
      trend: "up",
      detail: "vs. 1,209 last month",
      icon: Users,
    },
    {
      label: "Monthly Payroll Run",
      value: "$482,900",
      change: "+1.8%",
      trend: "up",
      detail: "Scheduled for Sep 30",
      icon: DollarSign,
    },
    {
      label: "On-Time Attendance",
      value: "97.4%",
      change: "+0.6%",
      trend: "up",
      detail: "Average punch 08:52 AM",
      icon: Clock,
    },
    {
      label: "Active Projects",
      value: "18",
      change: "On Track",
      trend: "neutral",
      detail: "4 pending milestones",
      icon: Briefcase,
    },
  ];

  const sampleEmployees = [
    {
      id: "EMP-1042",
      name: "Sarah Jones",
      role: "Lead Systems Architect",
      department: "Engineering",
      attendance: "Checked In",
      statusColor: "#10b981",
      salary: "$142,000",
      avatar: "SJ",
      email: "sarah.j@company.com",
    },
    {
      id: "EMP-1043",
      name: "Danie Harrison",
      role: "Staff Product Designer",
      department: "Design",
      attendance: "Remote Office",
      statusColor: "#06b6d4",
      salary: "$128,000",
      avatar: "DH",
      email: "danie.h@company.com",
    },
    {
      id: "EMP-1044",
      name: "Marcus Vance",
      role: "Director of People Ops",
      department: "Human Resources",
      attendance: "Checked In",
      statusColor: "#10b981",
      salary: "$135,000",
      avatar: "MV",
      email: "marcus.v@company.com",
    },
    {
      id: "EMP-1045",
      name: "Elena Rostova",
      role: "VP of Enterprise Sales",
      department: "Sales",
      attendance: "Client Visit",
      statusColor: "#f59e0b",
      salary: "$165,000",
      avatar: "ER",
      email: "elena.r@company.com",
    },
    {
      id: "EMP-1046",
      name: "Kevin Chen",
      role: "Cloud DevOps Engineer",
      department: "Engineering",
      attendance: "On Leave",
      statusColor: "#94a3b8",
      salary: "$118,000",
      avatar: "KC",
      email: "kevin.c@company.com",
    },
  ];

  const filteredEmployees = sampleEmployees.filter((e) => {
    if (activeTab !== "all" && e.department.toLowerCase() !== activeTab) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Style Tokens per Theme
  const getThemeStyles = () => {
    switch (selectedTheme) {
      case "linear":
        return {
          wrapperBg: "#0B0F19",
          cardBg: "#111726",
          cardBorder: "1px solid #1F293D",
          headerBg: "#141C2E",
          textColor: "#F1F5F9",
          textMuted: "#94A3B8",
          tableHeaderBg: "#0E1422",
          tableRowHover: "#161F33",
          primaryBtnBg: "#4F46E5",
          primaryBtnColor: "#FFFFFF",
          primaryBtnBorder: "1px solid #6366F1",
          secondaryBtnBg: "#192236",
          secondaryBtnColor: "#E2E8F0",
          secondaryBtnBorder: "1px solid #27354F",
          accentColor: "#6366F1",
          badgeBg: "rgba(99, 102, 241, 0.12)",
          badgeColor: "#A5B4FC",
          badgeBorder: "1px solid rgba(99, 102, 241, 0.25)",
          shadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
        };
      case "stripe":
        return {
          wrapperBg: "#F8FAFC",
          cardBg: "#FFFFFF",
          cardBorder: "1px solid #E2E8F0",
          headerBg: "#FFFFFF",
          textColor: "#0F172A",
          textMuted: "#64748B",
          tableHeaderBg: "#F1F5F9",
          tableRowHover: "#F8FAFC",
          primaryBtnBg: "#1D4ED8",
          primaryBtnColor: "#FFFFFF",
          primaryBtnBorder: "1px solid #1E40AF",
          secondaryBtnBg: "#FFFFFF",
          secondaryBtnColor: "#334155",
          secondaryBtnBorder: "1px solid #CBD5E1",
          accentColor: "#2563EB",
          badgeBg: "rgba(37, 99, 235, 0.08)",
          badgeColor: "#1D4ED8",
          badgeBorder: "1px solid rgba(37, 99, 235, 0.2)",
          shadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.03)",
        };
      case "vercel":
      default:
        return {
          wrapperBg: "#000000",
          cardBg: "#0A0A0A",
          cardBorder: "1px solid #222222",
          headerBg: "#0E0E0E",
          textColor: "#EDEDED",
          textMuted: "#888888",
          tableHeaderBg: "#050505",
          tableRowHover: "#121212",
          primaryBtnBg: "#FFFFFF",
          primaryBtnColor: "#000000",
          primaryBtnBorder: "1px solid #FFFFFF",
          secondaryBtnBg: "#111111",
          secondaryBtnColor: "#CCCCCC",
          secondaryBtnBorder: "1px solid #333333",
          accentColor: "#F59E0B",
          badgeBg: "#181818",
          badgeColor: "#FAFAFA",
          badgeBorder: "1px solid #333333",
          shadow: "none",
        };
    }
  };

  const currentStyles = getThemeStyles();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      {/* Top Banner: UI/UX Pro Max Intelligence Showcase */}
      <div
        style={{
          padding: "24px 28px",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(6, 182, 212, 0.08) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.28)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                UI/UX Pro Max • Enterprise Design System Studio
              </h1>
              <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", margin: 0 }}>
                Compare 3 production-grade, anti-vibe-coded visual directions live. Test components, tables, and typography, then approve your preferred style.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              showToast.success(`Selected ${themes.find((t) => t.id === selectedTheme)?.name}! Please let the assistant know to apply this.`);
            }}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", fontWeight: 700 }}
          >
            <Check size={16} /> Approve & Apply {selectedTheme.toUpperCase()}
          </button>
        </div>

        {/* Theme Direction Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
            marginTop: 8,
          }}
        >
          {themes.map((theme) => {
            const isSelected = selectedTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: isSelected ? "rgba(99, 102, 241, 0.18)" : "var(--bg-surface)",
                  border: isSelected ? "2px solid #6366f1" : "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: isSelected ? "#fff" : "var(--text-primary)" }}>
                    {theme.name}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "#4f46e5",
                        color: "#fff",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Check size={11} /> Active Demo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.78rem", color: isSelected ? "#c7d2fe" : "var(--text-muted)", fontWeight: 600 }}>
                  {theme.tagline}
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {theme.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Interactive Sandbox Preview Container */}
      <div
        style={{
          background: currentStyles.wrapperBg,
          borderRadius: 20,
          border: currentStyles.cardBorder,
          boxShadow: currentStyles.shadow,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          transition: "all 0.3s ease",
        }}
      >
        {/* Sandbox Topbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            borderBottom: currentStyles.cardBorder,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: currentStyles.textColor, letterSpacing: "-0.02em", margin: 0 }}>
                Personnel & Executive Dashboard
              </h2>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 6,
                  background: currentStyles.badgeBg,
                  color: currentStyles.badgeColor,
                  border: currentStyles.badgeBorder,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {selectedTheme} Mode
              </span>
            </div>
            <p style={{ fontSize: "0.84rem", color: currentStyles.textMuted, margin: "4px 0 0" }}>
              Enterprise Resource Planning • Real-Time Workforce Overview
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: currentStyles.secondaryBtnBg,
                color: currentStyles.secondaryBtnColor,
                border: currentStyles.secondaryBtnBorder,
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Calendar size={14} /> Export Report
            </button>
            <button
              type="button"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: currentStyles.primaryBtnBg,
                color: currentStyles.primaryBtnColor,
                border: currentStyles.primaryBtnBorder,
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} /> Add Employee
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {sampleStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                style={{
                  background: currentStyles.cardBg,
                  border: currentStyles.cardBorder,
                  borderRadius: 14,
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "transform 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: currentStyles.textMuted }}>
                    {stat.label}
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: currentStyles.badgeBg,
                      color: currentStyles.accentColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={16} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: "1.85rem", fontWeight: 800, color: currentStyles.textColor, letterSpacing: "-0.03em", fontFamily: "var(--font-sans, inherit)" }}>
                    {stat.value}
                  </span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: stat.trend === "up" ? "#10b981" : "#64748b",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    {stat.trend === "up" && <ArrowUpRight size={13} />}
                    {stat.change}
                  </span>
                </div>

                <div style={{ fontSize: "0.76rem", color: currentStyles.textMuted }}>
                  {stat.detail}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table & Controls Section */}
        <div
          style={{
            background: currentStyles.cardBg,
            border: currentStyles.cardBorder,
            borderRadius: 14,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Table Toolbar */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: currentStyles.cardBorder,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            {/* Department Filter Tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(["all", "engineering", "sales", "hr"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? currentStyles.primaryBtnBg : "transparent",
                      color: isActive ? currentStyles.primaryBtnColor : currentStyles.textMuted,
                      border: "none",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab === "all" ? "All Departments" : tab}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 12, color: currentStyles.textMuted }} />
              <input
                type="text"
                placeholder="Search staff, role, ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  padding: "7px 12px 7px 34px",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  background: currentStyles.tableHeaderBg,
                  color: currentStyles.textColor,
                  border: currentStyles.cardBorder,
                  outline: "none",
                  width: 220,
                }}
              />
            </div>
          </div>

          {/* Table Records */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ background: currentStyles.tableHeaderBg, borderBottom: currentStyles.cardBorder }}>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Employee
                  </th>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Role & Title
                  </th>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Department
                  </th>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>
                    Compensation
                  </th>
                  <th style={{ padding: "12px 18px", color: currentStyles.textMuted, fontWeight: 600, fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    style={{
                      borderBottom: currentStyles.cardBorder,
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = currentStyles.tableRowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: currentStyles.badgeBg,
                            color: currentStyles.accentColor,
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {emp.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: currentStyles.textColor }}>{emp.name}</div>
                          <div style={{ fontSize: "0.74rem", color: currentStyles.textMuted, fontFamily: "monospace" }}>
                            {emp.id} • {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px", color: currentStyles.textColor, fontWeight: 500 }}>
                      {emp.role}
                    </td>

                    <td style={{ padding: "14px 18px", color: currentStyles.textMuted }}>
                      {emp.department}
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 9px",
                          borderRadius: 20,
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          background: `${emp.statusColor}18`,
                          color: emp.statusColor,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: emp.statusColor,
                          }}
                        />
                        {emp.attendance}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: currentStyles.textColor, fontFamily: "var(--font-mono, monospace)" }}>
                      {emp.salary}
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "center" }}>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: currentStyles.textMuted,
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 4,
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: currentStyles.tableHeaderBg,
              fontSize: "0.78rem",
              color: currentStyles.textMuted,
            }}
          >
            <span>Showing {filteredEmployees.length} of {sampleEmployees.length} active enterprise records</span>
            <span style={{ fontFamily: "monospace" }}>Page 1 of 1 • Latency: 12ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

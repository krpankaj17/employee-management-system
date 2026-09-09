"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  ShieldAlert,
  Shield,
  Download,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Info,
  Activity,
  Layers,
  User,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { AuditLog } from "@/types/audit";
import { StatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { useAuth } from "@/lib/auth";

export default function AuditLogsPage() {
  const { role, isAdmin, mounted } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "info" | "warning" | "critical">("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadAuditLogs();
    } else if (mounted && !isAdmin) {
      setLoading(false);
    }
  }, [mounted, isAdmin]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await api.audit.list();
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Modules list extracted dynamically from logs
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return logs.filter((l) => {
      const matchesSearch =
        !q ||
        (l.action || "").toLowerCase().includes(q) ||
        (l.actor_name || "").toLowerCase().includes(q) ||
        (l.actor_email || "").toLowerCase().includes(q) ||
        (l.module || "").toLowerCase().includes(q) ||
        (l.ip_address || "").toLowerCase().includes(q) ||
        (l.details || "").toLowerCase().includes(q);

      const matchesSeverity = severityFilter === "all" || l.severity === severityFilter;
      const matchesModule = moduleFilter === "all" || l.module.toLowerCase() === moduleFilter.toLowerCase();

      return matchesSearch && matchesSeverity && matchesModule;
    });
  }, [logs, search, severityFilter, moduleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const critical = logs.filter((l) => l.severity === "critical").length;
    const warning = logs.filter((l) => l.severity === "warning").length;
    const uniqueActors = new Set(logs.map((l) => l.actor_email || l.actor_name)).size;
    return { total, critical, warning, uniqueActors };
  }, [logs]);

  // Paginated items
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Log ID", "Timestamp", "Severity", "Action", "Module", "Actor Name", "Actor Email", "IP Address", "Details"];
    const rows = filteredLogs.map((l) => [
      l.log_id,
      `"${l.timestamp || ""}"`,
      `"${l.severity}"`,
      `"${(l.action || "").replace(/"/g, '""')}"`,
      `"${(l.module || "").replace(/"/g, '""')}"`,
      `"${(l.actor_name || "").replace(/"/g, '""')}"`,
      `"${(l.actor_email || "").replace(/"/g, '""')}"`,
      `"${l.ip_address || ""}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `security_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: 650, margin: "40px auto" }}>
        <ShieldAlert size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted to Super Administrators
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          Forensic immutable audit logs and security event streams are strictly restricted to <strong>Super Administrators</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary-400)" }}>
              <Shield size={20} />
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Security & Audit Trail
            </h1>
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Immutable append-only activity stream, system event forensic tracking, and compliance enforcement
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="btn btn-secondary"
            title="Refresh audit trail"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Download size={15} />
            Export CSV
          </button>

          <Link
            href="/roles"
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
          >
            <Layers size={15} />
            RBAC & Roles Management
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.12)", color: "var(--color-primary-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Total Logged Events
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {stats.total.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.12)", color: "var(--color-rose-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Critical Security Events
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stats.critical > 0 ? "var(--color-rose-400)" : "var(--text-primary)" }}>
              {stats.critical}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "rgba(245, 158, 11, 0.12)", color: "var(--color-amber-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              State Mutations / Warnings
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {stats.warning}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.12)", color: "var(--color-emerald-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Active Operators
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {stats.uniqueActors}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="card" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", flex: 1, minWidth: 320 }}>
          {/* Search Box */}
          <div style={{ position: "relative", minWidth: 280, flex: "1 1 300px" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: 12, color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search by action, actor, email, IP, or details..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field"
              style={{ paddingLeft: 40 }}
            />
          </div>

          {/* Module Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Module:</span>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
              style={{ padding: "8px 12px", width: "auto", minWidth: 140 }}
            >
              <option value="all">All Modules</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginRight: 4 }}>Severity:</span>
          {(
            [
              { key: "all", label: "All" },
              { key: "critical", label: "Critical" },
              { key: "warning", label: "Warning" },
              { key: "info", label: "Info" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSeverityFilter(item.key);
                setPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: severityFilter === item.key ? "1px solid var(--color-primary-500)" : "1px solid var(--border-subtle)",
                background: severityFilter === item.key ? "var(--color-primary-500)" : "var(--bg-surface-elevated)",
                color: severityFilter === item.key ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
            <ShieldCheck size={16} style={{ color: "var(--color-emerald-400)" }} />
            <span>Immutable Audit Log Stream</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)", marginLeft: 6 }}>
              (Showing {filteredLogs.length} matching events)
            </span>
          </div>

          {(search || severityFilter !== "all" || moduleFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setSeverityFilter("all");
                setModuleFilter("all");
                setPage(1);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-primary-400)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Timestamp</th>
                <th style={{ width: 170 }}>Action</th>
                <th style={{ width: 130 }}>Module</th>
                <th style={{ width: 220 }}>Actor</th>
                <th style={{ width: 140 }}>Origin IP</th>
                <th style={{ width: 110 }}>Severity</th>
                <th>Forensic Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <RefreshCw size={24} className="animate-spin" style={{ color: "var(--color-primary-400)" }} />
                      <span>Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <ShieldAlert size={28} style={{ color: "var(--text-muted)" }} />
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>No audit records match your filters</div>
                      <div style={{ fontSize: "0.82rem" }}>Try searching for a different keyword or resetting severity/module filters</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((l) => {
                  const dateObj = l.timestamp ? new Date(l.timestamp) : null;
                  const formattedDate = dateObj && !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })
                    : "Recent";

                  return (
                    <tr key={l.log_id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {formattedDate}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                          {l.action}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-surface-elevated)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--color-cyan-400)",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {l.module || "Security"}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                            {l.actor_name || "System"}
                          </div>
                          {l.actor_email && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {l.actor_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-secondary)", background: "var(--bg-surface-elevated)", padding: "2px 6px", borderRadius: 4 }}>
                          {l.ip_address || "127.0.0.1"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={l.severity === "critical" ? "danger" : l.severity === "warning" ? "warning" : "info"}
                          label={l.severity ? l.severity.toUpperCase() : "INFO"}
                        />
                      </td>
                      <td style={{ fontSize: "0.83rem", color: "var(--text-secondary)", lineHeight: 1.4, wordBreak: "break-word" }}>
                        {l.details || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <Pagination
            currentPage={page}
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

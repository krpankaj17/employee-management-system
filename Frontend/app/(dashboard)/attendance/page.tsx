"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  Search,
  Building,
  Home,
  Laptop,
  Info,
  X,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { AttendanceRecord, AttendanceSummary } from "@/types/attendance";
import { Employee } from "@/types/employee";
import { StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { hasPermission, useAuth } from "@/lib/auth";

/**
 * Bulletproof time formatter for punch and manual regularize entries.
 * Safely parses HH:MM, HH:MM:SS, ISO timestamps, or 12h strings and prevents "Invalid Date".
 */
function formatAttendanceTime(timeStr: string | null | undefined, dateStr?: string | null): string {
  if (!timeStr) return "—";
  const str = String(timeStr).trim();
  if (!str || str === "null" || str === "undefined") return "—";

  // Already formatted e.g. "09:00 AM" or "9:00 am"
  if (/(am|pm)$/i.test(str)) {
    return str.toUpperCase();
  }

  // Time-only string "HH:MM" or "HH:MM:SS" (e.g. "09:00", "09:00:00", "18:30")
  const timeOnlyMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const hours = parseInt(timeOnlyMatch[1], 10);
    const minutes = parseInt(timeOnlyMatch[2], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const period = hours >= 12 ? "PM" : "AM";
      const hours12 = hours % 12 === 0 ? 12 : hours % 12;
      return `${hours12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
    }
  }

  // Full ISO string with date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Fallback: combine dateStr and timeStr if dateStr is provided
  if (dateStr) {
    const combined = new Date(`${dateStr}T${str}`);
    if (!isNaN(combined.getTime())) {
      return combined.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  return str;
}

export default function AttendancePage() {
  const { role, user, isEmployee: isEmployeeRole } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [shiftCompleted, setShiftCompleted] = useState(false);
  const [workMode, setWorkMode] = useState<"Office" | "Remote" | "Hybrid">("Office");
  const [notes, setNotes] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  // Stores today's attendance record ID (for admin reset)
  const [todayRecordId, setTodayRecordId] = useState<number | string | null>(null);

  // --- Filters for Daily Attendance Logs ---
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Quick-range preset helper
  const applyDatePreset = (preset: "today" | "week" | "month") => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = fmt(now);
    if (preset === "today") {
      setFilterDateFrom(todayStr);
      setFilterDateTo(todayStr);
    } else if (preset === "week") {
      const day = now.getDay(); // 0=Sun
      const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilterDateFrom(fmt(mon));
      setFilterDateTo(fmt(sun));
    } else if (preset === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFilterDateFrom(fmt(first));
      setFilterDateTo(fmt(last));
    }
    setCurrentPage(1);
  };
  const canManual = !isEmployeeRole && (hasPermission("attendance:update") || role === "Admin" || role === "HR_Manager");

  // In-page feedback states replacing browser alert() popups
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResettingPunch, setIsResettingPunch] = useState(false);

  const handleResetTodayPunch = async () => {
    if (!todayRecordId) return;
    setIsResettingPunch(true);
    try {
      await api.attendance.deleteRecord(String(todayRecordId));
      setTodayRecordId(null);
      await checkTodayPunchStatus();
      await loadAttendance();
      setActionFeedback({ type: "success", message: "Today's attendance record deleted. You can check in again." });
      setIsResetConfirmOpen(false);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({ type: "error", message: err.message || "Failed to delete attendance record." });
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setIsResettingPunch(false);
    }
  };

  // Manual record form
  const [manualForm, setManualForm] = useState({
    employee_public_id: "",
    date: new Date().toISOString().split("T")[0],
    check_in_time: "09:00",
    check_out_time: "18:00",
    work_mode: "Office" as const,
    status: "Present" as const,
    notes: "HR regularized missed biometric punch",
  });

  // Fast Employee Lookup Map to ensure names and departments are ALWAYS resolved
  const empMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => {
      if (e.public_id) map.set(e.public_id, e);
    });
    return map;
  }, [employees]);

  // Filter attendance records across the entire dataset
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const emp = empMap.get(r.employee_public_id);
      const empName = (r.employee_name && r.employee_name !== "Employee")
        ? r.employee_name
        : emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "";
      const empCode = r.employee_code || emp?.employee_code || "";
      const deptName = r.department_name || emp?.department_name || "";

      if (filterEmployee) {
        const term = filterEmployee.toLowerCase().trim();
        const matchName = empName.toLowerCase().includes(term);
        const matchCode = empCode.toLowerCase().includes(term);
        if (!matchName && !matchCode) return false;
      }
      if (filterDepartment && deptName !== filterDepartment) return false;
      // Date range — YYYY-MM-DD strings compare lexicographically correctly
      if (filterDateFrom && r.date && r.date < filterDateFrom) return false;
      if (filterDateTo   && r.date && r.date > filterDateTo)   return false;
      return true;
    });
  }, [records, empMap, filterEmployee, filterDepartment, filterDateFrom, filterDateTo]);

  const hasFilters = !!(filterEmployee || filterDepartment || filterDateFrom || filterDateTo);

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  useEffect(() => {
    loadAttendance();
  }, [role, isEmployeeRole]);

  // Separate effect: always check TODAY's punch status, independent of pagination
  useEffect(() => {
    checkTodayPunchStatus();
  }, [role, user]);

  /**
   * Computes today's date as YYYY-MM-DD in the LOCAL timezone (not UTC).
   * This matters for IST (+5:30) where toISOString() gives the wrong date
   * between midnight IST and 05:30 IST (which is still "yesterday" in UTC).
   */
  const getLocalTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  /**
   * Dedicated punch-status fetch: always queries /attendance/records?date=TODAY
   * completely independent of the table pagination.
   * IMPORTANT: we also double-check r.date === todayStr in the find() because
   * some backends ignore unknown query params and return all records — without
   * the date guard a Sep-04 closed record would be mistaken as today's shift.
   */
  const checkTodayPunchStatus = async () => {
    const todayStr = getLocalTodayStr();
    const myEmpId = user?.employee_public_id;
    try {
      const todayRes = await api.attendance
        .getRecords({ date: todayStr, employee_public_id: myEmpId || undefined, limit: 100 })
        .catch(() => ({ items: [], total: 0 }));
      const todayItems: AttendanceRecord[] = (todayRes?.items || [])
        // Only consider records whose date is actually today and belongs to the active employee
        .filter((r: AttendanceRecord) => r.date === todayStr && (!myEmpId || r.employee_public_id === myEmpId));

      const openRec   = todayItems.find((r) => (r.check_in_time  || (r as any).check_in)  && !(r.check_out_time || (r as any).check_out));
      const closedRec = todayItems.find((r) => (r.check_in_time  || (r as any).check_in)  &&  (r.check_out_time || (r as any).check_out));

      if (openRec) {
        setCheckedIn(true);
        setShiftCompleted(false);
        setTodayRecordId(openRec.attendance_id ?? (openRec as any).public_id ?? null);
      } else if (closedRec) {
        setCheckedIn(false);
        setShiftCompleted(true);
        setTodayRecordId(closedRec.attendance_id ?? (closedRec as any).public_id ?? null);
      } else {
        setCheckedIn(false);
        setShiftCompleted(false);
        setTodayRecordId(null);
      }
    } catch {
      // silently ignore — punch state will remain at default (not checked in)
    }
  };

  const loadAttendance = async () => {
    const todayStr = getLocalTodayStr();
    try {
      const [res, empRes] = await Promise.all([
        api.attendance
          .getRecords({
            limit: 500,
            employee_public_id: isEmployeeRole && user?.employee_public_id ? user.employee_public_id : undefined,
          })
          .catch(() => ({ items: [], total: 0 })),
        api.employees.list({ limit: 100 }).catch(() => ({ items: [], total: 0 })),
      ]);

      let items: AttendanceRecord[] = res?.items || [];
      if (isEmployeeRole && user?.employee_public_id) {
        items = items.filter((r) => r.employee_public_id === user.employee_public_id);
      }
      const empList: Employee[] = empRes?.items || [];
      setEmployees(empList);

      // Build local map for immediate enrichment
      const localEmpMap = new Map<string, Employee>();
      empList.forEach((e) => {
        if (e.public_id) localEmpMap.set(e.public_id, e);
      });

      // Enrich attendance records so employee_name, employee_code and department_name are never empty
      const enrichedRecords = items.map((r) => {
        const matchedEmp = localEmpMap.get(r.employee_public_id);
        const fullName = matchedEmp ? `${matchedEmp.first_name || ""} ${matchedEmp.last_name || ""}`.trim() : "";
        return {
          ...r,
          employee_name: (r.employee_name && r.employee_name !== "Employee") ? r.employee_name : (fullName || "Employee"),
          employee_code: r.employee_code || matchedEmp?.employee_code || "",
          department_name: r.department_name || matchedEmp?.department_name || "General",
        };
      });

      // Sort descending: newest date first, latest check_in first, highest attendance_id first
      enrichedRecords.sort((a, b) => {
        const dComp = (b.date || "").localeCompare(a.date || "");
        if (dComp !== 0) return dComp;
        const tA = a.check_in_time || (a as any).check_in || "";
        const tB = b.check_in_time || (b as any).check_in || "";
        if (tA !== tB) return tB.localeCompare(tA);
        return Number(b.attendance_id || 0) - Number(a.attendance_id || 0);
      });

      setRecords(enrichedRecords);
      setTotalItems(enrichedRecords.length);

      if (empList.length > 0 && !manualForm.employee_public_id) {
        setManualForm((prev) => ({ ...prev, employee_public_id: empList[0].public_id }));
      }

      // Compute average work hours from records
      const recordsWithHours = enrichedRecords.filter((r) => typeof r.total_hours === "number" && (r.total_hours as number) > 0);
      const hoursSum = recordsWithHours.reduce((acc, r) => acc + (r.total_hours || 0), 0);
      const avgHours = recordsWithHours.length > 0 ? parseFloat((hoursSum / recordsWithHours.length).toFixed(1)) : 8.0;

      // Adherence metrics
      if (isEmployeeRole) {
        const myPresent = enrichedRecords.filter((r) => (r.status || "").toLowerCase() === "present" || r.check_in_time).length;
        const myLate = enrichedRecords.filter((r) => (r.status || "").toLowerCase() === "late" || (r as any).is_late).length;
        const myLeave = enrichedRecords.filter((r) => (r.status || "").toLowerCase() === "on_leave").length;
        setSummary({
          present_count: myPresent,
          absent_count: 0,
          late_count: myLate,
          on_leave_count: myLeave,
          total_employees: enrichedRecords.length,
          average_work_hours: avgHours,
        });
      } else {
        const todayRecords = enrichedRecords.filter((r) => r.date === todayStr);
        const present = todayRecords.filter((r) => (r.status || "").toLowerCase() === "present" || r.check_in_time).length;
        const late = todayRecords.filter((r) => (r.status || "").toLowerCase() === "late" || (r as any).is_late).length;
        const onLeave = todayRecords.filter((r) => (r.status || "").toLowerCase() === "on_leave").length;
        const totalEmp = empList.length > 0 ? empList.length : (todayRecords.length || 1);
        const absent = Math.max(0, totalEmp - present - onLeave);

        setSummary({
          present_count: present,
          absent_count: absent,
          late_count: late,
          on_leave_count: onLeave,
          total_employees: totalEmp,
          average_work_hours: avgHours,
        });
      }

      // Punch status is now handled by checkTodayPunchStatus() which runs
      // independently of pagination — do NOT re-derive it here to avoid
      // false "not checked in" when today's record is on a different page.
    } catch (err) {
      console.warn("Error loading attendance records:", err);
      setRecords([]);
      setTotalItems(0);
    }
  };

  const handlePunch = async () => {
    if (shiftCompleted) {
      setActionFeedback({
        type: "error",
        message: "Check-in is only allowed once per day. Your shift for today has already been completed.",
      });
      setTimeout(() => setActionFeedback(null), 5000);
      return;
    }
    try {
      if (!checkedIn) {
        await api.attendance.checkIn(workMode, notes);
        setActionFeedback({ type: "success", message: "Clocked in successfully! Work session in progress." });
        setTimeout(() => setActionFeedback(null), 4000);
        // Refresh both the table AND the authoritative punch-status
        await loadAttendance();
        await checkTodayPunchStatus();
      } else {
        await api.attendance.checkOut();
        setActionFeedback({ type: "success", message: "Clocked out successfully. Your shift for today is complete." });
        setTimeout(() => setActionFeedback(null), 4000);
        await loadAttendance();
        await checkTodayPunchStatus();
      }
    } catch (e: any) {
      console.warn("Punch attendance error:", e);
      setActionFeedback({
        type: "error",
        message: e.message || "Failed to punch attendance. Please verify your employee record.",
      });
      setTimeout(() => setActionFeedback(null), 5000);
      // Re-sync status even on error — backend might have a different state
      checkTodayPunchStatus();
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmittingManual(true);
    try {
      await api.attendance.createManualRecord({
        employee_public_id: manualForm.employee_public_id,
        date: manualForm.date,
        check_in: manualForm.check_in_time,
        check_out: manualForm.check_out_time,
        work_mode: manualForm.work_mode.toLowerCase(),
        status: manualForm.status.toLowerCase(),
        notes: manualForm.notes,
      });
      setIsManualModalOpen(false);
      const emp = empMap.get(manualForm.employee_public_id);
      const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : "Employee";
      setActionFeedback({
        type: "success",
        message: `Attendance regularized successfully for ${name} on ${manualForm.date}.`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
      loadAttendance();
    } catch (err: any) {
      console.error("Manual attendance submit error:", err);
      const rawMsg = err.message || "Failed to record manual attendance.";
      const isDuplicate =
        rawMsg.includes("409") ||
        rawMsg.toLowerCase().includes("conflict") ||
        rawMsg.toLowerCase().includes("already exists") ||
        rawMsg.toLowerCase().includes("unique constraint");
      const friendlyMsg = isDuplicate
        ? `Attendance record already exists for this employee on ${manualForm.date}. Each employee can only have one attendance record per day.`
        : rawMsg;
      setFormError(friendlyMsg);
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {isEmployeeRole ? "My Attendance & Timesheets" : "Attendance & Workforce Timesheets"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {isEmployeeRole
              ? "Live punch clock, daily shift duration, and personal check-in logs"
              : "Biometric punch logs, remote check-ins, and automated shift hour tracking"}
          </p>
        </div>

        {canManual && (
          <button
            onClick={() => {
              setFormError(null);
              setIsManualModalOpen(true);
            }}
            className="btn btn-secondary"
          >
            <Plus size={16} /> Regularize / Backfill Punch
          </button>
        )}
      </div>

      {/* Action Feedback Banner (Replaces native browser alerts) */}
      {actionFeedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            background:
              actionFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${
              actionFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            color:
              actionFeedback.type === "success"
                ? "var(--color-emerald-400)"
                : "var(--color-rose-400)",
            fontSize: "0.88rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {actionFeedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Live Punch Card & Shift Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
        {/* Punch In/Out Console */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Personal Time Clock
              </h2>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }} suppressHydrationWarning>
                {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: shiftCompleted
                    ? "rgba(16, 185, 129, 0.15)"
                    : checkedIn
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                  color: shiftCompleted
                    ? "var(--color-emerald-400)"
                    : checkedIn
                    ? "var(--color-emerald-400)"
                    : "var(--color-rose-400)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {shiftCompleted ? <CheckCircle2 size={28} /> : <Clock size={28} />}
              </div>
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {shiftCompleted
                    ? "Shift Completed"
                    : checkedIn
                    ? "Actively Working"
                    : "Shift Not Started"}
                </div>
                <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                  {shiftCompleted
                    ? "Attendance recorded for today — check-in allowed once per day"
                    : checkedIn
                    ? "Clocked in — shift in progress"
                    : "Ready to start your work session (once a day)"}
                </div>
              </div>
            </div>

            {/* Work Mode Selection (Only shown before shift start) */}
            {!checkedIn && !shiftCompleted && (
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {[
                  { mode: "Office" as const, label: "Work From Office", icon: <Building size={14} /> },
                  { mode: "Remote" as const, label: "Remote / Home", icon: <Home size={14} /> },
                  { mode: "Hybrid" as const, label: "Client Site", icon: <Laptop size={14} /> },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setWorkMode(item.mode)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 9999,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      background: workMode === item.mode ? "#0e1726" : "#f4f4f5",
                      color: workMode === item.mode ? "#ffffff" : "#4b5563",
                      border: "1px solid " + (workMode === item.mode ? "#0e1726" : "rgba(0, 0, 0, 0.06)"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 140ms ease",
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {shiftCompleted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: 9999,
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  background: "#f4f4f5",
                  color: "#3f3f46",
                  border: "1px solid #e4e4e7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#16a34a",
                  }}
                />
                <span>Shift Completed for Today</span>
              </div>

              {/* Only Admin can reset today's attendance */}
              {role === "Admin" && todayRecordId && (
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#991b1b",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "4px 8px",
                  }}
                  onClick={() => setIsResetConfirmOpen(true)}
                >
                  <X size={13} /> Reset Today's Attendance (Admin)
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handlePunch}
              style={{
                width: "100%",
                padding: "14px 28px",
                borderRadius: 9999,
                fontWeight: 700,
                fontSize: "0.95rem",
                background: checkedIn ? "#b91c1c" : "#0e1726",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: checkedIn
                  ? "0 4px 14px rgba(185, 28, 28, 0.25)"
                  : "0 4px 14px rgba(14, 23, 38, 0.2)",
                transition: "all 160ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <Clock size={18} />
              <span>{checkedIn ? "Check Out & End Shift" : "Check In (Punch Time)"}</span>
            </button>
          )}
        </div>

        {/* Adherence / My Shift Summary */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            {isEmployeeRole ? "My Monthly Adherence" : "Today's Company Adherence"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                {isEmployeeRole ? "Days Present" : "Present Staff"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-emerald-400)" }}>
                {isEmployeeRole ? `${summary?.present_count ?? 0} days` : `${summary?.present_count ?? "—"} / ${summary?.total_employees ?? "—"}`}
              </span>
            </div>

            <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                {isEmployeeRole ? "Late Punches" : "Late Punches"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-amber-400)" }}>
                {isEmployeeRole ? `${summary?.late_count ?? 0} days` : (summary?.late_count ?? "—")}
              </span>
            </div>

            <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>
                {isEmployeeRole ? "Approved Leaves" : "On Approved Leave"}
              </span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--color-cyan-400)" }}>
                {isEmployeeRole ? `${summary?.on_leave_count ?? 0} days` : (summary?.on_leave_count ?? "—")}
              </span>
            </div>

            <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Avg Hours / Day</span>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {summary?.average_work_hours != null ? `${summary.average_work_hours}h` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Records Table */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {isEmployeeRole ? "My Timesheet History" : "Daily Attendance Logs"}
          </h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Showing {paginatedRecords.length} of {filteredRecords.length} {hasFilters ? "filtered logs" : "records"}
          </span>
        </div>

        {/* ── Filter Bar ── */}
        {!isEmployeeRole && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              padding: "12px 14px",
              marginBottom: 16,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Employee Name Search */}
            <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
              />
              <input
                type="text"
                placeholder="Search employee name..."
                value={filterEmployee}
                onChange={(e) => { setFilterEmployee(e.target.value); setCurrentPage(1); }}
                className="input-field"
                style={{ paddingLeft: 32, height: 34, fontSize: "0.82rem" }}
              />
            </div>

            {/* Department Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px" }}>
              <Filter size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <select
                value={filterDepartment}
                onChange={(e) => { setFilterDepartment(e.target.value); setCurrentPage(1); }}
                className="input-field"
                style={{ height: 34, fontSize: "0.82rem", padding: "0 10px", flex: 1 }}
              >
                <option value="">All Departments</option>
                {Array.from(new Set(employees.map((e) => e.department_name).filter(Boolean)))
                  .sort()
                  .map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
              </select>
            </div>

            {/* ── Date Range: Quick Presets ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {([
                { label: "Today", preset: "today" as const },
                { label: "This Week", preset: "week" as const },
                { label: "This Month", preset: "month" as const },
              ]).map(({ label, preset }) => {
                const isActive =
                  preset === "today" && filterDateFrom === filterDateTo && filterDateFrom === new Date().toISOString().split("T")[0] ||
                  false;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyDatePreset(preset)}
                    className="btn btn-sm"
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 10px",
                      fontWeight: 600,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      transition: "all var(--transition-fast)",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-elevated)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Date Range: From → To ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Calendar size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="date"
                value={filterDateFrom}
                max={filterDateTo || undefined}
                onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                className="input-field"
                style={{ height: 34, fontSize: "0.82rem", padding: "0 8px", width: 140 }}
                title="From date"
              />
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", userSelect: "none" }}>→</span>
              <input
                type="date"
                value={filterDateTo}
                min={filterDateFrom || undefined}
                onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                className="input-field"
                style={{ height: 34, fontSize: "0.82rem", padding: "0 8px", width: 140 }}
                title="To date"
              />
            </div>

            {/* Clear Filters button — only when any filter active */}
            {(filterEmployee || filterDepartment || filterDateFrom || filterDateTo) && (
              <button
                type="button"
                onClick={() => { setFilterEmployee(""); setFilterDepartment(""); setFilterDateFrom(""); setFilterDateTo(""); setCurrentPage(1); }}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--color-rose-400)", fontSize: "0.78rem", flexShrink: 0 }}
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                        {hasFilters ? "No records match the selected filters." : "No attendance records found."}
                      </td>
                    </tr>
                  ) : paginatedRecords.map((r) => {
                    const emp = empMap.get(r.employee_public_id);
                    const empName = (r.employee_name && r.employee_name !== "Employee")
                      ? r.employee_name
                      : emp
                      ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee"
                      : "Employee";
                    const empCode = r.employee_code || emp?.employee_code || "";
                    const deptName = r.department_name || emp?.department_name || "General";
                    const checkInDisplay = formatAttendanceTime(r.check_in_time, r.date);
                    const checkOutDisplay = formatAttendanceTime(r.check_out_time, r.date);

                    return (
                      <tr key={r.attendance_id}>
                        {/* Employee Profile Cell */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={empName} size={32} ring={false} />
                            <div>
                              <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.88rem" }}>{empName}</div>
                              {empCode && (
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                  {empCode}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Department Badge Cell */}
                        <td>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "var(--color-cyan-400)",
                              background: "rgba(6, 182, 212, 0.12)",
                              border: "1px solid rgba(6, 182, 212, 0.25)",
                              padding: "3px 10px",
                              borderRadius: "9999px",
                              display: "inline-block",
                            }}
                          >
                            {deptName}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.date}</td>

                        {/* Check In */}
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {checkInDisplay}
                        </td>

                        {/* Check Out */}
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {checkOutDisplay}
                        </td>

                        {/* Work Mode */}
                        <td>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                            {r.work_mode?.replace("_", " ")}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td>
                          <StatusBadge
                            status={
                              (r.check_in_time || (r as any).check_in) && String(r.status).toLowerCase() === "absent"
                                ? "Present"
                                : r.status
                            }
                          />
                        </td>

                        {/* Total Duration */}
                        <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {(() => {
                            const isClosed = !!(r.check_out_time || (r as any).check_out);
                            const hours = r.total_hours != null ? Number(r.total_hours) : 0;
                            if (hours > 0) {
                              return `${hours.toFixed(2)} hrs`;
                            }
                            if (isClosed) {
                              const inT = r.check_in_time || (r as any).check_in;
                              const outT = r.check_out_time || (r as any).check_out;
                              if (inT && outT) {
                                const diffMs = new Date(outT).getTime() - new Date(inT).getTime();
                                const diffSec = Math.round(diffMs / 1000);
                                if (!isNaN(diffSec) && diffSec >= 0) {
                                  if (diffSec < 60) return `${diffSec}s`;
                                  return `${Math.round(diffSec / 60)}m`;
                                }
                              }
                              return "< 1 min";
                            }
                            return r.check_in_time ? "In Progress" : "—";
                          })()}
                        </td>

                        {/* Notes */}
                        <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination — uses filtered total when filters active */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRecords.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              pageSizeOptions={[10, 20, 50, 100]}
              itemLabel="attendance logs"
            />
      </div>

      {/* Manual Backfill Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => {
          setFormError(null);
          setIsManualModalOpen(false);
        }}
        title="Regularize / Backfill Punch"
      >
        <form onSubmit={handleManualSubmit}>
          {/* In-Modal Alert Banner replacing browser alert() */}
          {formError && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.14)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-rose-400)",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 18,
                lineHeight: 1.45,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select
              className="input-field"
              value={manualForm.employee_public_id}
              onChange={(e) => {
                setFormError(null);
                setManualForm({ ...manualForm, employee_public_id: e.target.value });
              }}
            >
              {employees.map((m) => (
                <option key={m.public_id} value={m.public_id}>
                  {m.first_name} {m.last_name} ({m.employee_code}) {m.department_name ? `- ${m.department_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={manualForm.date}
                onChange={(e) => {
                  setFormError(null);
                  setManualForm({ ...manualForm, date: e.target.value });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Work Mode</label>
              <select
                className="input-field"
                value={manualForm.work_mode}
                onChange={(e) => setManualForm({ ...manualForm, work_mode: e.target.value as any })}
              >
                <option value="Office">Office</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Check In Time *</label>
              <input
                type="time"
                required
                className="input-field"
                value={manualForm.check_in_time}
                onChange={(e) => {
                  setFormError(null);
                  setManualForm({ ...manualForm, check_in_time: e.target.value });
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Check Out Time *</label>
              <input
                type="time"
                required
                className="input-field"
                value={manualForm.check_out_time}
                onChange={(e) => {
                  setFormError(null);
                  setManualForm({ ...manualForm, check_out_time: e.target.value });
                }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Regularization Reason / Audit Notes *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Biometric device offline; punch verified by manager"
              value={manualForm.notes}
              onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsManualModalOpen(false);
              }}
              className="btn btn-secondary"
              disabled={submittingManual}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submittingManual}>
              {submittingManual ? "Saving..." : "Save Regularized Record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Admin Reset Attendance Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => {
          if (!isResettingPunch) setIsResetConfirmOpen(false);
        }}
        onConfirm={handleResetTodayPunch}
        title="Reset Today's Attendance"
        message="Delete today's attendance record and reset the punch clock? This cannot be undone."
        confirmText="Reset Record"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        isLoading={isResettingPunch}
      />
    </div>
  );
}

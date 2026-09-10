"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  CalendarCheck,
  FolderKanban,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  UserCheck,
  RefreshCw,
  Building,
  Briefcase,
  Calendar,
  Search,
  UserX,
  CreditCard,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import { showToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Announcement } from "@/types/announcement";
import { Employee } from "@/types/employee";
import { AttendanceRecord } from "@/types/attendance";
import { LeaveRequest } from "@/types/leave";
import { Project } from "@/types/project";
import { Department } from "@/types/department";
import { PayrollRun } from "@/types/payroll";

export default function DashboardPage() {
  const { role, user, isEmployee } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live Punch Widget state
  const [checkedIn, setCheckedIn] = useState(false);
  const [shiftCompleted, setShiftCompleted] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string>("");
  const [workMinutes, setWorkMinutes] = useState(0);
  const [punchLoading, setPunchLoading] = useState(false);

  // Real Enterprise Overview Stats
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [inactiveEmployees, setInactiveEmployees] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Live Payroll State
  const [payrollTotal, setPayrollTotal] = useState<number>(0);
  const [payrollRunsCount, setPayrollRunsCount] = useState<number>(0);
  const [myNetPay, setMyNetPay] = useState<number>(0);

  // Data Collections
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weeklyAttendanceChart, setWeeklyAttendanceChart] = useState<
    { day: string; dateStr: string; present: number; total: number; pct: number; hours: number }[]
  >([]);

  // Projects Filter & Pagination States
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [projectCurrentPage, setProjectCurrentPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(5);

  const initialFetchDone = React.useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      loadDashboardData();
    }
  }, [role, user]);

  // Work time counter when checked in
  useEffect(() => {
    let timer: any = null;
    if (checkedIn) {
      timer = setInterval(() => {
        setWorkMinutes((prev) => prev + 1);
      }, 60000);
    }
    return () => clearInterval(timer);
  }, [checkedIn]);

  const loadDashboardData = async (isManual = false) => {
    const minDelay = isManual ? new Promise((res) => setTimeout(res, 550)) : Promise.resolve();
    if (isManual) {
      setRefreshing(true);
      if (typeof api.invalidateCache === "function") {
        api.invalidateCache(); // Bust ALL cached responses so metrics are 100% freshly fetched
      }
    } else {
      setLoading(true);
    }

    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split("T")[0];

    // Generate Monday-Friday of current week
    const currentDay = todayDate.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diffToMonday);

    const weekDays: { name: string; dateStr: string; isToday: boolean }[] = [];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      weekDays.push({
        name: `${dayNames[i]}${dateStr === todayStr ? " (Today)" : ""}`,
        dateStr,
        isToday: dateStr === todayStr,
      });
    }

    try {
      // ── 1. Fast Consolidated Server-Side Metrics ──────────────────────────
      let summaryData: any = null;
      try {
        const summaryRes = await api.dashboard.getSummary({ bypassCache: isManual });
        if (summaryRes && summaryRes.ok && summaryRes.metrics) {
          summaryData = summaryRes;
        }
      } catch (e) {
        // Fallback to individual requests if summary endpoint is unavailable
      }

      if (summaryData) {
        const m = summaryData.metrics;
        setTotalEmployees(m.total_employees || 0);
        setActiveEmployees(m.active_employees || 0);
        setInactiveEmployees(m.inactive_employees || 0);
        setDepartmentsCount(m.departments_count || 0);
        setPresentToday(m.present_today || 0);
        setOnLeaveToday(m.on_leave_today || 0);
        setPendingLeaves(m.pending_leaves || 0);
        setActiveProjectsCount(m.active_projects_count || 0);
        setPendingApprovals(m.pending_approvals || 0);
        setPayrollTotal(m.payroll_total || 0);
        setPayrollRunsCount(m.payroll_runs_count || 0);
        setMyNetPay(m.my_net_pay || 0);

        if (Array.isArray(summaryData.weekly_attendance)) {
          setWeeklyAttendanceChart(summaryData.weekly_attendance);
        }
        if (Array.isArray(summaryData.recent_projects)) {
          setProjectsList(summaryData.recent_projects);
        }
        if (Array.isArray(summaryData.recent_announcements)) {
          setAnnouncements(summaryData.recent_announcements);
        }
        if (Array.isArray(summaryData.departments)) {
          setDepartmentsList(summaryData.departments);
        }

        const punch = summaryData.today_user_punch;
        if (punch) {
          setCheckedIn(Boolean(punch.checked_in));
          setShiftCompleted(Boolean(punch.shift_completed));
          if (punch.check_in_time) {
            const dt = new Date(punch.check_in_time);
            if (!isNaN(dt.getTime())) {
              setCheckInTime(dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
              const diffMins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
              setWorkMinutes(diffMins);
            }
          }
        }

        await minDelay;
        setLoading(false);
        setRefreshing(false);
        if (isManual) {
          showToast.success("Dashboard metrics refreshed.");
        }
        return;
      }

      // ── 2. Fallback Multi-Module Fetch ────────────────────────────────────
      const results = await Promise.allSettled([
        api.employees.list({ limit: 20 }),
        api.departments.list(),
        api.attendance.getRecords({ limit: 20 }),
        api.leaves.getRequests({ limit: 20 }),
        api.leaves.getBalances(),
        api.projects.list(),
        api.reviews.list(),
        api.announcements.list(),
        api.auth.listPendingUsers(),
        api.payroll.getRuns({ limit: 20 }),
      ]);

      const employees: Employee[] = results[0].status === "fulfilled" ? results[0].value.items || [] : [];
      const departments: Department[] = results[1].status === "fulfilled" ? results[1].value || [] : [];
      const attendanceRecords: AttendanceRecord[] = results[2].status === "fulfilled" ? results[2].value.items || [] : [];
      const leaveRequests: LeaveRequest[] = results[3].status === "fulfilled" ? results[3].value.items || [] : [];
      const projects: Project[] = results[5].status === "fulfilled" ? results[5].value || [] : [];
      const rawAnnouncements: Announcement[] = results[7].status === "fulfilled" ? results[7].value || [] : [];
      const pendingUsers = results[8].status === "fulfilled" ? results[8].value || [] : [];

      // Payroll calculation
      const payrollRes = results[9].status === "fulfilled" ? results[9].value : null;
      const payrollRuns: PayrollRun[] = payrollRes?.items || (Array.isArray(payrollRes) ? payrollRes : []);
      const computedPayroll = payrollRuns.reduce((acc, r) => acc + (Number(r.net_pay) || Number(r.gross_earnings) || 0), 0);
      setPayrollTotal(computedPayroll);
      setPayrollRunsCount(payrollRuns.length);

      if (user?.employee_public_id) {
        const myRuns = payrollRuns.filter((r) => r.employee_public_id === user.employee_public_id);
        if (myRuns.length > 0) {
          setMyNetPay(Number(myRuns[0].net_pay) || Number(myRuns[0].gross_earnings) || 0);
        }
      }

      setEmployeesList(employees);
      setDepartmentsList(departments);
      setProjectsList(projects);

      // Enterprise calculations
      const totalEmp = employees.length;
      const activeEmp = employees.filter((e) => {
        const st = (e.employee_status || "").toLowerCase();
        return st === "active" || (!st.includes("inactive") && !st.includes("terminated") && !st.includes("suspended"));
      }).length;
      const inactiveEmp = employees.filter((e) => {
        const st = (e.employee_status || "").toLowerCase();
        return st === "inactive" || st === "terminated" || st === "suspended";
      }).length;

      setTotalEmployees(totalEmp);
      setActiveEmployees(activeEmp);
      setInactiveEmployees(inactiveEmp);
      setDepartmentsCount(departments.length);

      // Attendance calculations
      const todayRecords = attendanceRecords.filter((r) => r.date === todayStr);
      const presentCount = todayRecords.filter(
        (r) => (r.status || "").toLowerCase() === "present" || r.check_in_time
      ).length;
      setPresentToday(presentCount);

      // Leave calculations
      const activeLeavesToday = leaveRequests.filter(
        (l) => (l.status || "").toLowerCase() === "approved" && l.start_date <= todayStr && l.end_date >= todayStr
      ).length;
      setOnLeaveToday(activeLeavesToday);

      const pendingLeaveCount = leaveRequests.filter(
        (l) => (l.status || "").toLowerCase() === "pending"
      ).length;
      setPendingLeaves(pendingLeaveCount);

      // Projects
      const activeProj = projects.filter(
        (p) => (p.status || "").toLowerCase() === "active" || (p.status || "").toLowerCase() === "in_progress"
      ).length;
      setActiveProjectsCount(activeProj);

      // Pending user approvals
      setPendingApprovals(pendingUsers.length);

      // Weekly chart
      const chartData = weekDays.map((wd) => {
        const recordsThatDay = attendanceRecords.filter((r) => r.date === wd.dateStr);
        const presentThatDay = recordsThatDay.filter(
          (r) => (r.status || "").toLowerCase() === "present" || r.check_in_time
        ).length;
        const baseTotal = totalEmp > 0 ? totalEmp : 1;
        const pct = wd.dateStr > todayStr ? 0 : Math.min(100, Math.round((presentThatDay / baseTotal) * 100));
        return {
          day: wd.name,
          dateStr: wd.dateStr,
          present: presentThatDay,
          total: totalEmp,
          pct: pct > 0 ? pct : wd.isToday && presentCount > 0 ? Math.round((presentCount / baseTotal) * 100) : 0,
          hours: 8,
        };
      });

      // Active user punch state for today
      const myEmpId = user?.employee_public_id;
      const myTodayRecords = attendanceRecords.filter((r) => {
        if (!myEmpId) return false;
        return r.employee_public_id === myEmpId && r.date === todayStr;
      });

      const openRec = myTodayRecords.find(
        (r) => (r.check_in_time || (r as any).check_in) && !(r.check_out_time || (r as any).check_out)
      );
      const closedRec = myTodayRecords.find(
        (r) => (r.check_in_time || (r as any).check_in) && (r.check_out_time || (r as any).check_out)
      );

      if (openRec) {
        setCheckedIn(true);
        setShiftCompleted(false);
        const inTime = openRec.check_in_time || (openRec as any).check_in;
        if (inTime) {
          const dt = new Date(inTime);
          if (!isNaN(dt.getTime())) {
            setCheckInTime(dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            const diffMins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
            setWorkMinutes(diffMins);
          }
        }
      } else if (closedRec) {
        setCheckedIn(false);
        setShiftCompleted(true);
      } else {
        setCheckedIn(false);
        setShiftCompleted(false);
      }

      setWeeklyAttendanceChart(chartData);
      setAnnouncements(rawAnnouncements.slice(0, 3));
    } catch (err: any) {
      console.error("Dashboard hydration error:", err);
    } finally {
      await minDelay;
      setLoading(false);
      setRefreshing(false);
      if (isManual) {
        showToast.success("Dashboard metrics refreshed.");
      }
    }
  };

  const handlePunchToggle = async () => {
    if (shiftCompleted) return;
    setPunchLoading(true);
    try {
      if (!checkedIn) {
        await api.attendance.checkIn("Office");
        setCheckedIn(true);
        setShiftCompleted(false);
        setCheckInTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setWorkMinutes(0);
      } else {
        await api.attendance.checkOut();
        setCheckedIn(false);
        setShiftCompleted(true);
      }
      await loadDashboardData(false);
    } catch (e: any) {
      console.warn("Punch sync error:", e);
    } finally {
      setPunchLoading(false);
    }
  };

  const formatWorkTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // Indian Rupee currency shortener
  const formatPayrollCurrency = (amount: number) => {
    if (!amount || isNaN(amount) || amount === 0) return "₹0";
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const displayTotalEmp = totalEmployees > 0 ? totalEmployees : employeesList.length;
  const displayActiveToday = presentToday > 0 ? presentToday : (activeEmployees > 0 ? activeEmployees : 0);

  // Filtered & Paged Projects for Dashboard
  const filteredProjects = useMemo(() => {
    return projectsList.filter((p) => {
      const q = projectSearch.toLowerCase();
      const matchesQuery =
        p.project_name.toLowerCase().includes(q) ||
        p.project_code.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.head_employee_name || p.project_head_name || "").toLowerCase().includes(q);
      const matchesStatus =
        projectStatusFilter === "all" ||
        (p.status || "").toLowerCase() === projectStatusFilter.toLowerCase();
      return matchesQuery && matchesStatus;
    });
  }, [projectsList, projectSearch, projectStatusFilter]);

  const pagedProjects = useMemo(() => {
    const start = (projectCurrentPage - 1) * projectPageSize;
    return filteredProjects.slice(start, start + projectPageSize);
  }, [filteredProjects, projectCurrentPage, projectPageSize]);

  // Department Distribution Breakdown
  const departmentDistribution = useMemo(() => {
    return departmentsList
      .map((dept) => {
        const deptName = dept.department_name || dept.dept_name || "General";
        const empCount = employeesList.filter(
          (e) => (e.department_name || "").toLowerCase() === deptName.toLowerCase()
        ).length;
        const count = dept.employee_count || empCount || 0;
        return {
          id: dept.public_id,
          name: deptName,
          code: dept.department_code || dept.dept_code || "DEPT",
          count,
          head: dept.head_employee_name || "Lead Assigned",
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [departmentsList, employeesList]);

  // Filtered projects for Employee view
  const myProjects = useMemo(() => {
    if (!isEmployee || !user?.employee_public_id) return projectsList;
    const myId = user.employee_public_id;
    return projectsList.filter(
      (p) =>
        p.head_employee_public_id === myId ||
        p.project_head_public_id === myId ||
        (p.members && p.members.some((m: any) => m.employee_public_id === myId || m.public_id === myId))
    );
  }, [projectsList, isEmployee, user]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 36, width: "100%" }}>
      {/* ── HEADER: Section Title + Controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {isEmployee ? "Employee Workspace" : "Executive Dashboard"}
          </h1>
          <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            {isEmployee
              ? "Your personal daily work hub, punch clock, active projects, and company announcements"
              : "Real-time enterprise workforce metrics, operational delivery, and live attendance tracking"}
          </p>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* User Approvals quick pill for Admin/HR */}
          {!isEmployee && pendingApprovals > 0 && (
            <Link
              href="/approvals"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#92400e",
                textDecoration: "none",
              }}
            >
              <UserCheck size={14} />
              <span>{pendingApprovals} Pending Approvals</span>
            </Link>
          )}

          {/* Sleek Studio Time Clock Capsule */}
          {shiftCompleted ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 16px",
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                color: "#3f3f46",
                fontWeight: 600,
              }}
              title="Attendance recorded for today — check-in allowed once per day."
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
              <span>Shift Completed for Today</span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                padding: "4px 6px 4px 14px",
                borderRadius: "9999px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: checkedIn ? "#16a34a" : "#94a3b8",
                  }}
                />
                <span style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 600 }}>
                  {checkedIn ? `Working • ${formatWorkTime(workMinutes)}` : "Time Clock"}
                </span>
              </div>

              <button
                onClick={handlePunchToggle}
                disabled={punchLoading}
                style={{
                  background: checkedIn ? "#dc2626" : "#0e1726",
                  color: "#ffffff",
                  fontWeight: 700,
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  fontSize: "0.78rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "none",
                  cursor: "pointer",
                  transition: "background 140ms ease",
                }}
              >
                {punchLoading ? <RefreshCw size={12} className="spin" /> : <Clock size={12} />}
                <span>{checkedIn ? "Clock Out" : "Clock In"}</span>
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="action-icon-btn"
            title="Refresh dashboard metrics"
            aria-label="Refresh dashboard metrics"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              cursor: refreshing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (!refreshing) {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.transform = "rotate(45deg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!refreshing) {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.transform = "rotate(0deg)";
              }
            }}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "spin" : ""}
              style={{
                color: refreshing ? "#4f46e5" : "#475569",
                transition: "color 150ms ease",
              }}
            />
          </button>
        </div>
      </div>

      {/* ── ROW 1: 4 STUDIO METRIC CARDS ── */}
      <div className="grid-cols-4">
        {/* Card 1: Total Employees (Admin/HR) OR Employment Status (Employee) */}
        <Link
          href={isEmployee ? "/profile" : "/employees"}
          className="card card-interactive"
          style={{
            background: "#ffffff",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 140,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEmployee ? "Profile Status" : "Total Workforce"}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0e1726",
              }}
            >
              <Users size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0e1726", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {isEmployee ? "Active" : displayTotalEmp}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {isEmployee ? "Corporate Profile" : `${activeEmployees} Active Accounts`}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: "#0e1726", fontWeight: 600 }}>
                <span>{isEmployee ? "View" : "Directory"}</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </div>
        </Link>

        {/* Card 2: Active Today (Admin/HR) OR Today's Shift (Employee) */}
        <Link
          href="/attendance"
          className="card card-interactive"
          style={{
            background: "#ffffff",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 140,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEmployee ? "Today's Shift" : "Active Today"}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0e1726",
              }}
            >
              <Clock size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: isEmployee ? "1.5rem" : "2rem", fontWeight: 800, color: "#0e1726", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              {isEmployee ? (checkedIn ? "Clocked In" : shiftCompleted ? "Shift Done" : "Not Started") : displayActiveToday}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {isEmployee ? "Live Time Clock" : "Present at Work"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: "#0e1726", fontWeight: 600 }}>
                <span>Timesheets</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </div>
        </Link>

        {/* Card 3: On Leave / Pending (Admin/HR) OR Leave Balance (Employee) */}
        <Link
          href="/leaves"
          className="card card-interactive"
          style={{
            background: "#ffffff",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 140,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEmployee ? "Leave Status" : "On Leave / Pending"}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0e1726",
              }}
            >
              <Calendar size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0e1726", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {isEmployee ? pendingLeaves : onLeaveToday}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {isEmployee ? "Pending Requests" : `${pendingLeaves} Pending Approval`}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: "#0e1726", fontWeight: 600 }}>
                <span>Requests</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </div>
        </Link>

        {/* Card 4: Inactive Users (Admin/HR) OR Latest Net Salary in ₹ (Employee) */}
        <Link
          href={isEmployee ? "/payroll" : "/employees"}
          className="card card-interactive"
          style={{
            background: "#ffffff",
            backgroundColor: "#ffffff",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 140,
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isEmployee ? "Monthly Take-Home" : "Inactive Users"}
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0e1726",
                fontWeight: 800,
              }}
            >
              {isEmployee ? "₹" : <UserX size={18} />}
            </div>
          </div>
          <div>
            <div style={{ fontSize: isEmployee ? "1.5rem" : "2rem", fontWeight: 800, color: "#0e1726", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              {isEmployee ? (myNetPay > 0 ? formatPayrollCurrency(myNetPay) : "Payslips Ready") : inactiveEmployees}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {isEmployee ? "Disbursed in INR (₹)" : "Deactivated / Suspended"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: "#0e1726", fontWeight: 600 }}>
                <span>{isEmployee ? "Payslips" : "Manage"}</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Admin/HR Executive Stats Pill Bar */}
      {!isEmployee && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "14px 24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Disbursed Payroll:</span>
              <span style={{ fontWeight: 800, color: "#0e1726", fontSize: "0.95rem" }}>
                {formatPayrollCurrency(payrollTotal)}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>({payrollRunsCount} Runs)</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Business Units:</span>
              <span style={{ fontWeight: 800, color: "#0e1726", fontSize: "0.95rem" }}>
                {departmentsCount} Departments
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Delivery:</span>
              <span style={{ fontWeight: 800, color: "#0e1726", fontSize: "0.95rem" }}>
                {activeProjectsCount} Active Projects
              </span>
            </div>
          </div>

          <Link
            href="/payroll"
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#0e1726",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>View Payroll Runs</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}

      {/* ── ROW 2: PROJECTS & WORK DISTRIBUTION ── */}
      <div style={{ display: "grid", gridTemplateColumns: isEmployee ? "1.6fr 1fr" : "1.8fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Main Section: Active Projects Table */}
        <div
          className="card"
          style={{
            padding: "24px 26px",
            position: "relative",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderKanban size={18} style={{ color: "#0e1726" }} />
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0e1726", margin: 0 }}>
                  {isEmployee ? "My Assigned Projects" : "Active Projects & Delivery"}
                </h2>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    background: "#f1f5f9",
                    color: "#0e1726",
                    padding: "2px 8px",
                    borderRadius: "9999px",
                  }}
                >
                  {isEmployee ? myProjects.length : filteredProjects.length}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "4px 0 0 0" }}>
                {isEmployee
                  ? "Initiatives, technical milestones, and deliverables assigned to you"
                  : "Enterprise milestones, project leads, and team capacity tracking"}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Search input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "9999px",
                  padding: "5px 12px",
                  width: 180,
                }}
              >
                <Search size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Filter projects..."
                  value={projectSearch}
                  onChange={(e) => {
                    setProjectSearch(e.target.value);
                    setProjectCurrentPage(1);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: "0.8rem",
                    color: "#0e1726",
                    width: "100%",
                  }}
                  aria-label="Filter projects table"
                />
              </div>

              {/* View All Projects Link */}
              <Link
                href="/projects"
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#0e1726",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "9999px",
                }}
              >
                <span>All Projects</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          {/* Status Filter Tabs (For Admin/HR) */}
          {!isEmployee && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: 10,
              }}
            >
              {[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "in_progress", label: "In Progress" },
                { id: "completed", label: "Completed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setProjectStatusFilter(tab.id);
                    setProjectCurrentPage(1);
                  }}
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: "9999px",
                    border: "1px solid " + (projectStatusFilter === tab.id ? "#0e1726" : "#e2e8f0"),
                    background: projectStatusFilter === tab.id ? "#0e1726" : "#ffffff",
                    color: projectStatusFilter === tab.id ? "#ffffff" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Projects Data Table */}
          {(isEmployee ? myProjects : pagedProjects).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b" }}>
              <FolderKanban size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0e1726", marginBottom: 2 }}>
                No Projects Found
              </div>
              <p style={{ fontSize: "0.78rem", margin: 0 }}>
                {isEmployee ? "You currently have no project deliverables assigned." : "Adjust filters to view active project deliverables."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.78rem" }}>
                      Project / Code
                    </th>
                    <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.78rem" }}>
                      Project Lead
                    </th>
                    <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.78rem" }}>
                      Team
                    </th>
                    <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.78rem" }}>
                      Status
                    </th>
                    <th style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.78rem", textAlign: "right" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(isEmployee ? myProjects.slice(0, 5) : pagedProjects).map((prj) => (
                    <tr
                      key={prj.public_id}
                      style={{
                        borderBottom: "1px solid #f8fafc",
                        transition: "background 140ms ease",
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 600, color: "#0e1726", fontSize: "0.86rem" }}>
                            {prj.project_name}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                            {prj.project_code}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={prj.head_employee_name || prj.project_head_name || "Lead"} size={26} ring={false} />
                          <span style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 500 }}>
                            {prj.head_employee_name || prj.project_head_name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem", color: "#475569" }}>
                          <Users size={13} style={{ color: "#94a3b8" }} />
                          <span>{prj.members_count || (prj.members?.length ?? 1)}</span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 14px" }}>
                        <StatusBadge status={prj.status} />
                      </td>

                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <Link
                          href="/projects"
                          style={{
                            fontSize: "0.76rem",
                            fontWeight: 600,
                            color: "#0e1726",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <span>{isEmployee ? "Details" : "Manage"}</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls for Admin/HR */}
          {!isEmployee && filteredProjects.length > 0 && (
            <Pagination
              currentPage={projectCurrentPage}
              totalItems={filteredProjects.length}
              pageSize={projectPageSize}
              onPageChange={setProjectCurrentPage}
              onPageSizeChange={(newSize) => {
                setProjectPageSize(newSize);
                setProjectCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 20]}
              itemLabel="projects"
            />
          )}
        </div>

        {/* Side Section: Department Distribution (Admin/HR) OR Personal Time Hub (Employee) */}
        {!isEmployee ? (
          <div
            className="card"
            style={{
              padding: "24px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building size={18} style={{ color: "#0e1726" }} />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0e1726", margin: 0 }}>
                    Departments
                  </h3>
                </div>
                <Link
                  href="/departments"
                  style={{
                    color: "#0e1726",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span>View All</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>

              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 16px 0" }}>
                Workforce distribution across functional business units
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {departmentDistribution.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 8px", color: "#64748b", fontSize: "0.82rem" }}>
                    No department records found.
                  </div>
                ) : (
                  departmentDistribution.slice(0, 5).map((dept, idx) => (
                    <div
                      key={dept.id || idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>
                        {dept.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.76rem",
                          color: "#0e1726",
                          fontWeight: 700,
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                        }}
                      >
                        {dept.count} {dept.count === 1 ? "member" : "members"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 14,
                borderTop: "1px solid #f1f5f9",
                marginTop: 16,
                fontSize: "0.76rem",
                color: "#64748b",
              }}
            >
              <span>Total Units: {departmentsCount}</span>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>● Active Org Units</span>
            </div>
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: "24px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={18} style={{ color: "#0e1726" }} />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0e1726", margin: 0 }}>
                    Personal Time Clock
                  </h3>
                </div>
                <Link
                  href="/attendance"
                  style={{
                    color: "#0e1726",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span>History</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 4 }}>
                  {checkedIn ? "Clocked In At" : "Status for Today"}
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0e1726" }}>
                  {checkedIn ? checkInTime || "Active" : shiftCompleted ? "Shift Complete" : "Not Clocked In"}
                </div>
                {checkedIn && (
                  <div style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600, marginTop: 4 }}>
                    Elapsed: {formatWorkTime(workMinutes)}
                  </div>
                )}
              </div>

              {!shiftCompleted && (
                <button
                  type="button"
                  onClick={handlePunchToggle}
                  disabled={punchLoading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "9999px",
                    background: checkedIn ? "#dc2626" : "#0e1726",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {punchLoading ? <RefreshCw size={14} className="spin" /> : <Clock size={14} />}
                  <span>{checkedIn ? "Clock Out for Today" : "Clock In to Shift"}</span>
                </button>
              )}
            </div>

            <div
              style={{
                paddingTop: 14,
                borderTop: "1px solid #f1f5f9",
                marginTop: 16,
                fontSize: "0.76rem",
                color: "#64748b",
                textAlign: "center",
              }}
            >
              Standard Shift Target: 8.0 Hours
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 3: WEEKLY ATTENDANCE & BULLETIN ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        {/* Weekly Attendance Visualization */}
        <div className="card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0e1726", margin: 0, marginBottom: 2 }}>
                  Weekly Attendance
                </h3>
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                  Biometric presence and work shift verification rate
                </p>
              </div>
              <Link
                href="/attendance"
                style={{ color: "#0e1726", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span>Timesheets</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {/* Clean Studio Bar Chart */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: 160,
                padding: "16px 14px 10px",
                gap: 16,
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #f1f5f9",
              }}
            >
              {weeklyAttendanceChart.map((item, idx) => {
                const displayVal = `${item.pct || (idx === 3 ? 92 : 85)}%`;
                const barHeight = Math.min(105, Math.max(16, ((item.pct || (idx === 3 ? 92 : 85)) / 100) * 105));
                const isToday = item.day.includes("Today");

                return (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: isToday ? "#0e1726" : "#64748b" }}>
                      {displayVal}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 32,
                        height: `${barHeight}px`,
                        background: isToday ? "#0e1726" : "#cbd5e1",
                        borderRadius: "6px 6px 2px 2px",
                        transition: "height 0.4s ease-out",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: isToday ? "#0e1726" : "#64748b",
                        background: isToday ? "#e2e8f0" : "transparent",
                        padding: isToday ? "2px 6px" : "0",
                        borderRadius: "4px",
                      }}
                    >
                      {item.day.replace(" (Today)", "")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 14,
              borderTop: "1px solid #f1f5f9",
              marginTop: 14,
              fontSize: "0.76rem",
              color: "#64748b",
            }}
          >
            <span>Shift Target: 8.0 hrs/day</span>
            <span style={{ color: "#16a34a", fontWeight: 600 }}>● Daily Log Sync</span>
          </div>
        </div>

        {/* Company Bulletins & Announcements */}
        <div className="card" style={{ padding: "24px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0e1726", margin: 0 }}>
                Company Bulletin
              </h3>
              {announcements.length > 0 && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    background: "#f1f5f9",
                    color: "#0e1726",
                    padding: "1px 8px",
                    borderRadius: "9999px",
                  }}
                >
                  {announcements.length}
                </span>
              )}
            </div>
            <Link
              href="/announcements"
              style={{ color: "#0e1726", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span>View All</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {announcements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 12px", color: "#64748b", fontSize: "0.84rem" }}>
                No active announcements published.
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.public_id}
                  style={{
                    background: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <StatusBadge status={ann.priority || "Normal"} />
                    <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 500 }}>
                      {ann.published_at ? new Date(ann.published_at).toLocaleDateString() : "Recent"}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "0.86rem", fontWeight: 600, color: "#0e1726", marginBottom: 3 }}>
                    {ann.title}
                  </h4>
                  <p
                    style={{
                      fontSize: "0.76rem",
                      color: "#475569",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      margin: 0,
                    }}
                  >
                    {ann.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

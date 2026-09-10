"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Mail,
  Phone,
  Building,
  Briefcase,
  ChevronRight,
  UserPlus,
  ShieldAlert,
  Info,
  Edit3,
  Download,
  CheckSquare,
  Square,
  Sparkles,
  SlidersHorizontal,
  MapPin,
  Check,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { Employee } from "@/types/employee";
import { Department, Designation } from "@/types/department";
import { StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { hasPermission, useAuth, canViewAllEmployees } from "@/lib/auth";
import { EditEmployeeModal } from "@/components/employee/EditEmployeeModal";

export default function EmployeesPage() {
  const { role, isHR, isAdmin, mounted } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLifecycle, setSelectedLifecycle] = useState("");
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const canAdd = isAdmin || isHR || hasPermission("employee:create");
  const canEdit = isAdmin || isHR || hasPermission("employee:update");
  const isRestrictedView = mounted ? !canViewAllEmployees() : false;
  const [selectedEditEmp, setSelectedEditEmp] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardSuccess, setOnboardSuccess] = useState<string | null>(null);

  // New employee form state
  const [newEmp, setNewEmp] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    department_public_id: "",
    designation_public_id: "",
    employment_type: "full_time",
    gender: "male",
    joining_date: new Date().toISOString().split("T")[0],
    employee_code: "",
  });

  // Check URL query param for ?onboard=true
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("onboard") === "true") {
        setIsAddModalOpen(true);
      }
    }
  }, []);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDept, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [role, search, selectedDept, selectedStatus, currentPage, pageSize]);

  const loadData = async () => {
    try {
      const res = await api.employees.search({
        search: search || undefined,
        department_public_id: selectedDept || undefined,
        employee_status: selectedStatus || undefined,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      });
      setEmployees(res.items);
      setTotalItems(res.total);

      const [depts, desigs] = await Promise.all([
        api.departments.list().catch(() => []),
        api.designations.list().catch(() => []),
      ]);
      setDepartments(depts);
      setDesignations(desigs);
      if (depts.length > 0 && !newEmp.department_public_id) {
        setNewEmp((prev) => ({ ...prev, department_public_id: depts[0].public_id }));
      }
      if (desigs.length > 0 && !newEmp.designation_public_id) {
        setNewEmp((prev) => ({ ...prev, designation_public_id: desigs[0].public_id }));
      }
    } catch (err: any) {
      console.error("Failed to load employee directory data:", err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardSubmitting(true);
    try {
      await api.employees.create({
        first_name: newEmp.first_name.trim(),
        last_name: newEmp.last_name.trim(),
        email: newEmp.email.trim().toLowerCase(),
        phone: newEmp.phone_number.trim() || undefined,
        department_public_id: newEmp.department_public_id || (departments[0]?.public_id),
        designation_public_id: newEmp.designation_public_id || (designations[0]?.public_id),
        employment_type: newEmp.employment_type as any,
        gender: newEmp.gender as any,
        joining_date: newEmp.joining_date || new Date().toISOString().split("T")[0],
        employee_code: newEmp.employee_code ? newEmp.employee_code.trim() : undefined,
        employee_status: "active",
      });
      setOnboardSuccess(`Successfully onboarded ${newEmp.first_name} ${newEmp.last_name}!`);
      setIsAddModalOpen(false);
      setNewEmp({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        department_public_id: departments[0]?.public_id || "",
        designation_public_id: designations[0]?.public_id || "",
        employment_type: "full_time",
        gender: "male",
        joining_date: new Date().toISOString().split("T")[0],
        employee_code: "",
      });
      await loadData();
      setTimeout(() => setOnboardSuccess(null), 5000);
    } catch (err: any) {
      setOnboardError(err.message || "Failed to onboard employee");
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedEmpIds.size === employees.length && employees.length > 0) {
      setSelectedEmpIds(new Set());
    } else {
      setSelectedEmpIds(new Set(employees.map((e) => e.public_id)));
    }
  };

  const toggleSelectRow = (public_id: string) => {
    const next = new Set(selectedEmpIds);
    if (next.has(public_id)) {
      next.delete(public_id);
    } else {
      next.add(public_id);
    }
    setSelectedEmpIds(next);
  };

  // CSV Exporter
  const exportToCSV = () => {
    if (employees.length === 0) return;
    const headers = ["Employee Code", "First Name", "Last Name", "Email", "Department", "Designation", "Employment Type", "Status", "Joining Date"];
    const rows = employees.map((e) => [
      e.employee_code,
      `"${e.first_name}"`,
      `"${e.last_name}"`,
      `"${e.email}"`,
      `"${e.department_name || ""}"`,
      `"${e.designation_name || ""}"`,
      `"${e.employment_type || ""}"`,
      `"${e.employee_status || ""}"`,
      `"${e.joining_date || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `employee_directory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client-side filtering for Lifecycle
  const displayedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedLifecycle) {
        if (String(emp.employment_type).toLowerCase() !== selectedLifecycle.toLowerCase()) return false;
      }
      return true;
    });
  }, [employees, selectedLifecycle]);

  // Ratio metrics
  const activeCount = employees.filter((e) => String(e.employee_status).toLowerCase() === "active").length;
  const onLeaveCount = employees.filter((e) => String(e.employee_status).toLowerCase().includes("leave")).length;
  const probationaryCount = employees.filter((e) => {
    if (!e.joining_date) return false;
    const jDate = new Date(e.joining_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return jDate >= threeMonthsAgo;
  }).length;

  const activePct = employees.length > 0 ? Math.round((activeCount / employees.length) * 100) : 84;
  const onLeavePct = employees.length > 0 ? Math.round((onLeaveCount / employees.length) * 100) : 8;
  const probationaryPct = employees.length > 0 ? Math.round((probationaryCount / employees.length) * 100) : 8;

  if (role === "Employee") {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: 650, margin: "40px auto" }}>
        <ShieldAlert size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          The enterprise employee directory and personnel records management are reserved for <strong>Management</strong> and <strong>HR</strong>. You can inspect and update your personal credentials in <Link href="/profile" style={{ color: "var(--color-primary-400)", textDecoration: "underline" }}>Settings & Profile</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1
            suppressHydrationWarning
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            {isRestrictedView ? "My Employee Profile" : "Employees"}
          </h1>
          <p
            suppressHydrationWarning
            style={{
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            {isRestrictedView
              ? "Viewing your authorized personnel profile record"
              : `Showing ${displayedEmployees.length} of ${totalItems} enterprise team members across ${departments.length} departments`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="capsule-select-btn"
            title="Download CSV Roster"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          {/* View Toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "9999px",
              padding: 3,
            }}
          >
            <button
              onClick={() => setViewMode("table")}
              className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "9999px", padding: "6px 12px" }}
              title="Table View"
            >
              <ListIcon size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: "9999px", padding: "6px 12px" }}
              title="Card Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {canAdd && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary"
              style={{ borderRadius: "9999px", padding: "8px 18px", fontWeight: 600 }}
            >
              <Plus size={16} /> Onboard Employee
            </button>
          )}
        </div>
      </div>

      {/* Option 3 Studio Ratio Progress Bar (with Light Butter-Yellow Hired Pill) */}
      {!isRestrictedView && (
        <div className="ratio-progress-container">
          <div className="ratio-progress-track">
            {/* Total Employees */}
            <div className="ratio-segment" style={{ flex: 1 }}>
              <span>Total Employees</span>
              <strong className="tabular-figures">{totalItems || employees.length}</strong>
            </div>

            {/* Active / Hired Staff in Signature Light Pastel Butter-Yellow Pill */}
            <div className="ratio-segment ratio-segment-hired-light" style={{ flex: 2 }}>
              <span>Hired / Active</span>
              <strong className="tabular-figures">{activePct}%</strong>
            </div>

            {/* On Leave Segment */}
            <div className="ratio-segment" style={{ flex: 1 }}>
              <span>On Leave</span>
              <strong className="tabular-figures">{onLeavePct}%</strong>
            </div>

            {/* Probationary Segment */}
            <div className="ratio-segment" style={{ flex: 1 }}>
              <span>In Probation</span>
              <strong className="tabular-figures">{probationaryPct}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Success Alert */}
      {onboardSuccess && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid var(--color-emerald-500)",
            color: "var(--color-emerald-500)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          <UserPlus size={18} />
          <span>{onboardSuccess}</span>
        </div>
      )}

      {/* Studio Capsule Filter Toolbar */}
      {!isRestrictedView && (
        <div className="capsule-filter-toolbar">
          {/* Capsule Search Box */}
          <div className="capsule-search-box">
            <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              className="capsule-search-input"
              placeholder="Search by name, email, or employee code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Department Filter Capsule */}
          <select
            className="capsule-select-btn"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.public_id} value={d.public_id}>
                {d.department_name}
              </option>
            ))}
          </select>

          {/* Lifecycle / Employment Type Filter Capsule */}
          <select
            className="capsule-select-btn"
            value={selectedLifecycle}
            onChange={(e) => setSelectedLifecycle(e.target.value)}
          >
            <option value="">All Lifecycles</option>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>

          {/* Status Filter Capsule */}
          <select
            className="capsule-select-btn"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On_Leave">On Leave</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Reset Filters */}
          {(search || selectedDept || selectedLifecycle || selectedStatus) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedDept("");
                setSelectedLifecycle("");
                setSelectedStatus("");
              }}
              className="btn btn-ghost btn-sm"
              style={{ borderRadius: "9999px" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Curated Studio Data Table View */}
      {viewMode === "table" ? (
        <div className="studio-card-container">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedEmpIds.size === displayedEmployees.length &&
                        displayedEmployees.length > 0
                      }
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#eab308" }}
                      aria-label="Select all employees"
                    />
                  </th>
                  <th>Employee</th>
                  <th>Employee Code</th>
                  <th>Job Title</th>
                  <th>Department</th>
                  <th>Start Date</th>
                  <th>Lifecycle</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px 16px" }}>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        No employee records match your selected filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map((emp) => {
                    const isSelected = selectedEmpIds.has(emp.public_id);
                    const isStatusActive = String(emp.employee_status).toLowerCase() === "active";
                    const isStatusLeave = String(emp.employee_status).toLowerCase().includes("leave");

                    return (
                      <tr
                        key={emp.public_id}
                        className={isSelected ? "table-row-selected-yellow" : ""}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleSelectRow(emp.public_id)}
                      >
                        {/* Checkbox */}
                        <td
                          style={{ textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(emp.public_id)}
                            style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#eab308" }}
                            aria-label={`Select ${emp.first_name} ${emp.last_name}`}
                          />
                        </td>

                        {/* Employee Avatar + Name */}
                        <td>
                          <Link
                            href={`/employees/${emp.public_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
                          >
                            <Avatar name={`${emp.first_name} ${emp.last_name}`} size={38} />
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                {emp.first_name} {emp.last_name}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                {emp.email}
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* Code */}
                        <td>
                          <span
                            className="tabular-figures"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              color: "var(--color-primary-400)",
                            }}
                          >
                            {emp.employee_code}
                          </span>
                        </td>

                        {/* Job Role */}
                        <td>
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                            {emp.designation_name ||
                              designations.find((d) => d.public_id === emp.designation_public_id)
                                ?.designation_name ||
                              designations.find((d) => d.public_id === emp.designation_public_id)
                                ?.title ||
                              "—"}
                          </span>
                        </td>

                        {/* Department */}
                        <td>
                          <span style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                            {emp.department_name ||
                              departments.find((d) => d.public_id === emp.department_public_id)
                                ?.department_name ||
                              "—"}
                          </span>
                        </td>

                        {/* Start Date */}
                        <td>
                          <span className="tabular-figures" style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                            {emp.joining_date
                              ? new Date(emp.joining_date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </td>

                        {/* Lifecycle */}
                        <td>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "var(--bg-surface-elevated)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {String(emp.employment_type || "Full Time").replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Status Dot Badge */}
                        <td>
                          <span
                            className={`status-indicator-dot ${
                              isStatusActive
                                ? "status-dot-green"
                                : isStatusLeave
                                ? "status-dot-amber"
                                : "status-dot-gray"
                            }`}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "currentColor",
                              }}
                            />
                            <span>{isStatusActive ? "Invited" : isStatusLeave ? "On Leave" : "Inactive"}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setSelectedEditEmp(emp);
                                  setIsEditModalOpen(true);
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: "6px 8px", color: "var(--color-primary-400)" }}
                                title="Edit Employee Details"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            <Link
                              href={`/employees/${emp.public_id}`}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--color-primary-400)", fontWeight: 600 }}
                            >
                              Profile <ChevronRight size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid-cols-3">
          {displayedEmployees.map((emp) => {
            const isSelected = selectedEmpIds.has(emp.public_id);
            const isStatusActive = String(emp.employee_status).toLowerCase() === "active";
            const isStatusLeave = String(emp.employee_status).toLowerCase().includes("leave");

            return (
              <div
                key={emp.public_id}
                className={`card card-interactive ${isSelected ? "table-row-selected-yellow" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: "16px",
                  border: isSelected ? "1px solid #eab308" : "1px solid var(--border-subtle)",
                }}
                onClick={() => toggleSelectRow(emp.public_id)}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <Avatar name={`${emp.first_name} ${emp.last_name}`} size={46} />
                    <span
                      className={`status-indicator-dot ${
                        isStatusActive
                          ? "status-dot-green"
                          : isStatusLeave
                          ? "status-dot-amber"
                          : "status-dot-gray"
                      }`}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                      <span>{isStatusActive ? "Invited" : isStatusLeave ? "On Leave" : "Inactive"}</span>
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                    {emp.first_name} {emp.last_name}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-primary-400)", fontWeight: 600, marginBottom: 12 }}>
                    {emp.designation_name ||
                      designations.find((d) => d.public_id === emp.designation_public_id)?.designation_name ||
                      "—"}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building size={14} style={{ color: "var(--text-muted)" }} />
                      <span>{emp.department_name || "—"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Mail size={14} style={{ color: "var(--text-muted)" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{emp.email}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setSelectedEditEmp(emp);
                        setIsEditModalOpen(true);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: "center", borderRadius: "9999px" }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                  )}
                  <Link
                    href={`/employees/${emp.public_id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: "center", borderRadius: "9999px" }}
                  >
                    Profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[5, 10, 20, 50]}
        itemLabel="employees"
      />

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (!onboardSubmitting) {
            setIsAddModalOpen(false);
            setOnboardError(null);
          }
        }}
        title="Onboard New Employee"
      >
        <form onSubmit={handleAddSubmit}>
          {onboardError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid var(--color-danger-500)",
                color: "var(--color-danger-500)",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              <ShieldAlert size={16} />
              <span>{onboardError}</span>
            </div>
          )}

          <div className="grid-cols-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Rahul"
                value={newEmp.first_name}
                onChange={(e) => setNewEmp({ ...newEmp, first_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Verma"
                value={newEmp.last_name}
                onChange={(e) => setNewEmp({ ...newEmp, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Work Email *</label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="rahul.verma@company.com"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="input-field"
                placeholder="+91 98765 43210"
                value={newEmp.phone_number}
                onChange={(e) => setNewEmp({ ...newEmp, phone_number: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select
                className="input-field"
                required
                value={newEmp.department_public_id}
                onChange={(e) => setNewEmp({ ...newEmp, department_public_id: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d.public_id} value={d.public_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Designation *</label>
              <select
                className="input-field"
                required
                value={newEmp.designation_public_id}
                onChange={(e) => setNewEmp({ ...newEmp, designation_public_id: e.target.value })}
              >
                {designations.map((d) => (
                  <option key={d.public_id} value={d.public_id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select
                className="input-field"
                value={newEmp.employment_type}
                onChange={(e) => setNewEmp({ ...newEmp, employment_type: e.target.value })}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="input-field"
                value={newEmp.gender}
                onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: 24 }}>
            <div className="form-group">
              <label className="form-label">Joining Date</label>
              <input
                type="date"
                className="input-field"
                value={newEmp.joining_date}
                onChange={(e) => setNewEmp({ ...newEmp, joining_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employee Code (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Auto-generated if blank (e.g. EMP-1015)"
                value={newEmp.employee_code}
                onChange={(e) => setNewEmp({ ...newEmp, employee_code: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              disabled={onboardSubmitting}
              onClick={() => setIsAddModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={onboardSubmitting}
              className="btn btn-primary"
            >
              {onboardSubmitting ? (
                "Onboarding Personnel..."
              ) : (
                <>
                  <UserPlus size={16} /> Complete Onboarding
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal (HR & Admin) */}
      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEditEmp(null);
        }}
        employee={selectedEditEmp}
        onSuccess={(updated) => {
          setEmployees((prev) => prev.map((e) => (e.public_id === updated.public_id ? updated : e)));
        }}
      />
    </div>
  );
}

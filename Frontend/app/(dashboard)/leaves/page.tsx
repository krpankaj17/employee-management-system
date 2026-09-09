"use client";

import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  Filter,
  AlertCircle,
  Info,
  Edit,
  Trash2,
  Settings2,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { LeaveBalance, LeaveRequest, LeaveType } from "@/types/leave";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { hasPermission, useAuth } from "@/lib/auth";

export default function LeavesPage() {
  const { role, user, isEmployee: isEmployeeRole, isAdmin, isHR } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const canApprove =
    !isEmployeeRole &&
    (hasPermission("leave:approve") ||
      role === "Admin" ||
      role === "HR_Manager" ||
      role === "Department_Head" ||
      isAdmin ||
      isHR);

  const isAdminOrHR = isAdmin || isHR || role === "Admin" || role === "HR_Manager";
  const isOnlyAdmin = role === "Admin";

  const [activeTab, setActiveTab] = useState<"pending" | "all" | "my" | "types">(() =>
    isEmployeeRole ? "my" : canApprove ? "pending" : "my"
  );

  // Notifications / Toast
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // ── Apply Leave Modal State ────────────────────────────────────────────────
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyFormError, setApplyFormError] = useState<string | null>(null);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_public_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  // ── Leave Type Admin Management State ──────────────────────────────────────
  const [isCreateTypeModalOpen, setIsCreateTypeModalOpen] = useState(false);
  const [isEditTypeModalOpen, setIsEditTypeModalOpen] = useState(false);
  const [typeFormSubmitting, setTypeFormSubmitting] = useState(false);
  const [typeFormError, setTypeFormError] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState("");

  const [typeForm, setTypeForm] = useState({
    name: "",
    max_days_per_year: 15,
    is_paid: true,
    description: "",
    auto_allocate_all: true,
  });

  const [selectedTypeForEdit, setSelectedTypeForEdit] = useState<LeaveType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<LeaveType | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setActiveTab(isEmployeeRole ? "my" : canApprove ? "pending" : "my");
    loadData();
  }, [role, isEmployeeRole, canApprove]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bal, reqRes, types] = await Promise.all([
        api.leaves.getBalances().catch(() => []),
        api.leaves.getRequests().catch(() => ({ items: [], total: 0 })),
        api.leaves.listTypes().catch(() => []),
      ]);
      setBalances(bal);
      setRequests(reqRes.items || []);
      const availableTypes = Array.isArray(types) && types.length > 0 ? types : [];
      setLeaveTypes(availableTypes);
      if (availableTypes.length > 0 && !applyForm.leave_type_public_id) {
        setApplyForm((prev) => ({ ...prev, leave_type_public_id: availableTypes[0].public_id }));
      }
    } catch (err: any) {
      console.error("Failed to load leaves data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Duration calculator
  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    if (e < s) return -1;
    const diff = e.getTime() - s.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const currentDuration = calculateDuration(applyForm.start_date, applyForm.end_date);

  const handleAction = async (publicId: string, action: "approve" | "reject") => {
    try {
      await api.leaves.actionRequest(publicId, action);
      showNotification("success", `Leave request ${action === "approve" ? "approved" : "rejected"} successfully.`);
      loadData();
    } catch (err: any) {
      console.warn("Failed to process leave action:", err);
      showNotification("error", err.message || `Failed to ${action} leave request.`);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyFormError(null);

    if (currentDuration <= 0) {
      setApplyFormError("End date must be on or after start date.");
      return;
    }

    if (!applyForm.leave_type_public_id) {
      setApplyFormError("Please select a valid leave type.");
      return;
    }

    setApplySubmitting(true);
    try {
      await api.leaves.submitRequest({
        ...applyForm,
        total_days: currentDuration,
      });
      setIsApplyModalOpen(false);
      showNotification("success", "Leave request submitted successfully!");
      // Reset form dates to today
      const today = new Date().toISOString().split("T")[0];
      setApplyForm({
        leave_type_public_id: leaveTypes[0]?.public_id || "",
        start_date: today,
        end_date: today,
        reason: "",
      });
      loadData();
    } catch (err: any) {
      console.warn("Failed to submit leave request:", err);
      setApplyFormError(err.message || "Failed to submit leave request. Please check your leave balance.");
    } finally {
      setApplySubmitting(false);
    }
  };

  // ── Create Leave Type Handler (Admin Only) ─────────────────────────────────
  const handleOpenCreateType = () => {
    if (!isOnlyAdmin) {
      showNotification("error", "Only System Administrators are permitted to create leave types.");
      return;
    }
    setTypeForm({
      name: "",
      max_days_per_year: 15,
      is_paid: true,
      description: "",
      auto_allocate_all: true,
    });
    setTypeFormError(null);
    setIsCreateTypeModalOpen(true);
  };

  const handleCreateTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFormError(null);

    if (!typeForm.name.trim()) {
      setTypeFormError("Leave type name is required.");
      return;
    }

    if (typeForm.max_days_per_year < 0) {
      setTypeFormError("Annual quota cannot be negative.");
      return;
    }

    setTypeFormSubmitting(true);
    try {
      await api.leaves.createType({
        name: typeForm.name.trim(),
        max_days_per_year: Number(typeForm.max_days_per_year),
        is_paid: typeForm.is_paid,
        description: typeForm.description.trim() || undefined,
      });
      setIsCreateTypeModalOpen(false);
      showNotification("success", `Leave type '${typeForm.name.trim()}' created with ${typeForm.max_days_per_year} days annual quota!`);
      loadData();
    } catch (err: any) {
      setTypeFormError(err.message || "Failed to create leave type.");
    } finally {
      setTypeFormSubmitting(false);
    }
  };

  // ── Edit Leave Type Handler (Admin Only) ───────────────────────────────────
  const handleOpenEditType = (type: LeaveType) => {
    if (!isOnlyAdmin) {
      showNotification("error", "Only System Administrators are permitted to edit leave types.");
      return;
    }
    setSelectedTypeForEdit(type);
    setTypeForm({
      name: type.type_name || type.name || "",
      max_days_per_year: type.annual_quota ?? type.max_days_per_year ?? 0,
      is_paid: type.is_paid !== false,
      description: type.description || "",
      auto_allocate_all: false,
    });
    setTypeFormError(null);
    setIsEditTypeModalOpen(true);
  };

  const handleEditTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeForEdit) return;
    setTypeFormError(null);

    if (!typeForm.name.trim()) {
      setTypeFormError("Leave type name is required.");
      return;
    }

    if (typeForm.max_days_per_year < 0) {
      setTypeFormError("Annual quota cannot be negative.");
      return;
    }

    setTypeFormSubmitting(true);
    try {
      await api.leaves.updateType(selectedTypeForEdit.public_id, {
        name: typeForm.name.trim(),
        max_days_per_year: Number(typeForm.max_days_per_year),
        is_paid: typeForm.is_paid,
        description: typeForm.description.trim() || undefined,
      });
      setIsEditTypeModalOpen(false);
      showNotification("success", `Leave type '${typeForm.name.trim()}' updated successfully!`);
      loadData();
    } catch (err: any) {
      setTypeFormError(err.message || "Failed to update leave type.");
    } finally {
      setTypeFormSubmitting(false);
    }
  };

  // ── Delete Leave Type Handler (Admin Only) ─────────────────────────────────
  const handleOpenDeleteType = (type: LeaveType) => {
    if (!isOnlyAdmin) {
      showNotification("error", "Only System Administrators are permitted to remove leave types.");
      return;
    }
    setTypeToDelete(type);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteType = async () => {
    if (!typeToDelete) return;
    setDeleteLoading(true);
    try {
      await api.leaves.deleteType(typeToDelete.public_id);
      setIsDeleteConfirmOpen(false);
      showNotification("success", `Leave type '${typeToDelete.type_name || typeToDelete.name}' removed successfully.`);
      loadData();
    } catch (err: any) {
      showNotification("error", err.message || `Cannot delete leave type '${typeToDelete.type_name || typeToDelete.name}'.`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const myRequests = requests.filter((r) => r.employee_public_id === user?.employee_public_id);

  const displayedRequests =
    activeTab === "pending"
      ? pendingRequests
      : activeTab === "all" && canApprove
      ? requests
      : myRequests;

  const paginatedRequests = displayedRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredLeaveTypes = leaveTypes.filter(
    (t) =>
      (t.type_name || t.name || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(typeSearch.toLowerCase()) ||
      (t.type_code || "").toLowerCase().includes(typeSearch.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* In-app Toast Banner */}
      {notification && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderRadius: 8,
            fontSize: "0.9rem",
            fontWeight: 500,
            background:
              notification.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : notification.type === "error"
                ? "rgba(244, 63, 94, 0.15)"
                : "rgba(99, 102, 241, 0.15)",
            border: `1px solid ${
              notification.type === "success"
                ? "rgba(16, 185, 129, 0.4)"
                : notification.type === "error"
                ? "rgba(244, 63, 94, 0.4)"
                : "rgba(99, 102, 241, 0.4)"
            }`,
            color:
              notification.type === "success"
                ? "#10b981"
                : notification.type === "error"
                ? "#f43f5e"
                : "#818cf8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : notification.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {isEmployeeRole ? "My Leave Balances & Requests" : "Leave Management & Entitlements"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            PTO request submission, annual quota tracking, and multi-tier approval workflow
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isOnlyAdmin && (
            <button
              onClick={handleOpenCreateType}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Settings2 size={16} /> + Add Leave Type
            </button>
          )}

          <button
            onClick={() => {
              setApplyFormError(null);
              setIsApplyModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Plus size={16} /> Request Time Off
          </button>
        </div>
      </div>

      {/* Quota Balances Grid */}
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
          My 2026 Leave Quotas
        </h2>
        <div className="grid-cols-4">
          {balances.length === 0 ? (
            <div className="card" style={{ gridColumn: "span 4", textAlign: "center", padding: "30px 16px", color: "var(--text-muted)" }}>
              No leave balances currently recorded for 2026.
            </div>
          ) : (
            balances.map((b) => (
              <div key={b.balance_id || `${b.leave_type_name}-${b.year}`} className="card card-interactive">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {b.leave_type_name || "Leave"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "var(--bg-surface-elevated)",
                      color: "var(--color-primary-400)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {b.type_code || "LV"}
                  </span>
                </div>

                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-primary-400)", lineHeight: 1.1, marginBottom: 6 }}>
                  {b.remaining_days ?? b.remaining_leaves ?? 0}{" "}
                  <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 500 }}>days left</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: 8,
                  }}
                >
                  <span>Allocated: {b.allocated_days ?? b.total_allocated ?? 0}</span>
                  <span>Used: {b.used_days ?? b.used_leaves ?? 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Tabs Card */}
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {canApprove && (
              <button
                onClick={() => setActiveTab("pending")}
                className="btn btn-sm"
                style={{
                  background: activeTab === "pending" ? "var(--color-primary-600)" : "transparent",
                  color: activeTab === "pending" ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                Pending Approvals ({pendingRequests.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("my")}
              className="btn btn-sm"
              style={{
                background: activeTab === "my" ? "var(--color-primary-600)" : "transparent",
                color: activeTab === "my" ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              My Requests ({myRequests.length})
            </button>
            {canApprove && (
              <button
                onClick={() => setActiveTab("all")}
                className="btn btn-sm"
                style={{
                  background: activeTab === "all" ? "var(--color-primary-600)" : "transparent",
                  color: activeTab === "all" ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                All Organization Requests ({requests.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("types")}
              className="btn btn-sm"
              style={{
                background: activeTab === "types" ? "var(--color-primary-600)" : "transparent",
                color: activeTab === "types" ? "#ffffff" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Settings2 size={14} /> Leave Types & Policies ({leaveTypes.length})
            </button>
          </div>

          {activeTab !== "types" && (
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Showing {paginatedRequests.length} of {displayedRequests.length} requests
            </span>
          )}
        </div>

        {/* TAB 1, 2, 3: Requests Table */}
        {activeTab !== "types" ? (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Dates & Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action / Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                        No leave requests found in this view.
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((req) => (
                      <tr key={req.public_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {req.employee_name || "Employee"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {req.department_name}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: "var(--color-primary-400)" }}>
                            {req.leave_type_name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {req.start_date} to {req.end_date}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {req.total_days} {req.total_days === 1 ? "day" : "days"}
                          </div>
                        </td>
                        <td style={{ maxWidth: 280, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {req.reason}
                        </td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td>
                          {req.status === "pending" && canApprove ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => handleAction(req.public_id, "approve")}
                                className="btn btn-success btn-sm"
                                style={{ padding: "4px 8px" }}
                                title="Approve request"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => handleAction(req.public_id, "reject")}
                                className="btn btn-danger btn-sm"
                                style={{ padding: "4px 8px" }}
                                title="Reject request"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {req.action_by_employee_name ? (
                                <>
                                  <div>By {req.action_by_employee_name}</div>
                                  {req.action_notes && <div style={{ fontStyle: "italic" }}>"{req.action_notes}"</div>}
                                </>
                              ) : (
                                "Awaiting review"
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {displayedRequests.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={displayedRequests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="leave requests"
              />
            )}
          </>
        ) : (
          /* TAB 4: Leave Types & Policies (Viewable by All, Editable by Admin) */
          <div>
            {!isOnlyAdmin && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  marginBottom: 16,
                }}
              >
                <Info size={16} style={{ color: "var(--color-primary-400)", flexShrink: 0 }} />
                <span>
                  You are viewing company-wide leave types and policy quotas. Only System Administrators can configure, modify, or delete leave types.
                </span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div style={{ position: "relative", minWidth: 260, maxWidth: 360, flex: 1 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter leave types by name or code..."
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 36, height: 38 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={loadData} className="btn btn-secondary btn-sm" title="Refresh list">
                  <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                </button>
                {isOnlyAdmin && (
                  <button onClick={handleOpenCreateType} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Add Leave Type
                  </button>
                )}
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Annual Quota (Allocated)</th>
                    <th>Compensation</th>
                    <th>Description</th>
                    {isOnlyAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={isOnlyAdmin ? 5 : 4} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)" }}>
                        No leave types match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaveTypes.map((t) => (
                      <tr key={t.public_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 4,
                                background: "var(--bg-surface-elevated)",
                                color: "var(--color-primary-400)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              {t.type_code || (t.type_name || t.name || "").slice(0, 3).toUpperCase()}
                            </span>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                              {t.type_name || t.name}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--color-primary-400)" }}>
                            {t.annual_quota ?? t.max_days_per_year ?? 0}{" "}
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                              days / year
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 9999,
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              background: t.is_paid !== false ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                              color: t.is_paid !== false ? "#10b981" : "#94a3b8",
                              border: `1px solid ${t.is_paid !== false ? "rgba(16, 185, 129, 0.3)" : "rgba(148, 163, 184, 0.3)"}`,
                            }}
                          >
                            {t.is_paid !== false ? "✓ Paid Leave" : "○ Unpaid Leave"}
                          </span>
                        </td>
                        <td style={{ maxWidth: 300, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {t.description || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No description provided</span>}
                        </td>
                        {isOnlyAdmin && (
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                              <button
                                onClick={() => handleOpenEditType(t)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                                title="Edit Leave Type"
                              >
                                <Edit size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleOpenDeleteType(t)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
                                title="Remove Leave Type"
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. APPLY LEAVE MODAL                                                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Submit Leave Request"
      >
        <form onSubmit={handleApplySubmit}>
          {applyFormError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 6,
                background: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                color: "#f43f5e",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{applyFormError}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Leave Type *</label>
            <select
              className="input-field"
              value={applyForm.leave_type_public_id}
              onChange={(e) => setApplyForm({ ...applyForm, leave_type_public_id: e.target.value })}
              required
            >
              {leaveTypes.map((t) => (
                <option key={t.public_id} value={t.public_id}>
                  {(t.type_name || t.name)} ({(t.annual_quota ?? t.max_days_per_year ?? 0)} days/yr quota)
                </option>
              ))}
            </select>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={applyForm.start_date}
                onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={applyForm.end_date}
                onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Dynamic Duration Preview Badge */}
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.86rem",
              background:
                currentDuration > 0
                  ? "rgba(99, 102, 241, 0.1)"
                  : "rgba(244, 63, 94, 0.1)",
              border: `1px solid ${
                currentDuration > 0
                  ? "rgba(99, 102, 241, 0.25)"
                  : "rgba(244, 63, 94, 0.25)"
              }`,
              color: currentDuration > 0 ? "var(--color-primary-400)" : "#f43f5e",
            }}
          >
            <Calendar size={15} />
            {currentDuration > 0 ? (
              <span>
                Calculated Duration: <strong>{currentDuration} {currentDuration === 1 ? "day" : "days"}</strong>
              </span>
            ) : (
              <span>Invalid date range: End date must be on or after start date.</span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Reason for Absence *</label>
            <textarea
              required
              rows={3}
              className="input-field"
              placeholder="Provide context for your manager regarding coverage during your leave..."
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="btn btn-secondary"
              disabled={applySubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={applySubmitting || currentDuration <= 0}
            >
              {applySubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. ADD LEAVE TYPE MODAL (ADMIN ONLY)                                       */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isOnlyAdmin && isCreateTypeModalOpen}
        onClose={() => setIsCreateTypeModalOpen(false)}
        title="Add New Leave Type"
      >
        <form onSubmit={handleCreateTypeSubmit}>
          {typeFormError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 6,
                background: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                color: "#f43f5e",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{typeFormError}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Leave Type Name *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Study Leave, Bereavement Leave, Parental Leave"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Annual Quota (Days Allocated) *</label>
              <input
                type="number"
                min="0"
                max="365"
                required
                className="input-field"
                value={typeForm.max_days_per_year}
                onChange={(e) => setTypeForm({ ...typeForm, max_days_per_year: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <label className="form-label">Compensation Type</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={typeForm.is_paid}
                  onChange={(e) => setTypeForm({ ...typeForm, is_paid: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--color-primary-500)" }}
                />
                <span>Paid Leave (Deduct from salary quota)</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              rows={3}
              className="input-field"
              placeholder="Explain eligibility, prerequisites, or policies regarding this leave type..."
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
            />
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 6,
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 20,
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Automatic Employee Quota Provisioning
            </div>
            This new leave policy will automatically allocate <strong>{typeForm.max_days_per_year} days</strong> to all active corporate employees for 2026.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => setIsCreateTypeModalOpen(false)}
              className="btn btn-secondary"
              disabled={typeFormSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={typeFormSubmitting}
            >
              {typeFormSubmitting ? "Creating..." : "Create Leave Type"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. EDIT LEAVE TYPE MODAL (ADMIN ONLY)                                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isOnlyAdmin && isEditTypeModalOpen}
        onClose={() => setIsEditTypeModalOpen(false)}
        title={`Edit Leave Type: ${selectedTypeForEdit?.type_name || selectedTypeForEdit?.name || ""}`}
      >
        <form onSubmit={handleEditTypeSubmit}>
          {typeFormError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 6,
                background: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                color: "#f43f5e",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{typeFormError}</div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Leave Type Name *</label>
            <input
              type="text"
              required
              className="input-field"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Annual Quota (Days Allocated) *</label>
              <input
                type="number"
                min="0"
                max="365"
                required
                className="input-field"
                value={typeForm.max_days_per_year}
                onChange={(e) => setTypeForm({ ...typeForm, max_days_per_year: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <label className="form-label">Compensation Type</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={typeForm.is_paid}
                  onChange={(e) => setTypeForm({ ...typeForm, is_paid: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--color-primary-500)" }}
                />
                <span>Paid Leave</span>
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Description (Optional)</label>
            <textarea
              rows={3}
              className="input-field"
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => setIsEditTypeModalOpen(false)}
              className="btn btn-secondary"
              disabled={typeFormSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={typeFormSubmitting}
            >
              {typeFormSubmitting ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. CONFIRM DELETE LEAVE TYPE MODAL (ADMIN ONLY)                            */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={isOnlyAdmin && isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteType}
        title="Remove Leave Type"
        message={`Are you sure you want to remove '${typeToDelete?.type_name || typeToDelete?.name}'? Employees will no longer be able to submit requests under this category.`}
        confirmText="Remove Leave Type"
        variant="danger"
        icon="trash"
        isLoading={deleteLoading}
      />
    </div>
  );
}

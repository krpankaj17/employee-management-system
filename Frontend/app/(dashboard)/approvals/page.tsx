"use client";

import React, { useEffect, useState } from "react";
import {
  UserCheck,
  ShieldCheck,
  Clock,
  Search,
  RefreshCw,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Building,
  Briefcase,
  ArrowRight,
  ExternalLink,
  UserX,
  FileText,
  Eye,
  Download,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import { UserProfile, RoleDetail } from "@/types/auth";
import { UserRole } from "@/types/common";
import { DocumentRecord } from "@/types/document";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const AVAILABLE_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "Employee", label: "Employee", desc: "Standard company employee (attendance punches, leaves, payslips)" },
  { value: "Project_Manager", label: "Project Manager", desc: "Lead projects, deliverables, and team evaluations" },
  { value: "Department_Head", label: "Department Head", desc: "Department leader with team oversight and leave approvals" },
  { value: "HR_Manager", label: "HR Manager", desc: "Full employee lifecycle, payroll runs, documents, and onboarding" },
  { value: "Admin", label: "Admin", desc: "Super Administrator with unrestricted enterprise system privileges" },
];

export default function ApprovalsPage() {
  const { role, isAdmin, isHR } = useAuth();
  const isAdminOrHR = isAdmin || isHR || role === "Admin" || role === "HR_Manager";

  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "documents">("pending");

  // Per-user role selection state: { [userPublicId]: selectedRole }
  const [selectedRoles, setSelectedRoles] = useState<{ [publicId: string]: UserRole }>({});
  // Processing state per user: { [userPublicId]: boolean }
  const [processingUser, setProcessingUser] = useState<{ [publicId: string]: boolean }>({});
  // Processing state per document: { [publicId: string]: boolean }
  const [processingDoc, setProcessingDoc] = useState<{ [publicId: string]: boolean }>({});
  // Feedback messages
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Pagination states for all 3 tabs
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedPageSize, setApprovedPageSize] = useState(10);

  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(10);

  useEffect(() => {
    setPendingPage(1);
    setApprovedPage(1);
    setDocPage(1);
  }, [search, activeTab]);

  useEffect(() => {
    loadData();
  }, [role]);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [pending, users, docs] = await Promise.all([
        api.auth.listPendingUsers().catch(() => []),
        api.auth.listUsers().catch(() => []),
        api.documents.listPending().catch(() => []),
      ]);

      setPendingUsers(pending);
      setAllUsers(users);
      setPendingDocuments(docs);

      // Pre-initialize selected role for each pending user as "Employee"
      const roleMap: { [publicId: string]: UserRole } = {};
      pending.forEach((u) => {
        roleMap[u.public_id] = "Employee";
      });
      setSelectedRoles((prev) => ({ ...roleMap, ...prev }));
    } catch (err: any) {
      console.error("Failed to load approvals data:", err);
      setActionFeedback({ type: "error", message: "Failed to fetch approvals data." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleVerifyDocument = async (docPublicId: string, status: "Verified" | "Rejected") => {
    setProcessingDoc((prev) => ({ ...prev, [docPublicId]: true }));
    setActionFeedback(null);
    try {
      const defaultNote = status === "Verified"
        ? (role === "Admin" ? "Verified by Admin" : "Verified by HR")
        : "Discrepancy noted during verification";
      await api.documents.verify(docPublicId, {
        status,
        verification_notes: defaultNote,
      });
      setPendingDocuments((prev) => prev.filter((d) => d.public_id !== docPublicId));
      setActionFeedback({
        type: "success",
        message: `Document status successfully set to ${status}.`,
      });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || `Failed to update document status to ${status}.`,
      });
    } finally {
      setProcessingDoc((prev) => ({ ...prev, [docPublicId]: false }));
    }
  };

  const handleRoleChange = (userPublicId: string, newRole: UserRole) => {
    setSelectedRoles((prev) => ({ ...prev, [userPublicId]: newRole }));
  };

  const handleApproveUser = async (u: UserProfile) => {
    const assignedRole = selectedRoles[u.public_id] || "Employee";
    setProcessingUser((prev) => ({ ...prev, [u.public_id]: true }));
    setActionFeedback(null);

    try {
      await api.auth.assignUserRoles(u.public_id, [assignedRole]);

      // Remove from pending list
      setPendingUsers((prev) => prev.filter((item) => item.public_id !== u.public_id));

      // Append to allUsers list with newly assigned role
      const newlyApproved: UserProfile = {
        ...u,
        roles: [
          {
            role_id: 10,
            role_name: assignedRole,
            description: `Assigned as ${assignedRole}`,
            permissions: [],
          },
        ],
      };
      setAllUsers((prev) => [...prev.filter((item) => item.public_id !== u.public_id), newlyApproved]);

      setActionFeedback({
        type: "success",
        message: `Approved! ${u.display_name} has been assigned the '${assignedRole}' role. An active Employee record has been auto-provisioned in the directory!`,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-pending-count"));
      }

      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || `Failed to assign role to ${u.display_name}.`,
      });
    } finally {
      setProcessingUser((prev) => ({ ...prev, [u.public_id]: false }));
    }
  };

  const [userToReject, setUserToReject] = useState<UserProfile | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleRejectUser = (u: UserProfile) => {
    setUserToReject(u);
  };

  const executeRejectUser = async () => {
    if (!userToReject) return;
    const u = userToReject;
    setIsRejecting(true);
    setProcessingUser((prev) => ({ ...prev, [u.public_id]: true }));
    setActionFeedback(null);

    try {
      await api.auth.rejectUser(u.public_id);

      // Remove from pending list
      setPendingUsers((prev) => prev.filter((item) => item.public_id !== u.public_id));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-pending-count"));
      }

      setActionFeedback({
        type: "success",
        message: `Rejected: Registration request for ${u.display_name} (${u.email}) has been discarded.`,
      });

      setUserToReject(null);
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || `Failed to reject ${u.display_name}.`,
      });
    } finally {
      setIsRejecting(false);
      setProcessingUser((prev) => ({ ...prev, [u.public_id]: false }));
    }
  };

  if (!isAdminOrHR) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <ShieldCheck size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          User role assignment and onboarding approvals require <strong>Admin</strong> or <strong>HR Manager</strong> permissions.
        </p>
      </div>
    );
  }

  const filteredPending = pendingUsers.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedPending = filteredPending.slice(
    (pendingPage - 1) * pendingPageSize,
    pendingPage * pendingPageSize
  );

  const filteredApproved = allUsers.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedApproved = filteredApproved.slice(
    (approvedPage - 1) * approvedPageSize,
    approvedPage * approvedPageSize
  );

  const filteredPendingDocs = pendingDocuments.filter(
    (d) =>
      (d.document_name && d.document_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.employee_name && d.employee_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.document_type && d.document_type.toLowerCase().includes(search.toLowerCase()))
  );
  const paginatedDocs = filteredPendingDocs.slice(
    (docPage - 1) * docPageSize,
    docPage * docPageSize
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            User Registrations & Verification Approvals
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Review unapproved user accounts, assign corporate roles, and verify employee compliance documents
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          className="btn btn-secondary"
          disabled={refreshing}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Queue"}</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, borderLeft: "4px solid var(--color-amber-500)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-md)",
              background: "rgba(245, 158, 11, 0.15)",
              color: "var(--color-amber-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Awaiting Role Assignment
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
              {pendingUsers.length}
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--color-amber-400)", marginTop: 2 }}>
              Unapproved User Accounts
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, borderLeft: "4px solid var(--color-cyan-500)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-md)",
              background: "rgba(6, 182, 212, 0.15)",
              color: "var(--color-cyan-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Pending Documents
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
              {pendingDocuments.length}
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--color-cyan-400)", marginTop: 2 }}>
              Awaiting Verification
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, borderLeft: "4px solid var(--color-emerald-500)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-md)",
              background: "rgba(16, 185, 129, 0.15)",
              color: "var(--color-emerald-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Auto-Provisioning Engine
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
              Active & Automated
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Direct employee creation upon role assignment
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, borderLeft: "4px solid var(--color-primary-500)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-md)",
              background: "rgba(99, 102, 241, 0.15)",
              color: "var(--color-primary-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Total Provisioned Users
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
              {allUsers.length}
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Accounts with assigned roles
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionFeedback && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            background: actionFeedback.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
            border: `1px solid ${actionFeedback.type === "success" ? "var(--color-emerald-500)" : "var(--color-rose-500)"}`,
            color: actionFeedback.type === "success" ? "var(--color-emerald-400)" : "var(--color-rose-400)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          {actionFeedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          background: "var(--bg-surface-elevated)",
          padding: 12,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`filter-pill ${activeTab === "pending" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Clock size={15} />
            <span>Pending Users ({pendingUsers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`filter-pill ${activeTab === "documents" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <FileText size={15} />
            <span>Pending Documents ({pendingDocuments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`filter-pill ${activeTab === "approved" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <CheckCircle2 size={15} />
            <span>Approved Accounts ({allUsers.length})</span>
          </button>
        </div>

        <div style={{ position: "relative", minWidth: 260, flex: 1, maxWidth: 380 }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search by name or corporate email..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === "pending" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
              <RefreshCw size={28} className="spin" style={{ margin: "0 auto 12px", color: "var(--color-primary-400)" }} />
              <div>Loading unassigned user registrations...</div>
            </div>
          ) : filteredPending.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <CheckCircle2 size={44} style={{ color: "var(--color-emerald-400)", margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Queue Clear!
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 460, margin: "0 auto" }}>
                There are no unassigned users awaiting approval. Every registered account has been assigned a role and provisioned into the employee system.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>Email Address</th>
                    <th>Email Status</th>
                    <th>Registered At</th>
                    <th style={{ minWidth: 220 }}>Assign System Role</th>
                    <th style={{ textAlign: "right", minWidth: 240 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPending.map((u) => {
                    const currentSelectedRole = selectedRoles[u.public_id] || "Employee";
                    const isProcessing = !!processingUser[u.public_id];

                    return (
                      <tr key={u.public_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, var(--color-primary-600), var(--color-cyan-600))",
                                color: "#ffffff",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.9rem",
                              }}
                            >
                              {u.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{u.display_name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {u.public_id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                          <code>{u.email}</code>
                        </td>

                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "3px 10px",
                              borderRadius: 20,
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "var(--color-emerald-400)",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                            }}
                          >
                            <CheckCircle2 size={13} /> OTP Verified
                          </span>
                        </td>

                        <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "Recently"}
                        </td>

                        <td>
                          <select
                            className="input-field"
                            value={currentSelectedRole}
                            disabled={isProcessing}
                            onChange={(e) => handleRoleChange(u.public_id, e.target.value as UserRole)}
                            style={{ fontSize: "0.88rem", padding: "8px 12px", width: "100%" }}
                          >
                            {AVAILABLE_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => handleApproveUser(u)}
                              disabled={isProcessing}
                              className="btn btn-primary"
                              style={{
                                padding: "8px 14px",
                                fontSize: "0.82rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw size={14} className="spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck size={14} />
                                  <span>Approve & Create</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRejectUser(u)}
                              disabled={isProcessing}
                              className="btn"
                              style={{
                                padding: "8px 12px",
                                fontSize: "0.82rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "rgba(244, 63, 94, 0.12)",
                                color: "var(--color-rose-400)",
                                border: "1px solid rgba(244, 63, 94, 0.3)",
                                whiteSpace: "nowrap",
                              }}
                              title="Reject and discard this registration"
                            >
                              <UserX size={14} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Users Pagination Controls */}
          {filteredPending.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <Pagination
                currentPage={pendingPage}
                totalItems={filteredPending.length}
                pageSize={pendingPageSize}
                onPageChange={setPendingPage}
                onPageSizeChange={setPendingPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="pending users"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPROVED USERS DIRECTORY */}
      {activeTab === "approved" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Account</th>
                  <th>Email</th>
                  <th>Assigned Roles</th>
                  <th>Employee Profile</th>
                  <th style={{ textAlign: "right" }}>Directory Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredApproved.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                      No approved users found matching your search.
                    </td>
                  </tr>
                ) : (
                  paginatedApproved.map((u) => (
                    <tr key={u.public_id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "var(--bg-surface-elevated)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-primary)",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.82rem",
                            }}
                          >
                            {u.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.display_name}</div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>ID: {u.public_id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                        <code>{u.email}</code>
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {u.roles && u.roles.length > 0 ? (
                            u.roles.map((r, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "rgba(99, 102, 241, 0.15)",
                                  color: "var(--color-primary-400)",
                                  border: "1px solid rgba(99, 102, 241, 0.3)",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                }}
                              >
                                {String(typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "Employee")).replace(/_/g, " ")}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "0.78rem", color: "var(--color-amber-400)" }}>Pending Role</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "var(--color-emerald-400)",
                            fontSize: "0.76rem",
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 size={12} /> Active Employee
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <Link
                          href="/employees"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <span>View In Directory</span>
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Approved Accounts Pagination Controls */}
          {filteredApproved.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <Pagination
                currentPage={approvedPage}
                totalItems={filteredApproved.length}
                pageSize={approvedPageSize}
                onPageChange={setApprovedPage}
                onPageSizeChange={setApprovedPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="approved accounts"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
              <RefreshCw size={28} className="spin" style={{ margin: "0 auto 12px", color: "var(--color-primary-400)" }} />
              <div>Loading pending documents...</div>
            </div>
          ) : filteredPendingDocs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <CheckCircle2 size={44} style={{ color: "var(--color-emerald-400)", margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                All Documents Verified!
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 460, margin: "0 auto" }}>
                There are no employee compliance documents pending verification right now.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Employee</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Uploaded Date</th>
                    <th>Notes</th>
                    <th style={{ textAlign: "right", minWidth: 260 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocs.map((doc) => {
                    const isProcessing = !!processingDoc[doc.public_id];
                    return (
                      <tr key={doc.public_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                            <FileText size={18} style={{ color: "var(--color-primary-400)", flexShrink: 0 }} />
                            <div>
                              <div style={{ color: "var(--text-primary)" }}>{doc.document_name}</div>
                              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                                {doc.public_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {doc.employee_public_id ? (
                            <Link
                              href={`/employees/${doc.employee_public_id}`}
                              style={{ fontWeight: 600, color: "var(--color-primary-400)", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <span>{doc.employee_name || "View Employee"}</span>
                              <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <span style={{ color: "var(--text-secondary)" }}>{doc.employee_name || "—"}</span>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              textTransform: "uppercase",
                              fontFamily: "var(--font-mono)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "var(--bg-surface-elevated)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {doc.document_type}
                          </span>
                        </td>

                        <td>
                          <StatusBadge status={doc.status || "Pending_Verification"} />
                        </td>

                        <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                        </td>

                        <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: 220 }}>
                          {doc.verification_notes || "Awaiting review"}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => window.open(api.documents.getViewUrl(doc.public_id), "_blank")}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                              title="View document inline"
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => api.documents.download(doc.public_id, doc.document_name)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                              title="Download document"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleVerifyDocument(doc.public_id, "Verified")}
                              className="btn btn-success btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                              title="Verify document"
                            >
                              <Check size={14} /> {isProcessing ? "Saving..." : "Verify"}
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleVerifyDocument(doc.public_id, "Rejected")}
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                              title="Reject document"
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Documents Pagination Controls */}
          {filteredPendingDocs.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <Pagination
                currentPage={docPage}
                totalItems={filteredPendingDocs.length}
                pageSize={docPageSize}
                onPageChange={setDocPage}
                onPageSizeChange={setDocPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                itemLabel="pending documents"
              />
            </div>
          )}
        </div>
      )}

      {/* Reject Registration Confirmation Modal */}
      <ConfirmModal
        isOpen={!!userToReject}
        onClose={() => {
          if (!isRejecting) setUserToReject(null);
        }}
        onConfirm={executeRejectUser}
        title="Reject Registration"
        message={
          userToReject
            ? `Are you sure you want to reject the registration request for "${userToReject.display_name}" (${userToReject.email})? This will discard the registration from the approvals queue.`
            : ""
        }
        confirmText="Reject Registration"
        cancelText="Cancel"
        variant="danger"
        icon="user-minus"
        isLoading={isRejecting}
      />
    </div>
  );
}

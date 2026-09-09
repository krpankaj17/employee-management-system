"use client";

import React, { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Plus,
  Users,
  Search,
  Check,
  X,
  Trash2,
  Edit,
  Clock,
  UserPlus,
  Key,
  Layers,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  UserX,
  UserCheck2,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { RoleDetail, Permission, UserProfile } from "@/types/auth";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OnboardEmployeeModal } from "@/components/roles/OnboardEmployeeModal";

export default function RolesManagementPage() {
  const { role, isHR, isAdmin, mounted } = useAuth();

  const [activeTab, setActiveTab] = useState<"roles" | "users" | "pending">("roles");
  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);

  // Search & Filters
  const [roleSearch, setRoleSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Create Role Modal
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedNewPerms, setSelectedNewPerms] = useState<string[]>([]);
  const [permSearch, setPermSearch] = useState("");
  const [selectedPermModule, setSelectedPermModule] = useState("all");

  // Edit Permissions Modal
  const [isEditPermsModalOpen, setIsEditPermsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [editingPermsList, setEditingPermsList] = useState<string[]>([]);

  // Assign/Revoke User Role Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [selectedRolesToAssign, setSelectedRolesToAssign] = useState<string[]>([]);
  const [roleToDelete, setRoleToDelete] = useState<{ identifier: string; name: string } | null>(null);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState(false);

  // Onboarding Modal
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [onboardingTargetUser, setOnboardingTargetUser] = useState<UserProfile | null>(null);

  // Single Employee Direct Permission Override Modal
  const [isPermOverrideModalOpen, setIsPermOverrideModalOpen] = useState(false);
  const [overrideTargetUser, setOverrideTargetUser] = useState<UserProfile | null>(null);
  const [overrideCustomPerms, setOverrideCustomPerms] = useState<string[]>([]);
  const [overrideRevokedPerms, setOverrideRevokedPerms] = useState<string[]>([]);
  const [overridePermSearch, setOverridePermSearch] = useState("");
  const [overrideModuleFilter, setOverrideModuleFilter] = useState("all");

  // Pagination for User Directory & Pending Queue
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(5);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(5);

  // Success / Error Alerts
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (mounted && isAdmin) {
      loadData();
    }
  }, [mounted, isAdmin]);

  const loadData = async () => {
    try {
      const [r, p, u, pu] = await Promise.all([
        api.auth.listRolesDetailed(),
        api.auth.listPermissions(),
        api.auth.listUsers(),
        api.auth.listPendingUsers(),
      ]);
      setRoles(r);
      setPermissions(p);
      setUsers(u);
      setPendingUsers(pu);
    } catch (e: any) {
      setErrorBanner(e.message);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  if (!mounted) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Authorization Check - Admin Only
  if (!isAdmin) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: 650, margin: "40px auto" }}>
        <ShieldAlert size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted to Super Administrators
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          Role definition, system-wide permission assignment, and security governance require <strong>Super Administrator</strong> credentials.
        </p>
      </div>
    );
  }

  // --- Handlers for Create Role ---
  const handleOpenCreateRole = () => {
    setNewRoleName("");
    setNewRoleDesc("");
    setSelectedNewPerms([]);
    setPermSearch("");
    setSelectedPermModule("all");
    setIsCreateRoleModalOpen(true);
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const created = await api.auth.createRole({
        role_name: newRoleName.trim(),
        description: newRoleDesc.trim(),
        permissions: selectedNewPerms,
      });
      setRoles([...roles, created]);
      setIsCreateRoleModalOpen(false);
      showSuccess(`Role '${created.role_name}' created successfully with ${created.permissions.length} permissions.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to create role.");
    }
  };

  // --- Handlers for Edit Permissions ---
  const handleOpenEditPerms = (roleItem: RoleDetail) => {
    setEditingRole(roleItem);
    setEditingPermsList([...roleItem.permissions]);
    setPermSearch("");
    setSelectedPermModule("all");
    setIsEditPermsModalOpen(true);
  };

  const handleToggleEditPerm = (permName: string) => {
    if (editingPermsList.includes(permName)) {
      setEditingPermsList(editingPermsList.filter((p) => p !== permName));
    } else {
      setEditingPermsList([...editingPermsList, permName]);
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!editingRole) return;
    try {
      const updated = await api.auth.updateRole(editingRole.public_id, {
        permissions: editingPermsList,
      });
      setRoles(roles.map((r) => (r.public_id === updated.public_id ? updated : r)));
      setIsEditPermsModalOpen(false);
      showSuccess(`Permissions for role '${editingRole.role_name}' updated successfully.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to update role permissions.");
    }
  };

  // --- Handlers for Delete Role ---
  const handleDeleteRole = (identifier: string, name: string) => {
    setRoleToDelete({ identifier, name });
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeleteRoleLoading(true);
    try {
      await api.auth.deleteRole(roleToDelete.identifier);
      setRoles((prev) => prev.filter((r) => r.public_id !== roleToDelete.identifier && r.role_name !== roleToDelete.identifier));
      showSuccess(`Role '${roleToDelete.name}' deleted successfully.`);
      setRoleToDelete(null);
    } catch (err: any) {
      setErrorBanner(err.message || "Cannot delete role.");
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  // --- Handlers for User Role Assignment / Revocation ---
  const handleOpenUserRoleModal = (u: UserProfile) => {
    setTargetUser(u);
    setSelectedRolesToAssign((u.roles || []).map((r) => (typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "Employee"))));
    setIsAssignModalOpen(true);
  };

  const handleSaveUserRoles = async () => {
    if (!targetUser) return;
    try {
      await api.auth.assignUserRoles(targetUser.public_id, selectedRolesToAssign);
      const updatedUser: UserProfile = {
        ...targetUser,
        roles: selectedRolesToAssign.map((rn, i) => ({
          role_id: i + 10,
          role_name: rn as any,
          description: `Assigned as ${rn}`,
          permissions: [],
        })),
      };
      setUsers(users.map((u) => (u.public_id === targetUser.public_id ? updatedUser : u)));
      setIsAssignModalOpen(false);
      showSuccess(`Roles updated for ${targetUser.display_name}.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to update user roles.");
    }
  };

  // --- Handlers for Pending Onboarding ---
  const handleOpenOnboard = (pu: UserProfile) => {
    setOnboardingTargetUser(pu);
    setIsOnboardModalOpen(true);
  };

  const handleOnboardSuccess = () => {
    loadData();
    showSuccess("Employee onboarded, activated, and linked to corporate record.");
  };

  // --- Handlers for Granular Permission Overrides ---
  const handleOpenPermOverride = (u: UserProfile) => {
    setOverrideTargetUser(u);
    setOverrideCustomPerms(u.custom_permissions || []);
    setOverrideRevokedPerms(u.revoked_permissions || []);
    setOverridePermSearch("");
    setOverrideModuleFilter("all");
    setIsPermOverrideModalOpen(true);
  };

  const handleSavePermOverride = async () => {
    if (!overrideTargetUser) return;
    try {
      await api.auth.updateUserAccess(overrideTargetUser.public_id, {
        custom_permissions: overrideCustomPerms,
        revoked_permissions: overrideRevokedPerms,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.public_id === overrideTargetUser.public_id
            ? { ...u, custom_permissions: overrideCustomPerms, revoked_permissions: overrideRevokedPerms }
            : u
        )
      );
      setIsPermOverrideModalOpen(false);
      showSuccess(`Direct permission overrides saved for ${overrideTargetUser.display_name}.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to update user permissions override.");
    }
  };

  const handleToggleUserActive = async (u: UserProfile) => {
    try {
      const nextActive = !u.is_active;
      await api.auth.updateUserAccess(u.public_id, { is_active: nextActive });
      setUsers((prev) =>
        prev.map((item) => (item.public_id === u.public_id ? { ...item, is_active: nextActive } : item))
      );
      showSuccess(`Account access for ${u.display_name} set to ${nextActive ? "Active" : "Inactive"}.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to update user account status.");
    }
  };

  const handleRevokeSingleRole = async (u: UserProfile, roleName: string) => {
    try {
      await api.auth.revokeUserRole(u.public_id, roleName);
      setUsers((prev) =>
        prev.map((item) =>
          item.public_id === u.public_id
            ? {
                ...item,
                roles: (item.roles || []).filter(
                  (r) => (typeof r === "string" ? r : (r?.role_name || (r as any)?.name)) !== roleName
                ),
              }
            : item
        )
      );
      showSuccess(`Role ${roleName} revoked from ${u.display_name}.`);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to revoke role.");
    }
  };

  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  const filteredPerms = permissions.filter((p) => {
    const matchesSearch =
      p.permission_name.toLowerCase().includes(permSearch.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(permSearch.toLowerCase());
    const matchesModule = selectedPermModule === "all" || p.module === selectedPermModule;
    return matchesSearch && matchesModule;
  });

  if (mounted && !isAdmin) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: 650, margin: "40px auto" }}>
        <ShieldAlert size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          Security role creation, RBAC permissions governance, and onboarding approvals are restricted to <strong>Super Admin</strong> administrators only.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Role & Permission Governance
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            RBAC security administration, custom role provisioning, and pending employee onboarding queue
          </p>
        </div>

        {activeTab === "roles" && (
          <button onClick={handleOpenCreateRole} className="btn btn-primary">
            <Plus size={16} /> Create Custom Role
          </button>
        )}
      </div>

      {/* Notification Banners */}
      {successBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--color-emerald-400)", fontSize: "0.88rem" }}>
          <CheckCircle2 size={16} /> {successBanner}
        </div>
      )}
      {errorBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--color-rose-400)", fontSize: "0.88rem" }}>
          <AlertCircle size={16} /> {errorBanner}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid-cols-4">
        <div className="card">
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            System Roles
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
            {roles.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-primary-400)", marginTop: 2 }}>
            5 Built-in • {roles.filter((r) => !r.is_system).length} Custom
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Granular Permissions
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-cyan-400)", marginTop: 4 }}>
            {permissions.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Across {modules.length} operational modules
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Active Corporate Users
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-emerald-400)", marginTop: 4 }}>
            {users.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Roles Assigned & Active
          </div>
        </div>

        <div className="card" style={{ borderColor: pendingUsers.length > 0 ? "rgba(245, 158, 11, 0.4)" : "var(--border-subtle)" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-amber-400)", textTransform: "uppercase" }}>
            Pending Onboarding Queue
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-amber-400)", marginTop: 4 }}>
            {pendingUsers.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            Verified emails awaiting HR role setup
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 2 }}>
        <button
          onClick={() => setActiveTab("roles")}
          style={{
            padding: "8px 16px",
            borderBottom: activeTab === "roles" ? "2px solid var(--color-primary-500)" : "none",
            color: activeTab === "roles" ? "var(--color-primary-400)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Shield size={16} /> Roles & Permissions ({roles.length})
        </button>

        <button
          onClick={() => setActiveTab("users")}
          style={{
            padding: "8px 16px",
            borderBottom: activeTab === "users" ? "2px solid var(--color-primary-500)" : "none",
            color: activeTab === "users" ? "var(--color-primary-400)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Users size={16} /> User Role Assignments ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "8px 16px",
            borderBottom: activeTab === "pending" ? "2px solid var(--color-amber-400)" : "none",
            color: activeTab === "pending" ? "var(--color-amber-400)" : "var(--text-secondary)",
            background: "none",
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={16} /> Pending Onboarding Queue ({pendingUsers.length})
        </button>
      </div>

      {/* TAB 1: Roles & Permissions */}
      {activeTab === "roles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {roles.map((r) => (
              <div key={r.public_id || r.role_name} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {String(r.role_name || (r as any)?.name || "Role").replace(/_/g, " ")}
                      </span>
                      {r.is_system ? (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10, background: "rgba(99, 102, 241, 0.15)", color: "var(--color-primary-400)", fontWeight: 600 }}>
                          Built-in
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10, background: "rgba(34, 211, 238, 0.15)", color: "var(--color-cyan-400)", fontWeight: 600 }}>
                          Custom
                        </span>
                      )}
                    </div>

                    {!r.is_system && (
                      <button
                        onClick={() => handleDeleteRole(r.public_id, r.role_name)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--color-rose-400)", padding: 4 }}
                        title="Delete custom role"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 14, minHeight: 38 }}>
                    {r.description || "No description provided."}
                  </p>

                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                    Granted Permissions ({r.permissions.length})
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto", padding: 2 }}>
                    {r.permissions.map((perm) => (
                      <span
                        key={perm}
                        style={{
                          fontSize: "0.72rem",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                  <button
                    onClick={() => handleOpenEditPerms(r)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Edit size={14} /> Edit Role Permissions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: User Role Assignments & Permissions Governance */}
      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search user by name or email..."
                className="input-field"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                style={{ paddingLeft: 38 }}
              />
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Total Users: <strong>{users.filter((u) => u.display_name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).length}</strong>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Corporate Email</th>
                  <th>Status</th>
                  <th>Assigned Roles</th>
                  <th>Custom Overrides</th>
                  <th style={{ textAlign: "right" }}>Access Controls</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(
                    (u) =>
                      u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .slice((userPage - 1) * userPageSize, userPage * userPageSize)
                  .map((u) => {
                    const customCount = u.custom_permissions?.length || 0;
                    const revokedCount = u.revoked_permissions?.length || 0;
                    return (
                      <tr key={u.public_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {u.display_name}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {u.public_id}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 8px",
                              borderRadius: 10,
                              fontWeight: 600,
                              background: u.is_active ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: u.is_active ? "var(--color-emerald-400)" : "var(--color-rose-400)",
                              border: `1px solid ${u.is_active ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                            }}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {(!u.roles || u.roles.length === 0) ? (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No role assigned</span>
                            ) : (
                              u.roles.map((r, rIdx) => {
                                const roleName = typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "Employee");
                                const isSuper = String(roleName).toUpperCase().includes("ADMIN");
                                return (
                                  <span
                                    key={`${roleName}-${rIdx}`}
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "3px 10px",
                                      borderRadius: 12,
                                      background: isSuper ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                      color: isSuper ? "var(--color-primary-300)" : "var(--text-secondary)",
                                      border: "1px solid var(--border-subtle)",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    {String(roleName).replace(/_/g, " ")}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td>
                          {customCount > 0 || revokedCount > 0 ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {customCount > 0 && (
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "var(--color-emerald-400)",
                                    fontWeight: 600,
                                  }}
                                >
                                  +{customCount} granted
                                </span>
                              )}
                              {revokedCount > 0 && (
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    background: "rgba(239, 68, 68, 0.15)",
                                    color: "var(--color-rose-400)",
                                    fontWeight: 600,
                                  }}
                                >
                                  -{revokedCount} revoked
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Default (Role)</span>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              onClick={() => handleOpenUserRoleModal(u)}
                              className="btn btn-secondary btn-sm"
                              title="Assign or revoke enterprise roles"
                            >
                              <Shield size={14} /> Manage Roles
                            </button>
                            <button
                              onClick={() => handleOpenPermOverride(u)}
                              className="btn btn-secondary btn-sm"
                              title="Grant extra or revoke specific individual permissions"
                            >
                              <Sliders size={14} /> Permissions
                            </button>
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className="btn btn-ghost btn-sm"
                              style={{
                                color: u.is_active ? "var(--color-rose-400)" : "var(--color-emerald-400)",
                                padding: "4px 8px",
                              }}
                              title={u.is_active ? "Deactivate user login access" : "Restore user access"}
                            >
                              {u.is_active ? <UserX size={15} /> : <UserCheck2 size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={userPage}
            totalItems={
              users.filter(
                (u) =>
                  u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(userSearch.toLowerCase())
              ).length
            }
            pageSize={userPageSize}
            onPageChange={setUserPage}
            onPageSizeChange={setUserPageSize}
          />
        </div>
      )}

      {/* TAB 3: Pending Onboarding Queue */}
      {activeTab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ background: "rgba(245, 158, 11, 0.08)", borderColor: "rgba(245, 158, 11, 0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-amber-400)", fontWeight: 700, fontSize: "0.92rem", marginBottom: 4 }}>
              <Clock size={16} /> Self-Service Registration & Onboarding Pipeline
            </div>
            <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: 0 }}>
              The users below have self-registered and authenticated their corporate email addresses via 6-digit OTP.
              Click <strong>Onboard Employee</strong> to configure their organizational department, designation, salary structure, and active enterprise role.
            </p>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <CheckCircle2 size={36} style={{ color: "var(--color-emerald-400)", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Queue is Clear!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                All registered users have been assigned roles and onboarded into the organization.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Candidate / User</th>
                      <th>Email Address</th>
                      <th>Email Verification</th>
                      <th>Registration Timestamp</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers
                      .slice((pendingPage - 1) * pendingPageSize, pendingPage * pendingPageSize)
                      .map((pu) => (
                        <tr key={pu.public_id}>
                          <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {pu.display_name}
                          </td>
                          <td style={{ color: "var(--text-secondary)" }}>{pu.email}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", color: "var(--color-emerald-400)", fontSize: "0.75rem", fontWeight: 600 }}>
                              <Check size={12} /> Verified OTP
                            </span>
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            {pu.created_at ? new Date(pu.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() => handleOpenOnboard(pu)}
                              className="btn btn-primary btn-sm"
                            >
                              <UserPlus size={14} /> Onboard Employee
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pendingPage}
                totalItems={pendingUsers.length}
                pageSize={pendingPageSize}
                onPageChange={setPendingPage}
                onPageSizeChange={setPendingPageSize}
              />
            </>
          )}
        </div>
      )}

      {/* MODAL 1: Create Custom Role */}
      <Modal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        title="Create Custom Enterprise Role"
        size="lg"
      >
        <form onSubmit={handleCreateRoleSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Role Identifier Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Compliance_Auditor"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="input-field"
                placeholder="Describe role responsibilities..."
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Select Permissions ({selectedNewPerms.length} Selected)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedNewPerms(permissions.map((p) => p.permission_name))}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNewPerms([])}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, maxHeight: 260, overflowY: "auto", padding: 4, background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              {permissions.map((p) => {
                const isChecked = selectedNewPerms.includes(p.permission_name);
                return (
                  <label
                    key={p.permission_name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: isChecked ? "rgba(99, 102, 241, 0.15)" : "transparent",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedNewPerms(selectedNewPerms.filter((s) => s !== p.permission_name));
                        } else {
                          setSelectedNewPerms([...selectedNewPerms, p.permission_name]);
                        }
                      }}
                    />
                    <span style={{ fontFamily: "var(--font-mono)", color: isChecked ? "var(--color-primary-400)" : "var(--text-primary)" }}>
                      {p.permission_name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button type="button" onClick={() => setIsCreateRoleModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Role
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Role Permissions */}
      <Modal
        isOpen={isEditPermsModalOpen}
        onClose={() => setIsEditPermsModalOpen(false)}
        title={`Edit Permissions: ${editingRole?.role_name}`}
        size="lg"
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Toggle granular system entitlements for this role ({editingPermsList.length} enabled)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setEditingPermsList(permissions.map((p) => p.permission_name))}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem" }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setEditingPermsList([])}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem" }}
              >
                Clear All
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto", padding: 6, background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            {permissions.map((p) => {
              const isChecked = editingPermsList.includes(p.permission_name);
              return (
                <label
                  key={p.permission_name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: isChecked ? "rgba(99, 102, 241, 0.15)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleEditPerm(p.permission_name)}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", color: isChecked ? "var(--color-primary-400)" : "var(--text-primary)" }}>
                    {p.permission_name}
                  </span>
                </label>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button type="button" onClick={() => setIsEditPermsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSaveRolePermissions} className="btn btn-primary">
              Save Permissions
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Assign / Revoke User Roles */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign / Revoke Roles: ${targetUser?.display_name}`}
      >
        <div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16 }}>
            Select one or more active roles to grant to <strong>{targetUser?.email}</strong>. Unchecking a role revokes its associated permissions.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {roles.map((r) => {
              const roleName = typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "");
              const isAssigned = selectedRolesToAssign.includes(roleName);
              return (
                <label
                  key={roleName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: isAssigned ? "rgba(99, 102, 241, 0.12)" : "var(--bg-surface-elevated)",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                      {String(roleName).replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {r.description}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={() => {
                      if (isAssigned) {
                        setSelectedRolesToAssign(selectedRolesToAssign.filter((rn) => rn !== roleName));
                      } else {
                        setSelectedRolesToAssign([...selectedRolesToAssign, roleName]);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSaveUserRoles} className="btn btn-primary">
              Save Role Assignments
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Onboard Employee */}
      <OnboardEmployeeModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        user={onboardingTargetUser}
        onSuccess={handleOnboardSuccess}
      />

      {/* MODAL 5: Single Employee Granular Permission Overrides */}
      <Modal
        isOpen={isPermOverrideModalOpen}
        onClose={() => setIsPermOverrideModalOpen(false)}
        title={`Granular Permissions: ${overrideTargetUser?.display_name}`}
        size="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
            Configure individual permission overrides for <strong>{overrideTargetUser?.email}</strong>.
            You can explicitly <strong>grant (+)</strong> permissions outside their role, or <strong>revoke (-)</strong> specific permissions without removing their assigned role.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Filter permissions by name or description..."
                className="input-field"
                value={overridePermSearch}
                onChange={(e) => setOverridePermSearch(e.target.value)}
                style={{ paddingLeft: 34, fontSize: "0.82rem" }}
              />
            </div>
            <select
              className="input-field"
              value={overrideModuleFilter}
              onChange={(e) => setOverrideModuleFilter(e.target.value)}
              style={{ width: "auto", fontSize: "0.82rem" }}
            >
              <option value="all">All Modules ({modules.length})</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 8,
              maxHeight: 340,
              overflowY: "auto",
              padding: 8,
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {permissions
              .filter((p) => {
                const matchesSearch =
                  p.permission_name.toLowerCase().includes(overridePermSearch.toLowerCase()) ||
                  (p.description || "").toLowerCase().includes(overridePermSearch.toLowerCase());
                const matchesModule = overrideModuleFilter === "all" || p.module === overrideModuleFilter;
                return matchesSearch && matchesModule;
              })
              .map((p) => {
                const userRoleNames = (overrideTargetUser?.roles || []).map((r) => typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "")) || [];
                const isRoleDefault = roles
                  .filter((r) => userRoleNames.includes((r.role_name || (r as any)?.name) as any))
                  .some((r) => r.permissions.includes(p.permission_name));

                const isCustomGranted = overrideCustomPerms.includes(p.permission_name);
                const isExplicitRevoked = overrideRevokedPerms.includes(p.permission_name);

                return (
                  <div
                    key={p.permission_name}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      background: isExplicitRevoked
                        ? "rgba(239, 68, 68, 0.08)"
                        : isCustomGranted
                        ? "rgba(16, 185, 129, 0.08)"
                        : isRoleDefault
                        ? "rgba(99, 102, 241, 0.05)"
                        : "transparent",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {p.permission_name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            background: isExplicitRevoked
                              ? "rgba(239, 68, 68, 0.2)"
                              : isCustomGranted
                              ? "rgba(16, 185, 129, 0.2)"
                              : isRoleDefault
                              ? "rgba(99, 102, 241, 0.15)"
                              : "var(--bg-surface)",
                            color: isExplicitRevoked
                              ? "var(--color-rose-400)"
                              : isCustomGranted
                              ? "var(--color-emerald-400)"
                              : isRoleDefault
                              ? "var(--color-primary-300)"
                              : "var(--text-muted)",
                          }}
                        >
                          {isExplicitRevoked
                            ? "Revoked (-)"
                            : isCustomGranted
                            ? "Granted (+)"
                            : isRoleDefault
                            ? "Role Default"
                            : "Inactive"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {p.description}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomGranted) {
                            setOverrideCustomPerms(overrideCustomPerms.filter((x) => x !== p.permission_name));
                          } else {
                            setOverrideCustomPerms([...overrideCustomPerms, p.permission_name]);
                            setOverrideRevokedPerms(overrideRevokedPerms.filter((x) => x !== p.permission_name));
                          }
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          color: isCustomGranted ? "var(--color-emerald-400)" : "var(--text-secondary)",
                          background: isCustomGranted ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        }}
                      >
                        <PlusCircle size={12} /> {isCustomGranted ? "Granted" : "Grant (+)"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isExplicitRevoked) {
                            setOverrideRevokedPerms(overrideRevokedPerms.filter((x) => x !== p.permission_name));
                          } else {
                            setOverrideRevokedPerms([...overrideRevokedPerms, p.permission_name]);
                            setOverrideCustomPerms(overrideCustomPerms.filter((x) => x !== p.permission_name));
                          }
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          color: isExplicitRevoked ? "var(--color-rose-400)" : "var(--text-secondary)",
                          background: isExplicitRevoked ? "rgba(239, 68, 68, 0.15)" : "transparent",
                        }}
                      >
                        <MinusCircle size={12} /> {isExplicitRevoked ? "Revoked" : "Revoke (-)"}
                      </button>

                      {(isCustomGranted || isExplicitRevoked) && (
                        <button
                          type="button"
                          onClick={() => {
                            setOverrideCustomPerms(overrideCustomPerms.filter((x) => x !== p.permission_name));
                            setOverrideRevokedPerms(overrideRevokedPerms.filter((x) => x !== p.permission_name));
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "0.7rem", padding: "2px 6px", color: "var(--text-muted)" }}
                          title="Reset to role default"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setIsPermOverrideModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSavePermOverride}
              className="btn btn-primary"
            >
              Save Permission Overrides
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Custom Frontend Confirm Modal: Delete Role ── */}
      <ConfirmModal
        isOpen={!!roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDeleteRole}
        title="Delete Custom Role"
        message={
          roleToDelete ? (
            <span>
              Are you sure you want to permanently delete the custom role <strong style={{ color: "var(--text-primary)" }}>&quot;{roleToDelete.name}&quot;</strong>? Any employees assigned to this role will lose these permissions.
            </span>
          ) : ""
        }
        confirmText="Delete Role"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        isLoading={deleteRoleLoading}
      />
    </div>
  );
}

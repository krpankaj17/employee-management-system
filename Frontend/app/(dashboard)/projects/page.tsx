"use client";

import React, { useEffect, useState } from "react";
import {
  FolderKanban,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  User,
  Search,
  Trash2,
  UserPlus,
  UserMinus,
  AlertCircle,
  X,
  Edit2,
  UserCheck,
  UserX,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { Project, ProjectMember } from "@/types/project";
import { StatusBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { hasPermission, useAuth } from "@/lib/auth";
import { Employee } from "@/types/employee";

function ProjectStatusSelector({
  status,
  onChange,
  disabled = false,
}: {
  status: Project["status"];
  onChange: (newStatus: Project["status"]) => void;
  disabled?: boolean;
}) {
  const s = String(status || "").toLowerCase();
  let variant: "success" | "warning" | "danger" | "neutral" = "neutral";
  if (["active", "completed"].includes(s)) variant = "success";
  else if (["planning", "on_hold"].includes(s)) variant = "warning";
  else if (["cancelled"].includes(s)) variant = "danger";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      title="Quickly change project status"
    >
      <select
        value={status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Project["status"])}
        className={`badge badge-${variant}`}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          border: "1px solid currentColor",
          fontWeight: 600,
          fontSize: "0.75rem",
          padding: "3px 20px 3px 8px",
          borderRadius: "9999px",
          appearance: "none",
          WebkitAppearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
          backgroundSize: "8px",
          outline: "none",
        }}
      >
        <option value="active" style={{ background: "#18181b", color: "#34d399" }}>Active</option>
        <option value="planning" style={{ background: "#18181b", color: "#fbbf24" }}>Planning</option>
        <option value="on_hold" style={{ background: "#18181b", color: "#fbbf24" }}>On Hold</option>
        <option value="completed" style={{ background: "#18181b", color: "#34d399" }}>Completed</option>
        <option value="cancelled" style={{ background: "#18181b", color: "#fb7185" }}>Cancelled</option>
      </select>
    </div>
  );
}

export default function ProjectsPage() {
  const { role, user, isEmployee: isEmployeeRole } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const canCreate = !isEmployeeRole && (hasPermission("project:create") || role === "Admin" || role === "Project_Manager");

  const canDelete = !isEmployeeRole && (hasPermission("project:delete") || role === "Admin" || role === "Project_Manager");
  const canManageHead = !isEmployeeRole && (role === "Admin" || role === "Project_Manager" || hasPermission("project:update"));
  const canEditProject = !isEmployeeRole && (role === "Admin" || role === "Project_Manager" || hasPermission("project:update"));

  // Project Head Assignment States
  const [isChangeHeadOpen, setIsChangeHeadOpen] = useState(false);
  const [selectedHeadToAssign, setSelectedHeadToAssign] = useState("");
  const [headActionLoading, setHeadActionLoading] = useState(false);

  // Edit Project Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPrj, setEditPrj] = useState({
    public_id: "",
    project_name: "",
    project_code: "",
    description: "",
    head_employee_public_id: "",
    status: "active",
    start_date: "",
    end_date: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Team Member Management States
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState("");
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<"Lead" | "Developer" | "Designer" | "QA" | "DevOps">("Developer");
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberFeedback, setMemberFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Frontend Confirmation Dialog States
  const [memberToRemove, setMemberToRemove] = useState<{ empId: string; empName: string } | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ publicId: string; name: string } | null>(null);
  const [deleteProjectLoading, setDeleteProjectLoading] = useState(false);
  const [projectActionFeedback, setProjectActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);

  const [employees, setEmployees] = useState<Employee[]>([]);

  // New project form state matching database table `projects`
  const [newPrj, setNewPrj] = useState({
    project_name: "",
    project_code: "",
    description: "",
    head_employee_public_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  });

  useEffect(() => {
    loadProjects();
  }, [role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const loadProjects = async () => {
    try {
      const [list, empRes] = await Promise.all([
        api.projects.list().catch(() => []),
        api.employees.list({ limit: 100 }).then((r) => r.items).catch(() => []),
      ]);
      setProjects(list);
      setEmployees(empRes);
      if (empRes.length > 0) {
        setNewPrj((prev) => ({
          ...prev,
          head_employee_public_id: prev.head_employee_public_id || empRes[0].public_id,
        }));
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.projects.create({
        project_code: newPrj.project_code || "PRJ-NEW",
        project_name: newPrj.project_name,
        description: newPrj.description,
        status: "active",
        start_date: newPrj.start_date,
        end_date: newPrj.end_date || null,
        head_employee_public_id: newPrj.head_employee_public_id || null,
      });
      setProjects([created, ...projects]);
      setIsCreateModalOpen(false);
      setProjectActionFeedback({ type: "success", message: `Project "${created.project_name}" initialized successfully.` });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } catch (err: any) {
      console.warn("Failed to create project:", err);
      setProjectActionFeedback({ type: "error", message: err.message || "Failed to create project." });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    }
  };

  const handleOpenEditModal = (p: Project) => {
    const headPid = p.head_employee_public_id || p.project_head_public_id || "";
    setEditPrj({
      public_id: p.public_id,
      project_name: p.project_name,
      project_code: p.project_code,
      description: p.description || "",
      head_employee_public_id: headPid,
      status: p.status || "active",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrj.public_id) return;
    setEditSubmitting(true);
    try {
      const updated = await api.projects.update(editPrj.public_id, {
        project_name: editPrj.project_name,
        description: editPrj.description,
        status: editPrj.status as any,
        start_date: editPrj.start_date || undefined,
        end_date: editPrj.end_date || null,
        project_head_public_id: editPrj.head_employee_public_id || "",
        head_employee_public_id: editPrj.head_employee_public_id || "",
      });

      const headName = editPrj.head_employee_public_id
        ? empMap.get(editPrj.head_employee_public_id) || updated.head_employee_name || updated.project_head_name || "Lead"
        : null;

      const patched: Project = {
        ...updated,
        project_name: editPrj.project_name,
        project_code: editPrj.project_code || updated.project_code,
        description: editPrj.description,
        status: editPrj.status as any,
        start_date: editPrj.start_date,
        end_date: editPrj.end_date || null,
        head_employee_public_id: editPrj.head_employee_public_id || null,
        project_head_public_id: editPrj.head_employee_public_id || null,
        head_employee_name: headName,
        project_head_name: headName,
        members: selectedProject?.public_id === editPrj.public_id ? selectedProject.members : updated.members,
        members_count: selectedProject?.public_id === editPrj.public_id ? selectedProject.members_count : updated.members_count,
      };

      setProjects((prev) => prev.map((p) => (p.public_id === patched.public_id ? patched : p)));
      if (selectedProject?.public_id === patched.public_id) {
        setSelectedProject(patched);
      }
      setIsEditModalOpen(false);
      setProjectActionFeedback({
        type: "success",
        message: `Project "${patched.project_name}" updated successfully. Project Lead: ${headName || "Unassigned"}.`,
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } catch (err: any) {
      console.warn("Failed to update project:", err);
      setProjectActionFeedback({
        type: "error",
        message: err.message || "Failed to update project.",
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleQuickChangeStatus = async (
    p: Project,
    newStatus: Project["status"],
    e?: React.MouseEvent | React.ChangeEvent
  ) => {
    if (e) e.stopPropagation();
    if (p.status === newStatus) return;
    try {
      const updated = await api.projects.update(p.public_id, {
        status: newStatus as any,
      });
      const patched: Project = {
        ...p,
        status: newStatus,
      };
      setProjects((prev) => prev.map((item) => (item.public_id === p.public_id ? patched : item)));
      if (selectedProject?.public_id === p.public_id) {
        setSelectedProject(patched);
      }
      setProjectActionFeedback({
        type: "success",
        message: `Status of "${p.project_name}" updated to ${newStatus.replace(/_/g, " ").toUpperCase()}.`,
      });
      setTimeout(() => setProjectActionFeedback(null), 3000);
    } catch (err: any) {
      console.warn("Failed to update status:", err);
      setProjectActionFeedback({
        type: "error",
        message: err.message || "Failed to update project status.",
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    }
  };

  const handleDeleteProjectClick = (e: React.MouseEvent, publicId: string, name: string) => {
    e.stopPropagation();
    setProjectToDelete({ publicId, name });
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleteProjectLoading(true);
    try {
      await api.projects.delete(projectToDelete.publicId);
      setProjects((prev) => prev.filter((p) => p.public_id !== projectToDelete.publicId));
      if (selectedProject?.public_id === projectToDelete.publicId) {
        setIsDetailModalOpen(false);
      }
      setProjectActionFeedback({ type: "success", message: `Project "${projectToDelete.name}" was permanently deleted.` });
      setTimeout(() => setProjectActionFeedback(null), 4000);
      setProjectToDelete(null);
    } catch (err: any) {
      console.warn("Failed to delete project:", err);
      setProjectActionFeedback({ type: "error", message: err.message || "Failed to delete project." });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } finally {
      setDeleteProjectLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedEmpToAdd) return;
    setMemberActionLoading(true);
    setMemberFeedback(null);
    try {
      const added = await api.projects.addMember(selectedProject.public_id, {
        employee_public_id: selectedEmpToAdd,
        role_in_project: selectedRoleToAdd,
      });

      const emp = employees.find((x) => x.public_id === selectedEmpToAdd);
      const fullAdded: ProjectMember = {
        ...added,
        employee_name: added.employee_name || (emp ? `${emp.first_name} ${emp.last_name}` : "Team Member"),
      };

      const updatedMembers = [...(selectedProject.members || [])];
      const existingIdx = updatedMembers.findIndex((m) => m.employee_public_id === fullAdded.employee_public_id);
      if (existingIdx !== -1) {
        updatedMembers[existingIdx] = fullAdded;
      } else {
        updatedMembers.push(fullAdded);
      }

      const updatedProj: Project = {
        ...selectedProject,
        members: updatedMembers,
        members_count: updatedMembers.length,
      };

      setSelectedProject(updatedProj);
      setProjects((prev) => prev.map((p) => (p.public_id === updatedProj.public_id ? updatedProj : p)));
      setSelectedEmpToAdd("");
      setIsAddMemberOpen(false);
      setMemberFeedback({ type: "success", message: `${fullAdded.employee_name} assigned as ${fullAdded.role_in_project} successfully!` });
      setTimeout(() => setMemberFeedback(null), 4000);
    } catch (err: any) {
      setMemberFeedback({ type: "error", message: err.message || "Failed to add member to project." });
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMemberClick = (empId: string, empName: string) => {
    setMemberToRemove({ empId, empName });
  };

  const handleConfirmRemoveMember = async () => {
    if (!selectedProject || !memberToRemove) return;
    setMemberActionLoading(true);
    setMemberFeedback(null);
    try {
      await api.projects.removeMember(selectedProject.public_id, memberToRemove.empId);
      const updatedMembers = (selectedProject.members || []).filter((m) => m.employee_public_id !== memberToRemove.empId);
      const updatedProj: Project = {
        ...selectedProject,
        members: updatedMembers,
        members_count: updatedMembers.length,
      };

      setSelectedProject(updatedProj);
      setProjects((prev) => prev.map((p) => (p.public_id === updatedProj.public_id ? updatedProj : p)));
      setMemberFeedback({ type: "success", message: `${memberToRemove.empName} was removed from the project team.` });
      setTimeout(() => setMemberFeedback(null), 4000);
      setMemberToRemove(null);
    } catch (err: any) {
      setMemberFeedback({ type: "error", message: err.message || "Failed to remove member." });
      setTimeout(() => setMemberFeedback(null), 4000);
    } finally {
      setMemberActionLoading(false);
    }
  };

  // Employee Name Map for resilient Project Lead resolution
  const empMap = new Map<string, string>();
  employees.forEach((emp) => {
    empMap.set(emp.public_id, `${emp.first_name} ${emp.last_name}`.trim());
  });

  const getLeadName = (p: Project | null | undefined): string => {
    if (!p) return "Unassigned";
    if (p.head_employee_name && p.head_employee_name.trim()) return p.head_employee_name;
    if (p.project_head_name && p.project_head_name.trim()) return p.project_head_name;
    const headPid = p.head_employee_public_id || p.project_head_public_id;
    if (headPid && empMap.has(headPid)) return empMap.get(headPid)!;
    return "Unassigned";
  };

  const handleSaveHeadAssignment = async (newHeadPublicId: string) => {
    if (!selectedProject) return;
    setHeadActionLoading(true);
    try {
      const updated = await api.projects.update(selectedProject.public_id, {
        project_head_public_id: newHeadPublicId || "",
        head_employee_public_id: newHeadPublicId || "",
      });

      const headName = newHeadPublicId
        ? empMap.get(newHeadPublicId) || updated.head_employee_name || updated.project_head_name || "Assigned Lead"
        : null;

      const patched: Project = {
        ...selectedProject,
        ...updated,
        head_employee_public_id: newHeadPublicId || null,
        project_head_public_id: newHeadPublicId || null,
        head_employee_name: headName,
        project_head_name: headName,
      };

      setSelectedProject(patched);
      setProjects((prev) => prev.map((p) => (p.public_id === patched.public_id ? patched : p)));
      setIsChangeHeadOpen(false);
      setProjectActionFeedback({
        type: "success",
        message: newHeadPublicId
          ? `Project head assigned to ${headName}.`
          : `Project head removed from "${selectedProject.project_name}".`,
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } catch (err: any) {
      console.warn("Failed to update project head:", err);
      setProjectActionFeedback({
        type: "error",
        message: err.message || "Failed to update project head.",
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } finally {
      setHeadActionLoading(false);
    }
  };

  const handleQuickChangeHead = async (p: Project, newHeadPublicId: string) => {
    try {
      const updated = await api.projects.update(p.public_id, {
        project_head_public_id: newHeadPublicId || "",
        head_employee_public_id: newHeadPublicId || "",
      });

      const headName = newHeadPublicId
        ? empMap.get(newHeadPublicId) || updated.head_employee_name || updated.project_head_name || "Assigned Lead"
        : null;

      const patched: Project = {
        ...p,
        ...updated,
        head_employee_public_id: newHeadPublicId || null,
        project_head_public_id: newHeadPublicId || null,
        head_employee_name: headName,
        project_head_name: headName,
      };

      setProjects((prev) => prev.map((item) => (item.public_id === patched.public_id ? patched : item)));
      if (selectedProject?.public_id === patched.public_id) {
        setSelectedProject(patched);
        setSelectedHeadToAssign(newHeadPublicId);
      }
      setProjectActionFeedback({
        type: "success",
        message: newHeadPublicId
          ? `Project lead for "${p.project_name}" updated to ${headName}.`
          : `Project lead removed from "${p.project_name}".`,
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    } catch (err: any) {
      console.warn("Failed to update project head:", err);
      setProjectActionFeedback({
        type: "error",
        message: err.message || "Failed to update project lead.",
      });
      setTimeout(() => setProjectActionFeedback(null), 4000);
    }
  };

  const availableEmployees = employees.filter(
    (emp) => !selectedProject?.members?.some((m) => m.employee_public_id === emp.public_id)
  );

  // Filter & Pagination
  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    const lead = getLeadName(p).toLowerCase();
    const matchesSearch =
      p.project_name.toLowerCase().includes(q) ||
      p.project_code.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      lead.includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pagedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Projects & Client Engagements
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Tracking {filteredProjects.length} client and internal enterprise technology initiatives
          </p>
        </div>

        {canCreate && (
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {/* Project Action Feedback Toast */}
      {projectActionFeedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            background:
              projectActionFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${
              projectActionFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            color:
              projectActionFeedback.type === "success"
                ? "var(--color-emerald-400)"
                : "var(--color-rose-400)",
            fontSize: "0.88rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {projectActionFeedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{projectActionFeedback.message}</span>
        </div>
      )}

      {/* Toolbar: Search & Status Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--bg-surface-elevated)",
          padding: 12,
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 420 }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search projects by code, title, lead..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "All Projects" },
            { key: "active", label: "Active" },
            { key: "planning", label: "Planning" },
            { key: "on_hold", label: "On Hold" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`filter-pill ${statusFilter === tab.key ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Cards Grid */}
      {pagedProjects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <FolderKanban size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            No Projects Found
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Try adjusting your search query or status filter.
          </p>
        </div>
      ) : (
        <div className="grid-cols-2">
          {pagedProjects.map((p) => (
            <div
              key={p.public_id}
              className="card card-interactive"
              onClick={() => {
                setSelectedProject(p);
                setSelectedHeadToAssign(p.head_employee_public_id || p.project_head_public_id || "");
                setIsDetailModalOpen(true);
              }}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-primary-400)", fontWeight: 700 }}>
                      {p.project_code}
                    </span>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                      {p.project_name}
                    </h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProjectStatusSelector
                      status={p.status}
                      disabled={!canManageHead}
                      onChange={(newStatus) => handleQuickChangeStatus(p, newStatus)}
                    />
                    {canEditProject && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(p);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "4px 9px", fontSize: "0.76rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                        title="Edit project details and project head"
                      >
                        <Edit2 size={12} /> Edit Project
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProjectClick(e, p.public_id, p.project_name)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "4px 6px", color: "var(--color-rose-400)" }}
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 18 }}>
                  {p.description}
                </p>
              </div>

              {/* Footer Metadata & Project Head Quick Selector */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: 12,
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <User size={14} style={{ color: "var(--color-primary-400)" }} />
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.8rem" }}>Head:</span>
                  </div>
                  <select
                    value={p.head_employee_public_id || p.project_head_public_id || ""}
                    onChange={(e) => handleQuickChangeHead(p, e.target.value)}
                    className="input-field"
                    style={{
                      padding: "2px 6px",
                      fontSize: "0.78rem",
                      borderRadius: "var(--radius-sm)",
                      width: "auto",
                      minWidth: 130,
                      maxWidth: 170,
                      cursor: "pointer",
                      fontWeight: 600,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid rgba(99, 102, 241, 0.35)",
                      color: (p.head_employee_public_id || p.project_head_public_id)
                        ? "var(--text-primary)"
                        : "var(--color-rose-400)",
                    }}
                    title="Directly assign, change, or remove the Project Head"
                  >
                    <option value="">-- Unassigned (Remove) --</option>
                    {employees.map((emp) => (
                      <option key={emp.public_id} value={emp.public_id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: "0.78rem" }}>
                    <Users size={13} />
                    {p.members_count}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(p);
                      setSelectedHeadToAssign(p.head_employee_public_id || p.project_head_public_id || "");
                      setIsDetailModalOpen(true);
                      setIsAddMemberOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.74rem", padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}
                    title="Manage team members"
                  >
                    <UserPlus size={12} /> Team
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredProjects.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Project Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedProject?.project_name || "Project Details"}
        maxWidth={700}
      >
        {selectedProject && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary-400)", fontWeight: 700 }}>
                    {selectedProject.project_code}
                  </span>
                  <ProjectStatusSelector
                    status={selectedProject.status}
                    onChange={(newStatus) => handleQuickChangeStatus(selectedProject, newStatus)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedProject)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", padding: "5px 12px" }}
                >
                  <Edit2 size={13} /> Edit Project & Lead
                </button>
              </div>
              <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {selectedProject.description}
              </p>
            </div>

            {/* Project Head & Leadership Management Card */}
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                padding: 16,
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserCheck size={18} style={{ color: "var(--color-primary-400)" }} />
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Project Head / Technical Lead
                  </span>
                  <span
                    style={{
                      fontSize: "0.76rem",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontWeight: 600,
                      background: (selectedProject.head_employee_name || selectedProject.project_head_name)
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                      color: (selectedProject.head_employee_name || selectedProject.project_head_name)
                        ? "var(--color-emerald-400)"
                        : "var(--color-rose-400)",
                    }}
                  >
                    Current: {getLeadName(selectedProject)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>Start: <strong style={{ color: "var(--text-secondary)" }}>{selectedProject.start_date}</strong></span>
                  <span>Target: <strong style={{ color: "var(--text-secondary)" }}>{selectedProject.end_date || "Continuous"}</strong></span>
                </div>
              </div>

              {canManageHead && (
                <>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                    Select an employee from the company directory to assign as the Project Lead, change the current lead, or select unassigned to remove.
                  </p>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="input-field"
                      style={{ flex: 1, minWidth: 220, fontSize: "0.85rem" }}
                      value={selectedHeadToAssign}
                      onChange={(e) => setSelectedHeadToAssign(e.target.value)}
                    >
                      <option value="">-- No Project Head (Unassign / Remove) --</option>
                      {employees.map((emp) => (
                        <option key={emp.public_id} value={emp.public_id}>
                          {emp.first_name} {emp.last_name} ({emp.employee_code} - {emp.designation_name || "Employee"})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={headActionLoading}
                      onClick={() => handleSaveHeadAssignment(selectedHeadToAssign)}
                      className="btn btn-primary btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", padding: "6px 14px" }}
                    >
                      <UserCheck size={14} />
                      {headActionLoading ? "Saving..." : "Save Project Head"}
                    </button>

                    {(selectedProject.head_employee_public_id || selectedProject.project_head_public_id || selectedProject.head_employee_name || selectedProject.project_head_name) && (
                      <button
                        type="button"
                        disabled={headActionLoading}
                        onClick={() => {
                          setSelectedHeadToAssign("");
                          handleSaveHeadAssignment("");
                        }}
                        className="btn btn-danger btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", padding: "6px 14px" }}
                        title="Unassign current project head"
                      >
                        <UserX size={14} /> Remove Head
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Team Members Management */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Assigned Team Members ({selectedProject.members?.length || 0})
                  </h4>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Team members allocated to project deliverables
                  </span>
                </div>
                {canManageHead && (
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                  >
                    <UserPlus size={14} /> {isAddMemberOpen ? "Close Form" : "Add Team Member"}
                  </button>
                )}
              </div>

              {/* Feedback toast banner */}
              {memberFeedback && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    marginBottom: 12,
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: memberFeedback.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    border: memberFeedback.type === "success" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    color: memberFeedback.type === "success" ? "var(--color-emerald-400)" : "var(--color-rose-400)",
                  }}
                >
                  {memberFeedback.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{memberFeedback.message}</span>
                </div>
              )}

              {/* Inline Add Member Form */}
              {isAddMemberOpen && (
                <form
                  onSubmit={handleAddMember}
                  style={{
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                    marginBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Assign New Employee to {selectedProject.project_name}
                  </div>
                  <div className="grid-cols-2" style={{ gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Select Employee *</label>
                      <select
                        required
                        className="input-field"
                        style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                        value={selectedEmpToAdd}
                        onChange={(e) => setSelectedEmpToAdd(e.target.value)}
                      >
                        <option value="">-- Choose employee to allocate --</option>
                        {availableEmployees.map((emp) => (
                          <option key={emp.public_id} value={emp.public_id}>
                            {emp.first_name} {emp.last_name} • {emp.designation_name || emp.department_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Project Role *</label>
                      <select
                        className="input-field"
                        style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                        value={selectedRoleToAdd}
                        onChange={(e) => setSelectedRoleToAdd(e.target.value as any)}
                      >
                        <option value="Lead">Lead / Scrum Master</option>
                        <option value="Developer">Developer (Frontend / Backend)</option>
                        <option value="Designer">Designer (UI / UX)</option>
                        <option value="QA">QA / Test Engineer</option>
                        <option value="DevOps">DevOps / Cloud Specialist</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setIsAddMemberOpen(false)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={memberActionLoading || !selectedEmpToAdd}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "0.78rem" }}
                    >
                      <UserPlus size={13} /> {memberActionLoading ? "Adding..." : "Add to Project Team"}
                    </button>
                  </div>
                </form>
              )}

              {/* Members List */}
              {selectedProject.members && selectedProject.members.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                  {selectedProject.members.map((m) => (
                    <div
                      key={m.member_id || m.employee_public_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={m.employee_name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                            {m.employee_name}
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Joined {m.joined_at || "Recently"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            color: "var(--color-primary-400)",
                            padding: "3px 10px",
                            borderRadius: "var(--radius-full)",
                            background: "rgba(99, 102, 241, 0.15)",
                            border: "1px solid rgba(99, 102, 241, 0.25)",
                          }}
                        >
                          {m.role_in_project}
                        </span>

                        {canManageHead && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberClick(m.employee_public_id, m.employee_name)}
                            disabled={memberActionLoading}
                            title={`Remove ${m.employee_name} from project`}
                            style={{
                              padding: "5px 8px",
                              borderRadius: "var(--radius-sm)",
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                              color: "var(--color-rose-400)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              transition: "all var(--transition-fast)",
                            }}
                          >
                            <UserMinus size={13} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--border-subtle)",
                  }}
                >
                  <Users size={24} style={{ color: "var(--text-muted)", margin: "0 auto 6px" }} />
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                    No team members assigned yet. Click "Add Team Member" above to build the roster.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setIsDetailModalOpen(false)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Next-Gen POS System"
                value={newPrj.project_name}
                onChange={(e) => setNewPrj({ ...newPrj, project_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Project Code *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="PRJ-POS"
                value={newPrj.project_code}
                onChange={(e) => setNewPrj({ ...newPrj, project_code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Project Head / Lead</label>
              <select
                className="input-field"
                value={newPrj.head_employee_public_id}
                onChange={(e) => setNewPrj({ ...newPrj, head_employee_public_id: e.target.value })}
              >
                <option value="">-- Optional: Select Project Lead --</option>
                {employees.map((m) => (
                  <option key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name} ({m.designation_name || m.employee_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={newPrj.start_date}
                onChange={(e) => setNewPrj({ ...newPrj, start_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Target Completion Date (Optional)</label>
            <input
              type="date"
              className="input-field"
              value={newPrj.end_date}
              onChange={(e) => setNewPrj({ ...newPrj, end_date: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Scope & Architecture Description *</label>
            <textarea
              required
              rows={3}
              className="input-field"
              placeholder="Outline deliverables, technical stack, and milestone targets..."
              value={newPrj.description}
              onChange={(e) => setNewPrj({ ...newPrj, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Initialize Project
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Project Modal ── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Project: ${editPrj.project_name || "Project"}`}
      >
        <form onSubmit={handleEditSubmit}>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Next-Gen POS System"
                value={editPrj.project_name}
                onChange={(e) => setEditPrj({ ...editPrj, project_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Project Code *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="PRJ-POS"
                value={editPrj.project_code}
                onChange={(e) => setEditPrj({ ...editPrj, project_code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Project Head / Lead</label>
                {editPrj.head_employee_public_id && (
                  <button
                    type="button"
                    onClick={() => setEditPrj({ ...editPrj, head_employee_public_id: "" })}
                    className="btn btn-ghost btn-xs"
                    style={{ color: "var(--color-rose-400)", padding: "1px 6px", fontSize: "0.72rem" }}
                  >
                    Clear / Remove Lead
                  </button>
                )}
              </div>
              <select
                className="input-field"
                value={editPrj.head_employee_public_id}
                onChange={(e) => setEditPrj({ ...editPrj, head_employee_public_id: e.target.value })}
              >
                <option value="">-- No Project Head (Unassigned / Remove) --</option>
                {employees.map((m) => (
                  <option key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name} ({m.designation_name || m.employee_code})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                Select an employee to assign as lead, change the current lead, or select unassigned to remove.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Status *</label>
              <select
                className="input-field"
                value={editPrj.status}
                onChange={(e) => setEditPrj({ ...editPrj, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="planning">Planning</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="input-field"
                value={editPrj.start_date}
                onChange={(e) => setEditPrj({ ...editPrj, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Completion Date (Optional)</label>
              <input
                type="date"
                className="input-field"
                value={editPrj.end_date}
                onChange={(e) => setEditPrj({ ...editPrj, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Scope & Architecture Description</label>
            <textarea
              rows={3}
              className="input-field"
              placeholder="Outline deliverables, technical stack, and milestone targets..."
              value={editPrj.description}
              onChange={(e) => setEditPrj({ ...editPrj, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={editSubmitting} className="btn btn-primary">
              {editSubmitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Custom Frontend Confirm Modal: Remove Team Member ── */}
      <ConfirmModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Team Member"
        message={
          memberToRemove ? (
            <span>
              Are you sure you want to remove <strong style={{ color: "var(--text-primary)" }}>{memberToRemove.empName}</strong> from <strong style={{ color: "var(--text-primary)" }}>{selectedProject?.project_name}</strong>?
            </span>
          ) : ""
        }
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="danger"
        icon="user-minus"
        isLoading={memberActionLoading}
      />

      {/* ── Custom Frontend Confirm Modal: Delete Project ── */}
      <ConfirmModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDeleteProject}
        title="Delete Project"
        message={
          projectToDelete ? (
            <span>
              Are you sure you want to permanently delete the project <strong style={{ color: "var(--text-primary)" }}>&quot;{projectToDelete.name}&quot;</strong>? All allocated deliverables, timelines, and milestones will be removed.
            </span>
          ) : ""
        }
        confirmText="Delete Project"
        cancelText="Keep Project"
        variant="danger"
        icon="trash"
        isLoading={deleteProjectLoading}
      />
    </div>
  );
}

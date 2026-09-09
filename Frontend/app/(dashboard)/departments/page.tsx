"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Plus,
  Briefcase,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Award,
  Edit2,
  Trash2,
  User,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { Department, Designation } from "@/types/department";
import { Employee } from "@/types/employee";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";

export default function DepartmentsPage() {
  const { role, mounted, isAdmin, isHR } = useAuth();
  const canManage = role === "Admin" || role === "HR_Manager" || isAdmin || isHR;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [deptSearch, setDeptSearch] = useState("");
  const [desSearch, setDesSearch] = useState("");
  const [activeView, setActiveView] = useState<"departments" | "designations">("departments");

  // Pagination for designations
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isDesModalOpen, setIsDesModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Create Department Form
  const [deptFormName, setDeptFormName] = useState("");
  const [deptFormCode, setDeptFormCode] = useState("");
  const [deptFormDesc, setDeptFormDesc] = useState("");
  const [deptFormHead, setDeptFormHead] = useState("");

  // Create Designation Form
  const [desFormTitle, setDesFormTitle] = useState("");
  const [desFormGrade, setDesFormGrade] = useState("L2");
  const [desFormDesc, setDesFormDesc] = useState("");

  // Edit Department Form
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState(false);
  const [editDeptForm, setEditDeptForm] = useState({
    public_id: "",
    dept_name: "",
    dept_code: "",
    description: "",
    head_employee_public_id: "",
  });

  // Delete Department Confirmation
  const [deptToDelete, setDeptToDelete] = useState<{ public_id: string; name: string; memberCount: number } | null>(null);
  const [isDeletingDept, setIsDeletingDept] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depts, des, emps] = await Promise.all([
        api.departments.list().catch(() => []),
        api.departments.listDesignations().catch(() => []),
        api.employees.list({ limit: 100 }).then((r) => r.items).catch(() => []),
      ]);

      setDepartments(depts);
      setDesignations(des);
      setEmployees(emps);

      if (depts.length > 0 && !selectedDeptId) {
        setSelectedDeptId(depts[0].public_id);
      }
    } catch (err) {
      console.error("Failed to load department data:", err);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormName.trim() || !deptFormCode.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const created = await api.departments.create({
        dept_name: deptFormName.trim(),
        dept_code: deptFormCode.trim().toUpperCase(),
        description: deptFormDesc.trim(),
        head_employee_public_id: deptFormHead || undefined,
      });

      setDepartments((prev) => [...prev, created]);
      setSelectedDeptId(created.public_id);
      setIsDeptModalOpen(false);
      setDeptFormName("");
      setDeptFormCode("");
      setDeptFormDesc("");
      setDeptFormHead("");
      setFeedback({ type: "success", message: `Department '${created.department_name}' created successfully.` });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create department." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desFormTitle.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const created = await api.designations.create({
        title: desFormTitle.trim(),
        grade_level: desFormGrade.trim(),
        description: desFormDesc.trim(),
      });

      setDesignations((prev) => [...prev, created]);
      setIsDesModalOpen(false);
      setDesFormTitle("");
      setDesFormGrade("L2");
      setDesFormDesc("");
      setFeedback({ type: "success", message: `Designation '${created.designation_name || created.title}' created successfully.` });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to create designation." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const empMap = new Map<string, string>();
  employees.forEach((emp) => {
    empMap.set(emp.public_id, `${emp.first_name} ${emp.last_name}`.trim());
  });

  const getDeptMemberCount = (d: Department | null | undefined): number => {
    if (!d) return 0;
    if (typeof d.employee_count === "number" && d.employee_count > 0) {
      return d.employee_count;
    }
    return employees.filter((e) => e.department_public_id === d.public_id).length;
  };

  const getDeptHeadName = (d: Department | null | undefined): string => {
    if (!d) return "No Head Assigned";
    if (d.head_employee_name && d.head_employee_name.trim()) return d.head_employee_name;
    if (d.head_employee_public_id && empMap.has(d.head_employee_public_id)) {
      return empMap.get(d.head_employee_public_id)!;
    }
    return "No Head Assigned";
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditDeptForm({
      public_id: dept.public_id,
      dept_name: dept.department_name || dept.dept_name || "",
      dept_code: dept.department_code || dept.dept_code || "",
      description: dept.description || "",
      head_employee_public_id: dept.head_employee_public_id || "",
    });
    setIsEditDeptModalOpen(true);
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeptForm.dept_name.trim() || !editDeptForm.dept_code.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const updated = await api.departments.update(editDeptForm.public_id, {
        dept_name: editDeptForm.dept_name.trim(),
        dept_code: editDeptForm.dept_code.trim().toUpperCase(),
        description: editDeptForm.description.trim(),
        head_employee_public_id: editDeptForm.head_employee_public_id || null,
      });

      setDepartments((prev) =>
        prev.map((d) => (d.public_id === updated.public_id ? { ...d, ...updated } : d))
      );
      setIsEditDeptModalOpen(false);
      setFeedback({ type: "success", message: `Department '${updated.department_name}' updated successfully.` });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update department." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteDept = async () => {
    if (!deptToDelete) return;
    setIsDeletingDept(true);
    setFeedback(null);
    try {
      await api.departments.delete(deptToDelete.public_id);
      setDepartments((prev) => prev.filter((d) => d.public_id !== deptToDelete.public_id));
      if (selectedDeptId === deptToDelete.public_id) {
        const remaining = departments.filter((d) => d.public_id !== deptToDelete.public_id);
        setSelectedDeptId(remaining.length > 0 ? remaining[0].public_id : "");
      }
      setFeedback({ type: "success", message: `Department '${deptToDelete.name}' deleted successfully.` });
      setTimeout(() => setFeedback(null), 5000);
      setDeptToDelete(null);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to delete department." });
    } finally {
      setIsDeletingDept(false);
    }
  };

  const selectedDept = departments.find((d) => d.public_id === selectedDeptId) || departments[0];

  const filteredDepts = departments.filter((d) => {
    const q = deptSearch.toLowerCase();
    const name = (d.department_name || d.dept_name || "").toLowerCase();
    const code = (d.department_code || d.dept_code || "").toLowerCase();
    const head = (d.head_employee_name || "").toLowerCase();
    return name.includes(q) || code.includes(q) || head.includes(q);
  });

  const filteredDesignations = designations.filter((d) => {
    const q = desSearch.toLowerCase();
    const title = (d.title || d.designation_name || "").toLowerCase();
    const code = (d.designation_code || "").toLowerCase();
    const grade = (d.grade_level || "").toLowerCase();
    const desc = (d.description || "").toLowerCase();
    return title.includes(q) || code.includes(q) || grade.includes(q) || desc.includes(q);
  });

  const pagedDesignations = filteredDesignations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (mounted && role === "Employee" && !isAdmin && !isHR) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: 650, margin: "40px auto" }}>
        <ShieldAlert size={48} style={{ color: "var(--color-rose-400)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          Organizational business unit management and designation settings are reserved for <strong>Management</strong> and <strong>HR</strong>.
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
            Departments & Designations
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Enterprise organizational business units, functional reporting hierarchy, and job title registry
          </p>
        </div>

        {canManage && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setFeedback(null); setIsDeptModalOpen(true); }}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Plus size={16} />
              <span>New Department</span>
            </button>
            <button
              onClick={() => { setFeedback(null); setIsDesModalOpen(true); }}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Plus size={16} />
              <span>New Designation</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "var(--radius-md)",
            background: feedback.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
            border: `1px solid ${feedback.type === "success" ? "var(--color-emerald-500)" : "var(--color-rose-500)"}`,
            color: feedback.type === "success" ? "var(--color-emerald-400)" : "var(--color-rose-400)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "0.88rem",
          }}
        >
          {feedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: 20 }}>
        <button
          type="button"
          onClick={() => setActiveView("departments")}
          style={{
            padding: "10px 4px",
            background: "transparent",
            color: activeView === "departments" ? "var(--color-primary-400)" : "var(--text-secondary)",
            fontWeight: activeView === "departments" ? 700 : 500,
            borderBottom: activeView === "departments" ? "2px solid var(--color-primary-500)" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: "0.92rem",
          }}
        >
          <Building2 size={16} />
          <span>Departments ({departments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("designations")}
          style={{
            padding: "10px 4px",
            background: "transparent",
            color: activeView === "designations" ? "var(--color-primary-400)" : "var(--text-secondary)",
            fontWeight: activeView === "designations" ? 700 : 500,
            borderBottom: activeView === "designations" ? "2px solid var(--color-primary-500)" : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: "0.92rem",
          }}
        >
          <Briefcase size={16} />
          <span>Job Designations ({designations.length})</span>
        </button>
      </div>

      {/* VIEW 1: DEPARTMENTS SPLIT VIEW */}
      {activeView === "departments" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 24 }}>
          {/* Left Column: Department List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search departments..."
                className="input-field"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                style={{ paddingLeft: 34, fontSize: "0.82rem" }}
              />
            </div>

            {filteredDepts.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                No departments found matching your filter.
              </div>
            ) : (
              filteredDepts.map((d) => {
                const isSelected = selectedDept?.public_id === d.public_id;
                const dName = d.department_name || d.dept_name || "Department";
                const dCode = d.department_code || d.dept_code || "DEPT";

                return (
                  <div
                    key={d.public_id}
                    onClick={() => setSelectedDeptId(d.public_id)}
                    className="card card-interactive"
                    style={{
                      cursor: "pointer",
                      borderColor: isSelected ? "var(--color-primary-500)" : "var(--border-subtle)",
                      background: isSelected ? "var(--bg-surface-elevated)" : "var(--bg-card)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary-400)" }}>
                        {dCode}
                      </span>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 10, background: "rgba(99, 102, 241, 0.15)", color: "var(--color-primary-300)", fontWeight: 600 }}>
                        {getDeptMemberCount(d)} {getDeptMemberCount(d) === 1 ? "Employee" : "Employees"}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                      {dName}
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Head: {getDeptHeadName(d)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Department Details */}
          {selectedDept ? (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary-400)", fontWeight: 700, fontSize: "0.95rem" }}>
                      {selectedDept.department_code || selectedDept.dept_code}
                    </span>
                    <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      {selectedDept.department_name || selectedDept.dept_name}
                    </h2>
                  </div>

                  {canManage && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditDept(selectedDept)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", padding: "5px 12px" }}
                        title="Edit department details"
                      >
                        <Edit2 size={13} /> Edit Department
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeptToDelete({
                            public_id: selectedDept.public_id,
                            name: selectedDept.department_name || selectedDept.dept_name || "",
                            memberCount: getDeptMemberCount(selectedDept),
                          })
                        }
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--color-rose-400)", padding: "5px 8px" }}
                        title="Delete department"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                  {selectedDept.description || "No specific operational mandate provided for this department."}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Department Lead</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                      {getDeptHeadName(selectedDept)}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Team Size</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                      {getDeptMemberCount(selectedDept)} Allocated Employees
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Operational Metadata */}
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  Department Operational Profile
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Department Code</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-primary-400)", marginTop: 2 }}>
                      {selectedDept.department_code || (selectedDept as any).dept_code || "N/A"}
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Operational Status</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-emerald-400)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-emerald-400)" }} />
                      Active Business Unit
                    </div>
                  </div>
                </div>
              </div>

              {/* Allocated Department Team Members */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={18} style={{ color: "var(--color-primary-400)" }} />
                    Allocated Team Members ({getDeptMemberCount(selectedDept)})
                  </h3>
                </div>

                {employees.filter((e) => e.department_public_id === selectedDept.public_id).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    {employees
                      .filter((e) => e.department_public_id === selectedDept.public_id)
                      .map((emp) => (
                        <div
                          key={emp.public_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "var(--bg-surface-elevated)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            fontSize: "0.86rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, var(--color-primary-500), var(--color-cyan-500))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "0.82rem",
                              }}
                            >
                              {(emp.first_name || "E")[0]}{(emp.last_name || "M")[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                {emp.first_name} {emp.last_name}
                                {emp.public_id === selectedDept.head_employee_public_id && (
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontSize: "0.72rem",
                                      padding: "1px 6px",
                                      borderRadius: 8,
                                      background: "rgba(16, 185, 129, 0.15)",
                                      color: "var(--color-emerald-400)",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Lead
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                {emp.employee_code} • {emp.designation_name || "Specialist"}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {emp.email}
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
                      color: "var(--text-muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No employees currently assigned to this department.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              Select a department to view operational details.
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DESIGNATIONS REGISTRY */}
      {activeView === "designations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ position: "relative", width: 320 }}>
              <Search
                size={15}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search designations by title or grade..."
                className="input-field"
                value={desSearch}
                onChange={(e) => { setDesSearch(e.target.value); setCurrentPage(1); }}
                style={{ paddingLeft: 34, fontSize: "0.85rem" }}
              />
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Showing {filteredDesignations.length} standardized company roles
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job Title / Designation</th>
                    <th>Grade Level</th>
                    <th>Role Description</th>
                    <th style={{ textAlign: "right" }}>Compensation Range</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDesignations.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: 36, color: "var(--text-muted)" }}>
                        No designations matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    pagedDesignations.map((des) => (
                      <tr key={des.public_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {des.title || des.designation_name}
                          </div>
                          {des.designation_code && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {des.designation_code}
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "rgba(99, 102, 241, 0.15)",
                              color: "var(--color-primary-400)",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {des.grade_level || "Standard"}
                          </span>
                        </td>

                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 360 }}>
                          {des.description || "Standard organizational responsibilities and role profile."}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          {des.min_salary && des.max_salary ? (
                            <span style={{ fontSize: "0.85rem", color: "var(--color-emerald-400)", fontWeight: 600 }}>
                              ₹{(des.min_salary / 100000).toFixed(1)}L - ₹{(des.max_salary / 100000).toFixed(1)}L / yr
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Corporate Standard</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 12 }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredDesignations.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* CREATE DEPARTMENT MODAL */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Create New Department">
        <form onSubmit={handleCreateDepartment} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Department Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Information Technology & Security"
              className="input-field"
              value={deptFormName}
              onChange={(e) => setDeptFormName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Department Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ITS"
              className="input-field"
              value={deptFormCode}
              onChange={(e) => setDeptFormCode(e.target.value)}
              style={{ textTransform: "uppercase" }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Head of Department (Optional)
            </label>
            <select
              className="input-field"
              value={deptFormHead}
              onChange={(e) => setDeptFormHead(e.target.value)}
            >
              <option value="">-- Select Department Lead --</option>
              {employees.map((emp) => (
                <option key={emp.public_id} value={emp.public_id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Department Description
            </label>
            <textarea
              rows={3}
              placeholder="Operational charter, functional responsibilities..."
              className="input-field"
              value={deptFormDesc}
              onChange={(e) => setDeptFormDesc(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setIsDeptModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Creating..." : "Create Department"}
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE DESIGNATION MODAL */}
      <Modal isOpen={isDesModalOpen} onClose={() => setIsDesModalOpen(false)} title="Create New Designation">
        <form onSubmit={handleCreateDesignation} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Designation / Role Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Cloud Architect"
              className="input-field"
              value={desFormTitle}
              onChange={(e) => setDesFormTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Grade Level
            </label>
            <select
              className="input-field"
              value={desFormGrade}
              onChange={(e) => setDesFormGrade(e.target.value)}
            >
              <option value="L1">L1 - Entry Associate</option>
              <option value="L2">L2 - Professional / Specialist</option>
              <option value="L3">L3 - Senior Professional</option>
              <option value="L4">L4 - Lead / Staff Specialist</option>
              <option value="L5">L5 - Principal / Department Lead</option>
              <option value="Executive">Executive - VP / Director</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Job Profile & Core Responsibilities
            </label>
            <textarea
              rows={3}
              placeholder="Primary duties, technical prerequisites, seniority level..."
              className="input-field"
              value={desFormDesc}
              onChange={(e) => setDesFormDesc(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setIsDesModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Creating..." : "Create Designation"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT DEPARTMENT MODAL */}
      <Modal isOpen={isEditDeptModalOpen} onClose={() => setIsEditDeptModalOpen(false)} title={`Edit Department: ${editDeptForm.dept_name || "Department"}`}>
        <form onSubmit={handleUpdateDepartment} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Department Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Information Technology & Security"
              className="input-field"
              value={editDeptForm.dept_name}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, dept_name: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Department Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ITS"
              className="input-field"
              value={editDeptForm.dept_code}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, dept_code: e.target.value.toUpperCase() })}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>
                Department Head / Lead
              </label>
              {editDeptForm.head_employee_public_id && (
                <button
                  type="button"
                  onClick={() => setEditDeptForm({ ...editDeptForm, head_employee_public_id: "" })}
                  className="btn btn-ghost btn-xs"
                  style={{ color: "var(--color-rose-400)", padding: "1px 6px", fontSize: "0.72rem" }}
                >
                  Clear / Remove Head
                </button>
              )}
            </div>
            <select
              className="input-field"
              value={editDeptForm.head_employee_public_id}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, head_employee_public_id: e.target.value })}
            >
              <option value="">-- No Department Head (Unassigned / Remove) --</option>
              {employees.map((emp) => (
                <option key={emp.public_id} value={emp.public_id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code} - {emp.designation_name || "Employee"})
                </option>
              ))}
            </select>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              Select an employee to lead this department, or choose unassigned to remove the head.
            </span>
          </div>

          <div>
            <label className="form-label" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.88rem" }}>
              Operational Mandate & Description
            </label>
            <textarea
              rows={3}
              placeholder="Functional charter, responsibilities, objectives..."
              className="input-field"
              value={editDeptForm.description}
              onChange={(e) => setEditDeptForm({ ...editDeptForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setIsEditDeptModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE DEPARTMENT CONFIRMATION MODAL */}
      <Modal isOpen={!!deptToDelete} onClose={() => setDeptToDelete(null)} title="Confirm Delete Department">
        {deptToDelete && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to permanently delete the department <strong>"{deptToDelete.name}"</strong>?
            </p>

            {deptToDelete.memberCount > 0 ? (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid var(--color-rose-500)",
                  color: "var(--color-rose-400)",
                  fontSize: "0.86rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Cannot delete active department:</strong> This department currently has <strong>{deptToDelete.memberCount} allocated employees</strong>. Reassign all employees to other departments before deleting.
                </span>
              </div>
            ) : (
              <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", margin: 0 }}>
                This action is irreversible and will permanently remove this business unit from the organizational registry.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" onClick={() => setDeptToDelete(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={deptToDelete.memberCount > 0 || isDeletingDept}
                onClick={handleConfirmDeleteDept}
                className="btn btn-danger"
              >
                {isDeletingDept ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

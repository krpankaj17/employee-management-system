"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, RoleDetail } from "@/types/auth";
import { Department, Designation } from "@/types/department";
import { Employee } from "@/types/employee";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";
import {
  UserCheck,
  Building,
  Briefcase,
  Calendar,
  CreditCard,
  Layers,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface OnboardEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

const FALLBACK_ROLES: { role_name: string; description: string }[] = [
  { role_name: "Employee", description: "Standard company employee" },
  { role_name: "Project_Manager", description: "Project and delivery lead" },
  { role_name: "Department_Head", description: "Department leadership" },
  { role_name: "HR_Manager", description: "Human resources administration" },
  { role_name: "Admin", description: "Full system administration" },
];

export function OnboardEmployeeModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: OnboardEmployeeModalProps) {
  const [roleName, setRoleName] = useState("Employee");
  const [employeeCode, setEmployeeCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split("T")[0]);
  const [employmentType, setEmploymentType] = useState("Full_Time");

  // Dynamic live lists from backend
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<RoleDetail[]>([]);

  // Compensation
  const [basicSalary, setBasicSalary] = useState(50000);
  const [hra, setHra] = useState(25000);
  const [conveyance, setConveyance] = useState(5000);
  const [specialAllowance, setSpecialAllowance] = useState(15000);

  // Bank Details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmployeeCode(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [user]);

  useEffect(() => {
    Promise.allSettled([
      api.departments.list(),
      api.departments.listDesignations(),
      api.employees.list({ limit: 100 }),
      api.auth.listRolesDetailed(),
    ]).then(([deptRes, desRes, empRes, rolesRes]) => {
      if (deptRes.status === "fulfilled" && deptRes.value.length > 0) {
        setDepartments(deptRes.value);
        setDepartmentId((prev) => prev || deptRes.value[0].public_id);
      }
      if (desRes.status === "fulfilled" && desRes.value.length > 0) {
        setDesignations(desRes.value);
        setDesignationId((prev) => prev || desRes.value[0].public_id);
      }
      if (empRes.status === "fulfilled" && empRes.value.items.length > 0) {
        setEmployees(empRes.value.items);
      }
      if (rolesRes.status === "fulfilled" && rolesRes.value.length > 0) {
        setRoles(rolesRes.value);
      }
    });
  }, []);

  if (!user) return null;

  const names = (user.display_name || user.email || "Employee").split(" ");
  const firstName = names[0] || "Employee";
  const lastName = names.slice(1).join(" ") || "User";

  const selectedDept = departments.find((d) => d.public_id === departmentId);
  const selectedDes = designations.find((d) => d.public_id === designationId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.employees.onboardPendingUser({
        user_public_id: user.public_id,
        role_name: roleName,
        employee_code: employeeCode,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        department_public_id: departmentId,
        department_name: selectedDept?.dept_name || selectedDept?.department_name || "General",
        designation_public_id: designationId || undefined,
        designation_name: selectedDes?.designation_name || selectedDes?.title || (roleName === "Project_Manager" ? "Project Lead" : "Associate Engineer"),
        reporting_manager_public_id: reportingManagerId || undefined,
        joining_date: joiningDate,
        employment_type: employmentType,
        basic_salary: Number(basicSalary),
        hra: Number(hra),
        conveyance: Number(conveyance),
        special_allowance: Number(specialAllowance),
        bank_name: bankName || "Corporate Salary Account",
        account_number: accountNumber || "Pending Bank Entry",
        ifsc_code: ifscCode || "IFSC0000000",
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to onboard employee.");
    } finally {
      setLoading(false);
    }
  };

  const availableRoles = roles.length > 0 ? roles : FALLBACK_ROLES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Onboard Employee: ${user.display_name || user.email}`}
      maxWidth={700}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* User Identity Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
              {user.display_name || user.email}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {user.email} • ID: {user.public_id}
            </div>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(16, 185, 129, 0.15)",
              color: "var(--color-emerald-400)",
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <CheckCircle2 size={12} /> Email Verified
          </div>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--color-rose-400)",
              fontSize: "0.85rem",
            }}
          >
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Section 1: Organizational & Role Assignment */}
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-primary-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            1. Role & Organizational Placement
          </div>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Assign Enterprise Role *</label>
              <select
                className="input-field"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              >
                {availableRoles.map((r) => {
                  const rn = typeof r === "string" ? r : (r?.role_name || (r as any)?.name || "Employee");
                  return (
                    <option key={rn} value={rn}>
                      {String(rn).replace(/_/g, " ")}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Employee Code *</label>
              <input
                type="text"
                required
                className="input-field"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select
                className="input-field"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {departments.length === 0 ? (
                  <option value="">No departments created</option>
                ) : (
                  departments.map((d) => (
                    <option key={d.public_id} value={d.public_id}>
                      {d.dept_name || d.department_name} ({d.dept_code || d.department_code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Designation</label>
              <select
                className="input-field"
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
              >
                {designations.length === 0 ? (
                  <option value="">General Staff</option>
                ) : (
                  designations.map((des) => (
                    <option key={des.public_id} value={des.public_id}>
                      {des.designation_name || des.title || "Designation"} {des.grade_level ? `(${des.grade_level})` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Reporting Manager</label>
              <select
                className="input-field"
                value={reportingManagerId}
                onChange={(e) => setReportingManagerId(e.target.value)}
              >
                <option value="">None (Top Level / Direct)</option>
                {employees.map((m) => (
                  <option key={m.public_id} value={m.public_id}>
                    {m.first_name} {m.last_name} {m.designation_name ? `(${m.designation_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Official Joining Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Employment Type *</label>
            <select
              className="input-field"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="Full_Time">Full Time</option>
              <option value="Part_Time">Part Time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Internship</option>
            </select>
          </div>
        </div>

        {/* Section 2: Compensation Setup */}
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-primary-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            2. Initial Monthly Compensation (INR ₹)
          </div>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Basic Salary (₹/month) *</label>
              <input
                type="number"
                required
                min={0}
                className="input-field"
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">House Rent Allowance (HRA ₹)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={hra}
                onChange={(e) => setHra(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Conveyance Allowance (₹)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={conveyance}
                onChange={(e) => setConveyance(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Special Allowance (₹)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={specialAllowance}
                onChange={(e) => setSpecialAllowance(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Bank Details */}
        <div>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-primary-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            3. Corporate Bank Account
          </div>
          <div className="grid-cols-3">
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank, SBI"
                className="input-field"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input
                type="text"
                placeholder="Account number"
                className="input-field"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input
                type="text"
                placeholder="IFSC code"
                className="input-field"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "Provisioning..." : "Complete Onboarding & Activate Employee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

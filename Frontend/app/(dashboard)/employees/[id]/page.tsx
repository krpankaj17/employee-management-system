"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Building,
  Briefcase,
  MapPin,
  Shield,
  CreditCard,
  Clock,
  Award,
  Plus,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Upload,
  Check,
  X,
  Edit3,
  UserMinus,
  UserCheck,
  KeyRound,
  DollarSign,
  Eye,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { showToast } from "@/components/ui/Toast";
import { Employee, Address } from "@/types/employee";
import { SalaryStructure, BankDetail } from "@/types/payroll";
import { LeaveBalance } from "@/types/leave";
import { AttendanceRecord } from "@/types/attendance";
import { PerformanceReview } from "@/types/review";
import { DocumentRecord, DocumentType } from "@/types/document";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { getActiveUser, getActiveRole, hasPermission, canViewAllEmployees, useAuth } from "@/lib/auth";
import { EditEmployeeModal } from "@/components/employee/EditEmployeeModal";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "compensation" | "attendance" | "reviews" | "documents">("overview");
  const [salary, setSalary] = useState<SalaryStructure | null>(null);
  const [bank, setBank] = useState<BankDetail | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Administrative controls & modals
  const { role, isHR, isAdmin, mounted } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalInitialTab, setEditModalInitialTab] = useState<"general" | "bank" | "statutory" | "salary">("general");
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const canEditEmployee = isAdmin || isHR || hasPermission("employee:update");
  const canDeactivateEmployee = isAdmin || isHR || hasPermission("employee:delete");
  const canVerifyDoc = isAdmin || isHR || hasPermission("document:verify");

  const handleToggleStatus = async () => {
    if (!employee) return;
    setStatusLoading(true);
    try {
      const isCurrentlyActive = (employee.employee_status || "").toLowerCase() === "active";
      const nextStatus = isCurrentlyActive ? "suspended" : "active";
      const updated = await api.employees.toggleStatus(employee.public_id, nextStatus);
      setEmployee(updated);
      setIsDeactivateConfirmOpen(false);
      showToast.success(`Employee lifecycle status updated to ${nextStatus}.`);
    } catch (e: any) {
      showToast.error(e.message || "Failed to update employee lifecycle status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Address modal
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({
    address_type: "Current" as const,
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
  });

  // Document modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocType, setNewDocType] = useState<DocumentType>("aadhaar");
  const [newDocName, setNewDocName] = useState("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (mounted) {
      loadEmployeeData();
    }
  }, [employeeId, mounted, role, isAdmin, isHR]);

  const loadEmployeeData = async () => {
    setForbiddenError(null);
    const currentUser = getActiveUser();

    // Check if current user is privileged (Admin / HR / Management)
    const activeRole = getActiveRole();
    const isPrivileged =
      isAdmin ||
      isHR ||
      activeRole === "Admin" ||
      activeRole === "HR_Manager" ||
      canViewAllEmployees() ||
      hasPermission("employee:read") ||
      hasPermission("employee:view");

    // Only pure Employee role is restricted to their own personnel record
    if (!isPrivileged && currentUser?.employee_public_id && currentUser.employee_public_id !== employeeId) {
      setForbiddenError("Access Restricted: As an Employee, you are only permitted to view your own personnel record.");
      return;
    }

    try {
      const emp = await api.employees.getById(employeeId);
      const resolvedEmp = { ...emp };
      if (!resolvedEmp.department_name && resolvedEmp.department_public_id) {
        try {
          const depts = await api.departments.list();
          const d = depts.find((dept) => dept.public_id === resolvedEmp.department_public_id);
          if (d) resolvedEmp.department_name = d.department_name;
        } catch (e) {}
      }
      if (!resolvedEmp.designation_name && resolvedEmp.designation_public_id) {
        try {
          const desigs = await api.designations.list();
          const ds = desigs.find((des) => des.public_id === resolvedEmp.designation_public_id);
          if (ds) resolvedEmp.designation_name = ds.designation_name || (ds as any).title;
        } catch (e) {}
      }
      setEmployee(resolvedEmp);

      // Related datasets (safely handled with individual try/catch)
      try {
        const balances = await api.leaves.getBalances(employeeId);
        setLeaveBalances(balances || []);
      } catch (e) {
        setLeaveBalances([]);
      }

      try {
        const attRes = await api.attendance.getRecords({ employee_public_id: employeeId });
        setAttendance(attRes.items || []);
      } catch (e) {
        setAttendance([]);
      }

      try {
        const revRes = await api.reviews.list({ employee_public_id: employeeId });
        setReviews(revRes || []);
      } catch (e) {
        setReviews([]);
      }

      try {
        const docs = await api.documents.listByEmployee(employeeId);
        setDocuments(docs || []);
      } catch (e) {
        setDocuments([]);
      }

      try {
        const sal = await api.payroll.getSalary(employeeId);
        setSalary(sal);
      } catch (e) {
        setSalary(null);
      }

      try {
        const bnk = await api.payroll.getBankDetails(employeeId);
        setBank(bnk);
      } catch (e) {
        setBank(null);
      }
    } catch (err: any) {
      console.error("Failed to load employee personnel record:", err);
      const msg = err.message || "";
      if (err.status === 403 || msg.includes("403") || msg.toLowerCase().includes("access not granted") || msg.toLowerCase().includes("forbidden")) {
        setForbiddenError(msg || "Access not granted: You do not have permission to view profiles for other employees.");
      } else {
        setForbiddenError(msg || "Failed to load employee personnel record.");
      }
    }
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    const added: Address = {
      address_public_id: `addr-${Date.now()}`,
      address_type: newAddr.address_type,
      street_address: newAddr.street_address,
      city: newAddr.city,
      state: newAddr.state,
      postal_code: newAddr.postal_code,
      country: newAddr.country,
      is_primary: (employee.addresses?.length || 0) === 0,
    };
    setEmployee({
      ...employee,
      addresses: [...(employee.addresses || []), added],
    });
    setIsAddressModalOpen(false);
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocFile) {
      setDocUploadError("Please select a file to upload.");
      return;
    }
    setDocUploading(true);
    setDocUploadError(null);
    try {
      const doc = await api.documents.upload({
        employee_public_id: employeeId,
        document_type: newDocType,
        document_name: newDocName.trim() || newDocFile.name.replace(/\.[^/.]+$/, "") || `${newDocType.toUpperCase()} Record`,
        file: newDocFile,
      });
      setDocuments([doc, ...documents]);
      setIsDocModalOpen(false);
      setNewDocName("");
      setNewDocFile(null);
    } catch (err: any) {
      setDocUploadError(err.message || "Failed to upload document. Please try again.");
    } finally {
      setDocUploading(false);
    }
  };

  const handleVerifyDoc = async (docPublicId: string, status: "Verified" | "Rejected") => {
    try {
      const defaultNote = status === "Verified"
        ? (isAdmin ? "Verified by Admin" : "Verified by HR")
        : "Discrepancy noted during verification";
      await api.documents.verify(docPublicId, {
        status,
        verification_notes: defaultNote,
      });
      loadEmployeeData();
      showToast.success(`Document status updated to ${status}.`);
    } catch (err: any) {
      showToast.error(err.message || "Failed to update document verification status.");
    }
  };

  if (!mounted) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin" size={36} style={{ color: "var(--color-primary-500)" }} />
      </div>
    );
  }

  // 🔒 403 Forbidden Access Denied Screen (Only for strictly restricted employees)
  const isPrivilegedUser = isAdmin || isHR || canViewAllEmployees() || hasPermission("employee:read") || hasPermission("employee:view");
  if (forbiddenError && !isPrivilegedUser) {
    const currentUser = getActiveUser();
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800, margin: "40px auto" }}>
        <div className="card" style={{ textAlign: "center", padding: "50px 30px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--color-rose-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <ShieldAlert size={36} />
          </div>

          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--color-rose-400)", fontWeight: 700 }}>
            HTTP 403 FORBIDDEN
          </span>

          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 6, marginBottom: 12 }}>
            Access Restricted to Own Profile
          </h2>

          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, maxWidth: 540, margin: "0 auto 24px" }}>
            {forbiddenError}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            {currentUser.employee_public_id && (
              <button
                onClick={() => router.push(`/employees/${currentUser.employee_public_id}`)}
                className="btn btn-primary"
              >
                Go to My Own Profile
              </button>
            )}
            <Link href="/dashboard" className="btn btn-secondary">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading employee profile...</p>
      </div>
    );
  }

  const fullName = `${employee.first_name} ${employee.last_name}`;
  const isEmpActive = (employee.employee_status || "").toLowerCase() === "active";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back Link */}
      <div>
        <Link
          href="/employees"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}
        >
          <ArrowLeft size={16} /> Back to Directory
        </Link>
      </div>

      {/* Header Profile Hero Card */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.08))",
          border: "1px solid var(--border-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Avatar name={fullName} size={72} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {fullName}
              </h1>
              <StatusBadge status={employee.employee_status} />
            </div>
            <div style={{ fontSize: "0.95rem", color: "var(--color-primary-400)", fontWeight: 600, marginBottom: 8 }}>
              {employee.designation_name || "—"} • {employee.department_name || "—"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.82rem", color: "var(--text-secondary)", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                ID: {employee.employee_code}
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Mail size={13} /> {employee.email}
              </span>
              {employee.phone_number && (
                <>
                  <span>•</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Phone size={13} /> {employee.phone_number}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {canEditEmployee && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn btn-primary btn-sm"
              title="Edit employee records and organization info"
            >
              <Edit3 size={14} /> Edit Details
            </button>
          )}

          {canDeactivateEmployee && (
            <button
              onClick={() => setIsDeactivateConfirmOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{
                color: isEmpActive ? "var(--color-rose-400)" : "var(--color-emerald-400)",
                borderColor: isEmpActive ? "rgba(244, 63, 94, 0.3)" : "rgba(16, 185, 129, 0.3)",
              }}
              title={isEmpActive ? "Suspend employee access and offboard" : "Reactivate employee"}
            >
              {isEmpActive ? (
                <>
                  <UserMinus size={14} /> Deactivate Employee
                </>
              ) : (
                <>
                  <UserCheck size={14} /> Reactivate Employee
                </>
              )}
            </button>
          )}

          {(isAdmin || isHR) && (
            <Link
              href={`/roles`}
              className="btn btn-secondary btn-sm"
              title="Configure system role or individual permission overrides"
            >
              <KeyRound size={14} /> Manage Access & Roles
            </Link>
          )}

          <button onClick={() => setIsAddressModalOpen(true)} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Add Address
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: 24 }}>
        {[
          { key: "overview", label: "Overview & Contacts" },
          { key: "compensation", label: "Salary & Banking" },
          { key: "attendance", label: "Attendance & Leaves" },
          { key: "reviews", label: "Performance Reviews" },
          { key: "documents", label: `Documents (${documents.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: "12px 4px",
              background: "transparent",
              color: activeTab === t.key ? "var(--color-primary-400)" : "var(--text-secondary)",
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: "0.92rem",
              borderBottom: activeTab === t.key ? "2px solid var(--color-primary-400)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
          {/* Corporate Details Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Employment & Statutory Information
              </h3>
              {canEditEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalInitialTab("statutory");
                    setIsEditModalOpen(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                >
                  <Edit3 size={13} /> Edit Info
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Employee Code</span>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{employee.employee_code}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Employment Type</span>
                <span style={{ fontWeight: 600 }}>{String(employee.employment_type || "Full Time").replace(/_/g, " ")}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Department</span>
                <span style={{ fontWeight: 600 }}>{employee.department_name}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Designation</span>
                <span style={{ fontWeight: 600 }}>{employee.designation_name}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Work Mode</span>
                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                  {(employee as any).work_mode ? String((employee as any).work_mode).replace(/_/g, " ") : "In Office"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Joining Date</span>
                <span style={{ fontWeight: 600 }}>{new Date(employee.joining_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Permanent PAN</span>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-primary-400)" }}>
                  {employee.pan_number || "ABCDE1234F"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>EPFO UAN</span>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {employee.uan_number || "101294829102"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Aadhar Card</span>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {employee.aadhar_number || "9821-4401-2918"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Reporting Manager</span>
                <span style={{ fontWeight: 600 }}>{employee.reporting_manager_name || "Direct Executive"}</span>
              </div>
            </div>
          </div>

          {/* Addresses & Contacts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Addresses Card */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Registered Addresses
                </h3>
                <button onClick={() => setIsAddressModalOpen(true)} className="btn btn-ghost btn-sm" style={{ color: "var(--color-primary-400)" }}>
                  <Plus size={14} /> Add
                </button>
              </div>

              {employee.addresses && employee.addresses.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {employee.addresses.map((addr) => (
                    <div
                      key={addr.address_public_id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--color-primary-400)", marginBottom: 2 }}>
                        <MapPin size={13} /> {addr.address_type} Address {addr.is_primary && <span style={{ fontSize: "0.7rem", color: "var(--color-emerald-400)" }}>(Primary)</span>}
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        {addr.street_address}, {addr.city}, {addr.state} - {addr.postal_code}, {addr.country}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No addresses recorded yet.</p>
              )}
            </div>

            {/* Emergency Contacts Card */}
            <div className="card">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
                Emergency Contacts
              </h3>
              {employee.emergency_contacts && employee.emergency_contacts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {employee.emergency_contacts.map((contact) => (
                    <div
                      key={contact.contact_id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {contact.contact_name} ({contact.relationship})
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 2 }}>
                        Phone: {contact.phone_number} {contact.email && `• ${contact.email}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No emergency contacts specified.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Compensation & Banking */}
      {activeTab === "compensation" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
          {/* Salary Breakdown */}
          {salary ? (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                    Monthly CTC & Salary Structure
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0 }}>
                    Effective from {new Date(salary.effective_from).toLocaleDateString()}
                  </p>
                </div>
                {canEditEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalInitialTab("salary");
                      setIsEditModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    <Edit3 size={13} /> Edit Structure
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Basic Fixed Salary</span>
                  <span style={{ fontWeight: 600 }}>₹{(Number(salary.basic_salary) || 0).toLocaleString("en-IN")}</span>
                </div>

                {/* Earnings: Dynamic Components with Fallback */}
                {salary.components && salary.components.filter((c) => c.component_type === "earning").length > 0 ? (
                  salary.components
                    .filter((c) => c.component_type === "earning")
                    .map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{c.component_name}</span>
                        <span style={{ fontWeight: 600 }}>₹{(Number(c.amount) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    ))
                ) : (
                  <>
                    {Boolean(salary.hra) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>House Rent Allowance (HRA)</span>
                        <span style={{ fontWeight: 600 }}>₹{(Number(salary.hra) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Boolean(salary.special_allowance) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Special Allowance</span>
                        <span style={{ fontWeight: 600 }}>₹{(Number(salary.special_allowance) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Boolean(salary.conveyance_allowance) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Conveyance Allowance</span>
                        <span style={{ fontWeight: 600 }}>₹{(Number(salary.conveyance_allowance) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "2px solid var(--border-strong)", fontSize: "0.98rem", fontWeight: 700 }}>
                  <span>Gross Monthly Earnings</span>
                  <span style={{ color: "var(--color-emerald-400)" }}>
                    ₹{((salary.gross_salary != null && salary.gross_salary > 0)
                      ? Number(salary.gross_salary)
                      : Number(salary.basic_salary) + (salary.components || []).filter((c) => c.component_type === "earning").reduce((s, c) => s + Number(c.amount || 0), 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Deductions: Dynamic Components with Fallback */}
                {salary.components && salary.components.filter((c) => c.component_type === "deduction").length > 0 ? (
                  salary.components
                    .filter((c) => c.component_type === "deduction")
                    .map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--color-rose-400)" }}>
                        <span>{c.component_name}</span>
                        <span>- ₹{(Number(c.amount) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    ))
                ) : (
                  <>
                    {Boolean(salary.provident_fund) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--color-rose-400)" }}>
                        <span>Provident Fund (EPF)</span>
                        <span>- ₹{(Number(salary.provident_fund) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Boolean(salary.professional_tax) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--color-rose-400)" }}>
                        <span>Professional Tax (PT)</span>
                        <span>- ₹{(Number(salary.professional_tax) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Boolean(salary.tds_tax) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--color-rose-400)" }}>
                        <span>Income Tax (TDS)</span>
                        <span>- ₹{(Number(salary.tds_tax) || 0).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", marginTop: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>Net Take-Home Pay</span>
                  <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--color-emerald-400)" }}>
                    ₹{(Number(salary.net_salary) || 0).toLocaleString("en-IN")} / mo
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
              <DollarSign size={44} style={{ color: "var(--text-muted)", marginBottom: 12, opacity: 0.7 }} />
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                No CTC Structure Assigned
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 320, marginBottom: 18 }}>
                This employee does not have an active compensation package or CTC breakdown assigned yet.
              </p>
              {canEditEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalInitialTab("salary");
                    setIsEditModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6 }}
                >
                  <Plus size={14} /> Configure Salary Breakdown
                </button>
              )}
            </div>
          )}

          {/* Bank Account */}
          {bank ? (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Disbursement Bank Account
                </h3>
                {canEditEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalInitialTab("bank");
                      setIsEditModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    <Edit3 size={13} /> Edit Bank
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Bank Name</span>
                  <span style={{ fontWeight: 600 }}>{bank.bank_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Account Number</span>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{bank.account_number}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>IFSC Code</span>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-cyan-400)" }}>{bank.ifsc_code}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Branch</span>
                  <span style={{ fontWeight: 600 }}>{bank.branch_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Account Type</span>
                  <span style={{ fontWeight: 600 }}>{bank.account_type} Account</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
              <CreditCard size={44} style={{ color: "var(--text-muted)", marginBottom: 12, opacity: 0.7 }} />
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                No Primary Bank Account
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 280, marginBottom: 18 }}>
                Disbursement bank details have not been submitted for payroll transfers.
              </p>
              {canEditEmployee && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalInitialTab("bank");
                    setIsEditModalOpen(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 6 }}
                >
                  <Plus size={14} /> Add Bank Details
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Attendance & Leaves */}
      {activeTab === "attendance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Leave Balances Grid */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
              Annual Leave Entitlement (2026)
            </h3>
            <div className="grid-cols-3">
              {leaveBalances.map((bal) => (
                <div key={bal.balance_id} className="card">
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {bal.leave_type_name}
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary-400)", marginBottom: 4 }}>
                    {bal.remaining_days} <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 500 }}>days left</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Allocated: {bal.allocated_days} • Used: {bal.used_days}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Attendance Records */}
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
              Recent Check-In History
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                    <th>Status</th>
                    <th>Work Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((rec) => (
                    <tr key={rec.attendance_id}>
                      <td style={{ fontWeight: 600 }}>{rec.date}</td>
                      <td>{rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td>{rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td>{rec.work_mode}</td>
                      <td><StatusBadge status={rec.status} /></td>
                      <td style={{ fontWeight: 600 }}>{rec.total_hours ? `${rec.total_hours} hrs` : "In Progress"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Performance Reviews */}
      {activeTab === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {reviews.length > 0 ? (
            reviews.map((rev) => (
              <div key={rev.public_id} className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {rev.review_cycle} Evaluation
                    </h4>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Evaluated by {rev.reviewer_name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-amber-400)" }}>
                      ★ {rev.performance_score} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>/ 5.0</span>
                    </div>
                    <StatusBadge status={rev.status} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-emerald-400)", textTransform: "uppercase" }}>Key Strengths</span>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>{rev.strengths}</p>
                  </div>
                  <div style={{ background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-amber-400)", textTransform: "uppercase" }}>Areas of Development</span>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>{rev.areas_of_improvement}</p>
                  </div>
                </div>

                {rev.employee_comments && (
                  <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", fontStyle: "italic", borderLeft: "3px solid var(--color-primary-500)", paddingLeft: 12 }}>
                    "{rev.employee_comments}"
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ color: "var(--text-muted)" }}>No evaluations conducted for this employee yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Documents & Verification (POST /documents/upload, POST /documents/{id}/verify) */}
      {activeTab === "documents" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Compliance & Employee Documents
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Statutory identification, education credentials, and HR signed verification records
              </p>
            </div>

            <button onClick={() => setIsDocModalOpen(true)} className="btn btn-primary btn-sm">
              <Upload size={14} /> Upload Document
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Verification Notes</th>
                  <th>Uploaded Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                      No documents recorded for this employee.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.public_id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                          <FileText size={16} style={{ color: "var(--color-primary-400)" }} />
                          <span>{doc.document_name}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.82rem", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {doc.document_type}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={doc.status || "Pending_Verification"} />
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: 260 }}>
                        {doc.verification_notes || "Awaiting verification"}
                      </td>
                      <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {new Date(doc.created_at).toLocaleDateString()}
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
                            <Download size={13} /> Download
                          </button>
                          {canVerifyDoc && (
                            <>
                              {doc.status !== "Verified" ? (
                                <>
                                  <button
                                    onClick={() => handleVerifyDoc(doc.public_id, "Verified")}
                                    className="btn btn-success btn-sm"
                                    style={{ padding: "4px 8px" }}
                                    title="Verify document"
                                  >
                                    <Check size={14} /> Verify
                                  </button>
                                  <button
                                    onClick={() => handleVerifyDoc(doc.public_id, "Rejected")}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: "4px 8px" }}
                                    title="Reject document"
                                  >
                                    <X size={14} /> Reject
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: "0.78rem", color: "var(--color-emerald-400)", fontWeight: 600 }}>
                                  ✓ Verified
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Add Employee Address"
      >
        <form onSubmit={handleAddAddress}>
          <div className="form-group">
            <label className="form-label">Address Type</label>
            <select
              className="input-field"
              value={newAddr.address_type}
              onChange={(e) => setNewAddr({ ...newAddr, address_type: e.target.value as any })}
            >
              <option value="Current">Current Residence</option>
              <option value="Permanent">Permanent Hometown</option>
              <option value="Office">Office Location</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Street Address *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Flat 301, Lakeview Residency"
              value={newAddr.street_address}
              onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })}
            />
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">City *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Bengaluru"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">State *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Karnataka"
                value={newAddr.state}
                onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Postal Code *</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="560038"
                value={newAddr.postal_code}
                onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                readOnly
                className="input-field"
                value={newAddr.country}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={() => setIsAddressModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Address
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => {
          setIsDocModalOpen(false);
          setDocUploadError(null);
        }}
        title="Upload Verification Document"
      >
        <form onSubmit={handleUploadDoc}>
          {docUploadError && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--color-rose-400)", fontSize: "0.85rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} /> {docUploadError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Document Category *</label>
            <select
              className="input-field"
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value as DocumentType)}
            >
              <option value="aadhaar">Government Aadhaar Card</option>
              <option value="pan">Permanent Account Number (PAN)</option>
              <option value="passport">Passport</option>
              <option value="resume">Resume / CV</option>
              <option value="offer_letter">Offer Letter</option>
              <option value="experience_letter">Experience / Relieving Letter</option>
              <option value="other">Other Supporting Document</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Document Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Identity Aadhaar Card 2026"
              className="input-field"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Attachment File (PDF/PNG) *</label>
            <input
              type="file"
              required
              className="input-field"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setNewDocFile(f);
                if (f && !newDocName) {
                  const cleanName = f.name.replace(/\.[^/.]+$/, "");
                  setNewDocName(cleanName);
                }
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setIsDocModalOpen(false);
                setDocUploadError(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={docUploading} className="btn btn-primary">
              {docUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {docUploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Employee Details (HR & Admin) */}
      <EditEmployeeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        employee={employee}
        initialTab={editModalInitialTab}
        onSuccess={(updated) => {
          setEmployee(updated);
          loadEmployeeData();
        }}
      />

      {/* MODAL: Deactivate / Reactivate Confirmation */}
      <Modal
        isOpen={isDeactivateConfirmOpen}
        onClose={() => setIsDeactivateConfirmOpen(false)}
        title={isEmpActive ? "Confirm Employee Deactivation" : "Reactivate Employee"}
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {isEmpActive ? (
              <>
                Are you sure you want to deactivate access for <strong>{employee?.first_name} {employee?.last_name}</strong>?
                This will set their employment status to <strong>Inactive</strong> and temporarily disable portal login.
              </>
            ) : (
              <>
                Are you sure you want to restore access for <strong>{employee?.first_name} {employee?.last_name}</strong>?
                This will set their status back to <strong>Active</strong>.
              </>
            )}
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setIsDeactivateConfirmOpen(false)}
              className="btn btn-secondary"
              disabled={statusLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className={isEmpActive ? "btn btn-danger" : "btn btn-primary"}
              disabled={statusLoading}
            >
              {statusLoading
                ? "Processing..."
                : isEmpActive
                ? "Yes, Deactivate"
                : "Yes, Reactivate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

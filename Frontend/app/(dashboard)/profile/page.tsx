"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Mail,
  Shield,
  CreditCard,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Building,
  Briefcase,
  MapPin,
  Phone,
  Calendar,
  Lock,
  Edit,
  Plus,
  ShieldCheck,
  Eye,
  Download,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useAuth, hasPermission } from "@/lib/auth";
import { api } from "@/lib/apiClient";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EditEmployeeModal } from "@/components/employee/EditEmployeeModal";
import { DocumentRecord, DocumentType } from "@/types/document";
import { BankDetail, SalaryStructure } from "@/types/payroll";
import { Employee, Address, EmergencyContact } from "@/types/employee";

export default function ProfilePage() {
  const { user, role, isHR, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"personal" | "corporate" | "security" | "documents">("personal");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [bank, setBank] = useState<BankDetail | null>(null);
  const [salary, setSalary] = useState<SalaryStructure | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalInitialTab, setEditModalInitialTab] = useState<"general" | "bank" | "statutory" | "salary">("general");

  // Editable Personal Fields for Employee
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Male");
  const [dob, setDob] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  // Status & notifications
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password change state
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Document Upload Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("aadhaar");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadProfileData();
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    try {
      let emp: any = null;
      try {
        emp = await api.employees.getMe();
      } catch (err) {
        console.warn("getMe failed, attempting fallback to user.employee_public_id", err);
      }

      if (!emp && user.employee_public_id) {
        try {
          emp = await api.employees.getById(user.employee_public_id);
        } catch (e) {
          console.warn("getById failed for user.employee_public_id", e);
        }
      }

      const resolvedEmp = emp ? { ...emp } : null;
      if (resolvedEmp) {
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
      }
      setEmployee(resolvedEmp);
      if (resolvedEmp) {
        setPhone(resolvedEmp.phone || (resolvedEmp as any).phone_number || "");
        if (resolvedEmp.gender) {
          const g = resolvedEmp.gender.toLowerCase();
          setGender(g.charAt(0).toUpperCase() + g.slice(1));
        } else {
          setGender("Male");
        }
        setDob(resolvedEmp.date_of_birth ? resolvedEmp.date_of_birth.split("T")[0] : "");
        const addrs = resolvedEmp.addresses || (emp as any)?.addresses || [];
        if (addrs && addrs.length > 0) {
          const curr = addrs.find((a: any) => String(a.address_type || "").toLowerCase() === "current");
          const perm = addrs.find((a: any) => String(a.address_type || "").toLowerCase() === "permanent");
          if (curr) setCurrentAddress([curr.street_address, curr.city, curr.state, curr.postal_code || curr.pincode].filter(Boolean).join(", "));
          if (perm) setPermanentAddress([perm.street_address, perm.city, perm.state, perm.postal_code || perm.pincode].filter(Boolean).join(", "));
        }
        const emContacts = resolvedEmp.emergency_contacts || (emp as any)?.emergency_contacts || [];
        if (emContacts && emContacts.length > 0) {
          const contact = emContacts[0];
          setEmergencyName(contact.contact_name || contact.name || "");
          setEmergencyPhone(contact.phone_number || contact.phone || "");
          setEmergencyRelation(contact.relationship || contact.relation || "");
        }

        // Fetch salary & bank
        if (emp.public_id) {
          try {
            const sal = await api.payroll.getSalary(emp.public_id);
            setSalary(sal);
          } catch (e) {}
          try {
            const b = await api.payroll.getBankDetails(emp.public_id);
            setBank(b);
          } catch (e) {}
          try {
            const docs = await api.documents.list(emp.public_id);
            setDocuments(docs);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error("Failed to load profile data:", e);
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      const payloadAddresses = [];
      if (currentAddress.trim()) {
        payloadAddresses.push({
          address_type: "current" as const,
          street_address: currentAddress.trim(),
          city: "Metro",
          state: "State",
          country: "India",
          pincode: "110001",
        });
      }
      if (permanentAddress.trim()) {
        payloadAddresses.push({
          address_type: "permanent" as const,
          street_address: permanentAddress.trim(),
          city: "Metro",
          state: "State",
          country: "India",
          pincode: "110001",
        });
      }

      const payloadEmergency = [];
      if (emergencyName.trim() || emergencyPhone.trim()) {
        payloadEmergency.push({
          contact_name: emergencyName.trim() || "Emergency Contact",
          relationship: emergencyRelation.trim() || "Family",
          phone_number: emergencyPhone.trim() || phone,
          is_primary: true,
        });
      }

      const updated = await api.employees.updateMe({
        phone: phone,
        phone_number: phone,
        gender: gender.toLowerCase() as any,
        date_of_birth: dob || undefined,
        addresses: payloadAddresses as any,
        emergency_contacts: payloadEmergency as any,
      });

      if (updated) {
        setEmployee((prev) => (prev ? { ...prev, ...updated } : updated));
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    try {
      await api.auth.changePassword({
        current_password: currPassword,
        new_password: newPassword,
      });
      setPwSuccess(true);
      setCurrPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: any) {
      setPwError(err.message || "Failed to update password.");
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) {
      setDocUploadError("No linked employee personnel record found. Please refresh your profile or contact system administration.");
      return;
    }
    if (!docFile) {
      setDocUploadError("Please select a file to upload.");
      return;
    }
    setDocUploading(true);
    setDocUploadError(null);
    try {
      const created = await api.documents.upload({
        employee_public_id: employee.public_id,
        document_type: docType,
        document_name: docName.trim() || docFile.name.replace(/\.[^/.]+$/, "") || `${docType.toUpperCase()} Record`,
        file: docFile,
      });
      setDocuments([created, ...documents]);
      setIsDocModalOpen(false);
      setDocName("");
      setDocFile(null);
    } catch (err: any) {
      setDocUploadError(err.message || "Failed to upload document. Please try again.");
    } finally {
      setDocUploading(false);
    }
  };

  const canVerifyDoc = isAdmin || isHR || hasPermission("document:verify");

  const handleVerifyDoc = async (docPublicId: string, status: "Verified" | "Rejected") => {
    try {
      const defaultNote =
        status === "Verified"
          ? (isAdmin ? "Self-verified by Admin" : "Self-verified by HR")
          : "Discrepancy noted during verification";
      await api.documents.verify(docPublicId, {
        status,
        verification_notes: defaultNote,
      });
      if (employee?.public_id) {
        const docs = await api.documents.list(employee.public_id);
        setDocuments(docs);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update document verification status.");
    }
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          My Account & Personnel Profile
        </h1>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          Manage your personal details, residential addresses, emergency contacts, credentials, and verification records
        </p>
      </div>

      {savedSuccess && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--color-emerald-400)", fontSize: "0.88rem" }}>
          <CheckCircle2 size={16} /> Personal contact and address details saved successfully.
        </div>
      )}
      {saveError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--color-rose-400)", fontSize: "0.88rem" }}>
          <AlertCircle size={16} /> {saveError}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Avatar name={user.display_name} size={64} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {user.display_name}
              </h2>
              <StatusBadge status="Active" />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--color-primary-400)", fontWeight: 600 }}>
              {String(role || "Employee").replace(/_/g, " ")} • {employee?.designation_name || "Employee"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
              Employee Code: <strong>{employee?.employee_code || "Pending Assignment"}</strong> • Email: {user.email}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-surface-elevated)", padding: "8px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontSize: "0.8rem" }}>
          <ShieldCheck size={16} style={{ color: "var(--color-emerald-400)" }} />
          <span>Email Verified</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: 20 }}>
        {[
          { key: "personal", label: "Personal & Contacts (Self-Service)" },
          { key: "corporate", label: "Corporate & Compensation" },
          { key: "documents", label: `Documents (${documents.length})` },
          { key: "security", label: "Security & Credentials" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: "12px 4px",
              background: "transparent",
              color: activeTab === t.key ? "var(--color-primary-400)" : "var(--text-secondary)",
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize: "0.9rem",
              border: "none",
              borderBottom: activeTab === t.key ? "2px solid var(--color-primary-400)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Personal & Contacts (Self-Service) */}
      {activeTab === "personal" && (
        <form onSubmit={handleSavePersonal} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Contact & Demographic Information
            </h3>
            <div className="grid-cols-3">
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <div style={{ position: "relative" }}>
                  <Phone size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  className="input-field"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <div style={{ position: "relative" }}>
                  <Calendar size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="date"
                    className="input-field"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Residential Addresses
            </h3>
            <div className="form-group">
              <label className="form-label">Current Residential Address</label>
              <div style={{ position: "relative" }}>
                <MapPin size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
                <textarea
                  rows={2}
                  className="input-field"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Permanent Address</label>
              <div style={{ position: "relative" }}>
                <MapPin size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
                <textarea
                  rows={2}
                  className="input-field"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Primary Emergency Contact
            </h3>
            <div className="grid-cols-3">
              <div className="form-group">
                <label className="form-label">Contact Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Spouse, Parent"
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Phone</label>
                <input
                  type="text"
                  className="input-field"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary">
              Save Personal Changes
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Corporate & Compensation (Locked for Employee) */}
      {activeTab === "corporate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Lock notice for regular employees */}
          {!isAdmin && !isHR && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 18px",
                borderRadius: "var(--radius-md)",
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                color: "var(--color-primary-300)",
                fontSize: "0.85rem",
              }}
            >
              <Lock size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Corporate Governance Locked:</strong> Organizational placement, department, designation, salary structures, and bank accounts are managed by Human Resources & Payroll Administration. Standard employees cannot alter these parameters.
              </span>
            </div>
          )}

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Organizational Placement
              </h3>
              {(isAdmin || isHR) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalInitialTab("general");
                    setIsEditModalOpen(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                >
                  <Edit size={13} /> Edit Placement
                </button>
              )}
            </div>
            <div className="grid-cols-3">
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Employee Code</span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                  {employee?.employee_code || "—"}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Department</span>
                <span style={{ fontWeight: 600 }}>{employee?.department_name || "Unassigned"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Designation</span>
                <span style={{ fontWeight: 600 }}>{employee?.designation_name || "Unassigned"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Reporting Manager</span>
                <span style={{ fontWeight: 600 }}>{employee?.reporting_manager_name || "None Assigned"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Joining Date</span>
                <span>{employee?.joining_date || "—"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Employment Type</span>
                <span>{employee?.employment_type ? String(employee.employment_type).replace(/_/g, " ") : "Full Time"}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Monthly Compensation Structure (INR ₹)
              </h3>
              {(isAdmin || isHR) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalInitialTab("salary");
                    setIsEditModalOpen(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                >
                  <Edit size={13} /> Edit Salary
                </button>
              )}
            </div>
            {salary ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-cols-4" style={{ gap: 12 }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Basic Fixed Salary</span>
                    <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>₹{(Number(salary.basic_salary) || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Monthly Gross</span>
                    <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-emerald-400)" }}>
                      ₹{((salary.gross_salary != null && salary.gross_salary > 0)
                        ? Number(salary.gross_salary)
                        : Number(salary.basic_salary) + (salary.components || []).filter((c) => c.component_type === "earning").reduce((s, c) => s + Number(c.amount || 0), 0)
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total Deductions</span>
                    <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-rose-400)" }}>
                      -₹{((salary.components || []).filter((c) => c.component_type === "deduction").reduce((s, c) => s + Number(c.amount || 0), 0) || (Number(salary.provident_fund || 0) + Number(salary.professional_tax || 0) + Number(salary.tds_tax || 0))).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Net Take-Home Pay</span>
                    <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--color-emerald-400)" }}>₹{(Number(salary.net_salary) || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Itemized Components Breakdown */}
                {salary.components && salary.components.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-emerald-400)", textTransform: "uppercase" }}>
                        Earnings & Allowances
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                        {salary.components.filter((c) => c.component_type === "earning").map((c, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>{c.component_name}</span>
                            <span style={{ fontWeight: 600 }}>₹{(Number(c.amount) || 0).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-rose-400)", textTransform: "uppercase" }}>
                        Deductions & Withholdings
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                        {salary.components.filter((c) => c.component_type === "deduction").map((c, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>{c.component_name}</span>
                            <span style={{ fontWeight: 600, color: "var(--color-rose-400)" }}>-₹{(Number(c.amount) || 0).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                No salary structure configured for this employee yet.
              </div>
            )}
          </div>

          {bank && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Disbursement Bank Account
                </h3>
                {(isAdmin || isHR) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalInitialTab("bank");
                      setIsEditModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                  >
                    <Edit size={13} /> Edit Bank
                  </button>
                )}
              </div>
              <div className="grid-cols-3">
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Bank Name</span>
                  <span style={{ fontWeight: 600 }}>{bank.bank_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Account Number</span>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{bank.account_number}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>IFSC Code</span>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-cyan-400)" }}>{bank.ifsc_code}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Documents */}
      {activeTab === "documents" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Compliance & Verification Documents
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Aadhaar, PAN, Offer Letters, and Experience Certificates verified by HR operations
              </p>
            </div>

            <button onClick={() => setIsDocModalOpen(true)} className="btn btn-primary btn-sm">
              <Upload size={14} /> Upload Document
            </button>
          </div>

          <div className="table-wrapper">
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
                      No verification documents uploaded yet.
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
                      <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: 280 }}>
                        {doc.verification_notes || "Awaiting HR verification"}
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
                                    type="button"
                                    onClick={() => handleVerifyDoc(doc.public_id, "Verified")}
                                    className="btn btn-success btn-sm"
                                    style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                    title="Verify document (Admin/HR Self-Verification)"
                                  >
                                    <Check size={13} /> Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyDoc(doc.public_id, "Rejected")}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                    title="Reject document"
                                  >
                                    <X size={13} /> Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyDoc(doc.public_id, "Rejected")}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                  title="Revoke / Reject document"
                                >
                                  Revoke
                                </button>
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

      {/* Tab 4: Security & Credentials */}
      {activeTab === "security" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24 }}>
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Account Identity
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Display Name</span>
                <span style={{ fontWeight: 600 }}>{user.display_name}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Corporate Email</span>
                <span style={{ fontWeight: 600 }}>{user.email}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Active Role</span>
                <span style={{ fontWeight: 600, color: "var(--color-primary-400)" }}>{String(role || "Employee").replace(/_/g, " ")}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>User Public UUID</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{user.public_id}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Change Corporate Password
            </h3>

            {pwSuccess && (
              <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--color-emerald-400)", fontSize: "0.85rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} /> Password updated successfully.
              </div>
            )}

            {pwError && (
              <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--color-rose-400)", fontSize: "0.85rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> {pwError}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="input-field"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                <KeyRound size={15} /> Update Password
              </button>
            </form>
          </div>
        </div>
      )}

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
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
            >
              <option value="aadhaar">Government Aadhaar Card</option>
              <option value="pan">Permanent Account Number (PAN)</option>
              <option value="passport">Passport</option>
              <option value="resume">Resume / Curriculum Vitae</option>
              <option value="offer_letter">Signed Offer Letter</option>
              <option value="experience_letter">Experience / Relieving Letter</option>
              <option value="other">Other Supporting Record</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Document Title / Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Aadhaar Card Copy"
              className="input-field"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">File Attachment (PDF / PNG / JPG) *</label>
            <input
              type="file"
              required
              className="input-field"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setDocFile(f);
                if (f && !docName) {
                  const cleanName = f.name.replace(/\.[^/.]+$/, "");
                  setDocName(cleanName);
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
              {docUploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </form>
      </Modal>

      {(isAdmin || isHR) && employee && (
        <EditEmployeeModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          employee={employee}
          initialTab={editModalInitialTab}
          onSuccess={(updated) => {
            setEmployee(updated);
            loadProfileData();
          }}
        />
      )}
    </div>
  );
}

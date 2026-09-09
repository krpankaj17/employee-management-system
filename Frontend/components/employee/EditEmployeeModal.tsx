"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Employee } from "@/types/employee";
import { Department, Designation } from "@/types/department";
import { BankDetail, SalaryStructure, SalaryComponentItem } from "@/types/payroll";
import { api } from "@/lib/apiClient";
import {
  Save,
  User,
  Briefcase,
  Building,
  AlertCircle,
  CreditCard,
  FileText,
  DollarSign,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSuccess: (updated: Employee) => void;
  initialTab?: "general" | "bank" | "statutory" | "salary";
}

export function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
  initialTab = "general",
}: EditEmployeeModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "bank" | "statutory" | "salary">(initialTab);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General & Employment
  const [generalForm, setGeneralForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    gender: "Male",
    date_of_birth: "",
    department_public_id: "",
    designation_public_id: "",
    work_mode: "in_office",
    employment_type: "Full_Time",
    employee_status: "Active",
    joining_date: "",
  });

  // Bank & Disbursement
  const [bankForm, setBankForm] = useState({
    bank_name: "HDFC Bank Ltd",
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "Salary" as "Salary" | "Savings" | "Current",
  });

  // Statutory & Tax Identity
  const [statutoryForm, setStatutoryForm] = useState({
    pan_number: "",
    uan_number: "",
    aadhar_number: "",
  });

  // Compensation & Dynamic Salary Structure
  const [basicSalary, setBasicSalary] = useState<number>(80000);
  const [salaryCurrency, setSalaryCurrency] = useState<string>("INR");
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponentItem[]>([
    { component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: 40000 },
    { component_name: "Special Allowance", component_type: "earning", amount: 30000 },
    { component_name: "Provident Fund (PF)", component_type: "deduction", amount: 9600 },
    { component_name: "Professional Tax", component_type: "deduction", amount: 200 },
    { component_name: "TDS / Income Tax", component_type: "deduction", amount: 15000 },
  ]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadDeptData();
      if (employee) {
        loadFinancialData(employee.public_id);
      }
    }
  }, [isOpen, initialTab, employee]);

  useEffect(() => {
    if (employee) {
      setGeneralForm({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        phone_number: employee.phone_number || "",
        gender: employee.gender || "Male",
        date_of_birth: employee.date_of_birth || "",
        department_public_id: employee.department_public_id || "dept-eng",
        designation_public_id: employee.designation_public_id || "",
        work_mode: (employee as any).work_mode || "in_office",
        employment_type: employee.employment_type || "Full_Time",
        employee_status: employee.employee_status || "Active",
        joining_date: employee.joining_date || "",
      });

      setStatutoryForm({
        pan_number: employee.pan_number || "ABCDE1234F",
        uan_number: employee.uan_number || "101294829102",
        aadhar_number: employee.aadhar_number || "9821-4401-2918",
      });

      setBankForm((prev) => ({
        ...prev,
        account_holder_name: `${employee.first_name} ${employee.last_name}`,
      }));

      setError(null);
    }
  }, [employee]);

  const loadDeptData = async () => {
    try {
      const [depts, desigs] = await Promise.all([
        api.departments.list(),
        api.departments.listDesignations(),
      ]);
      setDepartments(depts);
      setDesignations(desigs);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadFinancialData = async (empId: string) => {
    try {
      const [b, s] = await Promise.all([
        api.payroll.getBankDetails(empId),
        api.payroll.getSalary(empId),
      ]);
      if (b) {
        setBankForm({
          bank_name: b.bank_name || "HDFC Bank Ltd",
          account_holder_name: b.account_holder_name || `${employee?.first_name} ${employee?.last_name}`,
          account_number: b.account_number || "",
          ifsc_code: b.ifsc_code || "",
          branch_name: b.branch_name || "",
          account_type: (b.account_type as any) || "Salary",
        });
      }
      if (s) {
        setBasicSalary(Number(s.basic_salary || 0));
        setSalaryCurrency(s.currency || "INR");
        if (s.components && s.components.length > 0) {
          setSalaryComponents(
            s.components.map((c) => ({
              component_id: c.component_id,
              component_name: c.component_name,
              component_type: c.component_type,
              amount: Number(c.amount || 0),
            }))
          );
        } else {
          const comps: SalaryComponentItem[] = [];
          if (s.hra) comps.push({ component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: Number(s.hra) });
          if (s.conveyance_allowance) comps.push({ component_name: "Conveyance Allowance", component_type: "earning", amount: Number(s.conveyance_allowance) });
          if (s.special_allowance) comps.push({ component_name: "Special Allowance", component_type: "earning", amount: Number(s.special_allowance) });
          if (s.provident_fund) comps.push({ component_name: "Provident Fund (PF)", component_type: "deduction", amount: Number(s.provident_fund) });
          if (s.professional_tax) comps.push({ component_name: "Professional Tax", component_type: "deduction", amount: Number(s.professional_tax) });
          if (s.tds_tax) comps.push({ component_name: "TDS / Income Tax", component_type: "deduction", amount: Number(s.tds_tax) });
          setSalaryComponents(comps);
        }
      }
    } catch (err) {
      console.error("Error loading financial data", err);
    }
  };

  const handleAddComponent = (type: "earning" | "deduction") => {
    setSalaryComponents((prev) => [
      ...prev,
      {
        component_name: type === "earning" ? "Custom Allowance" : "Custom Deduction",
        component_type: type,
        amount: 0,
      },
    ]);
  };

  const handleUpdateComponent = (index: number, field: "component_name" | "amount", value: any) => {
    setSalaryComponents((prev) => {
      const next = [...prev];
      if (field === "amount") {
        next[index] = { ...next[index], amount: Math.max(0, Number(value) || 0) };
      } else {
        next[index] = { ...next[index], component_name: value };
      }
      return next;
    });
  };

  const handleRemoveComponent = (index: number) => {
    setSalaryComponents((prev) => prev.filter((_, i) => i !== index));
  };

  // Filter designations matching selected department (or all designations if global)
  const matchingDesignations = designations.filter(
    (d) => !d.department_public_id || d.department_public_id === generalForm.department_public_id
  );
  const filteredDesignations = matchingDesignations.length > 0 ? matchingDesignations : designations;

  // Live auto-computed gross & net
  const earningComponents = salaryComponents.filter((c) => c.component_type === "earning");
  const deductionComponents = salaryComponents.filter((c) => c.component_type === "deduction");

  const totalEarnings = earningComponents.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const grossSalary = Number(basicSalary || 0) + totalEarnings;
  const totalDeductions = deductionComponents.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setLoading(true);
    setError(null);

    try {
      const selectedDept = departments.find(
        (d) => d.public_id === generalForm.department_public_id
      );
      const selectedDesig = designations.find(
        (d) => d.public_id === generalForm.designation_public_id
      );

      // 1. Update Core Employee Details
      const employeePayload: Partial<Employee> = {
        first_name: generalForm.first_name.trim(),
        last_name: generalForm.last_name.trim(),
        phone_number: generalForm.phone_number.trim(),
        gender: generalForm.gender as any,
        date_of_birth: generalForm.date_of_birth,
        department_public_id: generalForm.department_public_id,
        department_name: selectedDept?.department_name || employee.department_name,
        designation_public_id: generalForm.designation_public_id,
        designation_name: selectedDesig?.designation_name || employee.designation_name,
        employment_type: generalForm.employment_type as any,
        employee_status: generalForm.employee_status as any,
        joining_date: generalForm.joining_date,
        pan_number: statutoryForm.pan_number.trim(),
        uan_number: statutoryForm.uan_number.trim(),
        aadhar_number: statutoryForm.aadhar_number.trim(),
        ...( { work_mode: generalForm.work_mode } as any ),
      };

      const updatedEmp = await api.employees.update(employee.public_id, employeePayload);

      // 2. Update Bank Details via api.payroll
      await api.payroll.updateBankDetails(employee.public_id, {
        bank_name: bankForm.bank_name.trim(),
        account_holder_name: bankForm.account_holder_name.trim(),
        account_number: bankForm.account_number.trim(),
        ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
        branch_name: bankForm.branch_name.trim(),
        account_type: bankForm.account_type,
      });

      // 3. Update Salary Structure via api.payroll
      await api.payroll.updateSalary(employee.public_id, {
        basic_salary: Number(basicSalary),
        currency: salaryCurrency,
        gross_salary: grossSalary,
        net_salary: netSalary,
        components: salaryComponents,
      });

      onSuccess(updatedEmp);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update employee details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Employee: ${employee?.first_name} ${employee?.last_name} (${employee?.employee_code})`}
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: 16 }}>
          {[
            { key: "general", label: "General & Job", icon: <User size={14} /> },
            { key: "bank", label: "Bank & Payout", icon: <CreditCard size={14} /> },
            { key: "statutory", label: "Tax & Identity", icon: <FileText size={14} /> },
            { key: "salary", label: "Salary & CTC", icon: <DollarSign size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 4px",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid var(--color-primary-500)" : "2px solid transparent",
                color: activeTab === tab.key ? "var(--color-primary-400)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--color-rose-400)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* TAB 1: General & Employment */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={generalForm.first_name}
                    onChange={(e) => setGeneralForm({ ...generalForm, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={generalForm.last_name}
                    onChange={(e) => setGeneralForm({ ...generalForm, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+91 98765 43210"
                    value={generalForm.phone_number}
                    onChange={(e) => setGeneralForm({ ...generalForm, phone_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="input-field"
                    value={generalForm.gender}
                    onChange={(e) => setGeneralForm({ ...generalForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="input-field"
                    value={generalForm.date_of_birth}
                    onChange={(e) => setGeneralForm({ ...generalForm, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Joining</label>
                  <input
                    type="date"
                    className="input-field"
                    value={generalForm.joining_date}
                    onChange={(e) => setGeneralForm({ ...generalForm, joining_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="input-field"
                    value={generalForm.department_public_id}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setGeneralForm({
                        ...generalForm,
                        department_public_id: newDept,
                      });
                    }}
                  >
                    {departments.map((dept) => (
                      <option key={dept.public_id} value={dept.public_id}>
                        {dept.department_name || (dept as any).dept_name || "Department"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Designation *</label>
                  <select
                    className="input-field"
                    value={generalForm.designation_public_id}
                    onChange={(e) => setGeneralForm({ ...generalForm, designation_public_id: e.target.value })}
                  >
                    <option value="">Select Designation...</option>
                    {filteredDesignations.map((des) => (
                      <option key={des.public_id} value={des.public_id}>
                        {des.designation_name || (des as any).title || "Designation"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-cols-3" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Work Mode</label>
                  <select
                    className="input-field"
                    value={generalForm.work_mode}
                    onChange={(e) => setGeneralForm({ ...generalForm, work_mode: e.target.value })}
                  >
                    <option value="in_office">In Office</option>
                    <option value="remote">Fully Remote</option>
                    <option value="field">Field / Hybrid</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select
                    className="input-field"
                    value={generalForm.employment_type}
                    onChange={(e) => setGeneralForm({ ...generalForm, employment_type: e.target.value })}
                  >
                    <option value="Full_Time">Full-Time</option>
                    <option value="Part_Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Internship</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Employee Status</label>
                  <select
                    className="input-field"
                    value={generalForm.employee_status}
                    onChange={(e) => setGeneralForm({ ...generalForm, employee_status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On_Leave">On Sabbatical</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Banking & Disbursement */}
          {activeTab === "bank" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: 0 }}>
                Configure electronic bank routing details for automatic monthly salary disbursements.
              </p>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Bank Institution Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. HDFC Bank Ltd"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Beneficiary Name *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="As registered in passbook"
                    value={bankForm.account_holder_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Account Number *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    style={{ fontFamily: "var(--font-mono)" }}
                    placeholder="e.g. 50100482910245"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC / Routing Code *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    style={{ fontFamily: "var(--font-mono)" }}
                    placeholder="e.g. HDFC0000128"
                    value={bankForm.ifsc_code}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Branch Name / City</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Koramangala 5th Block, Bengaluru"
                    value={bankForm.branch_name}
                    onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select
                    className="input-field"
                    value={bankForm.account_type}
                    onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value as any })}
                  >
                    <option value="Salary">Corporate Salary Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Current">Current Account</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Statutory & Tax Identity */}
          {activeTab === "statutory" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: 0 }}>
                National identification numbers for compliance with income tax and EPFO Provident Fund guidelines.
              </p>

              <div className="form-group">
                <label className="form-label">Permanent Account Number (PAN) *</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  value={statutoryForm.pan_number}
                  onChange={(e) => setStatutoryForm({ ...statutoryForm, pan_number: e.target.value.toUpperCase() })}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Used for TDS deduction and annual Form 16 issuance
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Universal Account Number (UAN - EPFO)</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ fontFamily: "var(--font-mono)" }}
                  placeholder="e.g. 101294829102"
                  maxLength={12}
                  value={statutoryForm.uan_number}
                  onChange={(e) => setStatutoryForm({ ...statutoryForm, uan_number: e.target.value })}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  12-digit permanent number assigned by Employees' Provident Fund Organisation
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Aadhar / National ID Number</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ fontFamily: "var(--font-mono)" }}
                  placeholder="e.g. 9821-4401-2918"
                  value={statutoryForm.aadhar_number}
                  onChange={(e) => setStatutoryForm({ ...statutoryForm, aadhar_number: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* TAB 4: Salary & CTC Structure */}
          {activeTab === "salary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Basic Salary */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>
                  Monthly Base Fixed Salary ({salaryCurrency}) *
                </label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="number"
                    min={0}
                    required
                    className="input-field"
                    style={{ fontSize: "1.05rem", fontWeight: 700 }}
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    per month
                  </span>
                </div>
              </div>

              {/* Earnings (Salary Components) */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(16, 185, 129, 0.03)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-emerald-400)" }}>
                      Earnings & Allowances ({earningComponents.length})
                    </span>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block" }}>
                      Subtotal: ₹{totalEarnings.toLocaleString("en-IN")} / mo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddComponent("earning")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "4px 10px", gap: 4 }}
                  >
                    <Plus size={13} /> Add Earning Component
                  </button>
                </div>

                {earningComponents.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic", padding: "6px 0" }}>
                    No additional earnings. Click "+ Add Earning Component" to add allowances.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {salaryComponents.map((comp, idx) => {
                      if (comp.component_type !== "earning") return null;
                      return (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            className="input-field"
                            style={{ flex: 2, fontSize: "0.82rem" }}
                            placeholder="Component Name (e.g. HRA, Bonus)"
                            value={comp.component_name}
                            onChange={(e) => handleUpdateComponent(idx, "component_name", e.target.value)}
                          />
                          <div style={{ flex: 1, position: "relative" }}>
                            <input
                              type="number"
                              min={0}
                              className="input-field"
                              style={{ fontSize: "0.82rem", fontWeight: 600 }}
                              placeholder="Amount (₹)"
                              value={comp.amount}
                              onChange={(e) => handleUpdateComponent(idx, "amount", e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--color-rose-400)", padding: "4px 6px" }}
                            title="Remove earning component"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Deductions */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(244, 63, 94, 0.03)",
                  border: "1px solid rgba(244, 63, 94, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-rose-400)" }}>
                      Deductions & Withholdings ({deductionComponents.length})
                    </span>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block" }}>
                      Subtotal: ₹{totalDeductions.toLocaleString("en-IN")} / mo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddComponent("deduction")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "4px 10px", gap: 4 }}
                  >
                    <Plus size={13} /> Add Deduction
                  </button>
                </div>

                {deductionComponents.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic", padding: "6px 0" }}>
                    No deductions configured. Click "+ Add Deduction" to add PF, PT, or custom deductions.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {salaryComponents.map((comp, idx) => {
                      if (comp.component_type !== "deduction") return null;
                      return (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            className="input-field"
                            style={{ flex: 2, fontSize: "0.82rem" }}
                            placeholder="Deduction Name (e.g. Provident Fund, Health Insurance)"
                            value={comp.component_name}
                            onChange={(e) => handleUpdateComponent(idx, "component_name", e.target.value)}
                          />
                          <div style={{ flex: 1, position: "relative" }}>
                            <input
                              type="number"
                              min={0}
                              className="input-field"
                              style={{ fontSize: "0.82rem", fontWeight: 600 }}
                              placeholder="Amount (₹)"
                              value={comp.amount}
                              onChange={(e) => handleUpdateComponent(idx, "amount", e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(idx)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--color-rose-400)", padding: "4px 6px" }}
                            title="Remove deduction"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Net Pay & Gross Preview Card */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block" }}>
                    Monthly Net Take-Home Pay
                  </span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-emerald-400)" }}>
                    ₹{netSalary.toLocaleString("en-IN")} / month
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block" }}>
                    Gross: ₹{grossSalary.toLocaleString("en-IN")} | Deductions: ₹{totalDeductions.toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-primary-300)" }}>
                    Annual CTC: ₹{(grossSalary * 12).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 16,
              marginTop: 6,
            }}
          >
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <Save size={16} /> {loading ? "Saving Changes..." : "Save All Employee Details"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

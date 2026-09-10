"use client";

import React, { useEffect, useState } from "react";
import {
  WalletCards,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  DollarSign,
  Plus,
  Send,
  Building,
  Info,
  Sliders,
  Search,
  Layers,
  Trash2,
  TrendingUp,
  Percent,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { PayrollRun, PayslipDetail, SalaryStructure, SalaryComponentItem } from "@/types/payroll";
import { Employee } from "@/types/employee";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { hasPermission, useAuth } from "@/lib/auth";

export default function PayrollPage() {
  const { role, user, isEmployee: isEmployeeRole } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<"runs" | "structures">("runs");

  // Runs State
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipDetail | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [payPeriodStart, setPayPeriodStart] = useState("2026-09-01");
  const [payPeriodEnd, setPayPeriodEnd] = useState("2026-09-30");
  const [processingBatch, setProcessingBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [bannerFeedback, setBannerFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Salary Structures State
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [salarySearch, setSalarySearch] = useState("");
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryPageSize, setSalaryPageSize] = useState(10);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Salary Adjustment Modal State
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryStructure | null>(null);
  const [editingEmpPublicId, setEditingEmpPublicId] = useState("");
  const [editingBasicSalary, setEditingBasicSalary] = useState<number>(60000);
  const [editingCurrency, setEditingCurrency] = useState("INR");
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [editingComponents, setEditingComponents] = useState<SalaryComponentItem[]>([]);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const canProcess = hasPermission("payroll:run");
  const canManageSalary = hasPermission("salary:create") || hasPermission("role:manage") || !isEmployeeRole;

  useEffect(() => {
    loadPayroll();
    if (!isEmployeeRole) {
      loadSalaries();
    }
  }, [role, isEmployeeRole, currentPage, pageSize]);

  useEffect(() => {
    if (bannerFeedback) {
      const timer = setTimeout(() => {
        setBannerFeedback(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [bannerFeedback]);

  const loadPayroll = async () => {
    try {
      const empIdParam = isEmployeeRole && user?.employee_public_id && user.employee_public_id !== "undefined"
        ? user.employee_public_id
        : undefined;

      const res = await api.payroll.getRuns({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        employee_public_id: empIdParam,
      });
      let items = res.items || [];
      if (isEmployeeRole && user?.employee_public_id) {
        items = items.filter((r) => r.employee_public_id === user.employee_public_id);
      }
      setRuns(items);
      setTotalItems(isEmployeeRole ? items.length : (res.total || 0));
    } catch (err: any) {
      console.warn("Failed to load payroll:", err);
      setRuns([]);
      setTotalItems(0);
    }
  };

  const loadSalaries = async () => {
    try {
      const [sals, emps] = await Promise.all([
        api.salaries.listAll(),
        api.employees.list({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setSalaryStructures(sals || []);
      setEmployees(emps.items || []);
    } catch (err) {
      console.warn("Failed to load salary structures:", err);
    }
  };

  const handleViewPayslip = async (run: PayrollRun) => {
    try {
      const slip = await api.payroll.getPayslip(run.public_id);
      setSelectedPayslip(slip);
      setIsPayslipModalOpen(true);
    } catch (err: any) {
      console.warn("Failed to load payslip:", err);
      setBannerFeedback({
        type: "error",
        message: err.message || "Failed to load payslip.",
      });
    }
  };

  const handlePrintPayslip = (payslip: PayslipDetail) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const earningsRows = (payslip.earnings || [])
      .map(
        (e) => `
        <tr>
          <td style="padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${e.label}</td>
          <td style="padding: 7px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 12px; color: #0f172a;">₹${(Number(e.amount) || 0).toLocaleString("en-IN")}</td>
        </tr>`
      )
      .join("");

    const deductionsRows = (payslip.deductions || [])
      .map(
        (d) => `
        <tr>
          <td style="padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${d.label}</td>
          <td style="padding: 7px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 12px; color: #b91c1c;">- ₹${(Number(d.amount) || 0).toLocaleString("en-IN")}</td>
        </tr>`
      )
      .join("");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payslip_${payslip.employee_code}_${(payslip.pay_period || "Statement").replace(/\\s+/g, "_")}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #0f172a;
              font-size: 12px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 24px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .company-name {
              font-size: 19px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .company-sub {
              font-size: 10.5px;
              color: #475569;
              margin-top: 2px;
            }
            .period-box {
              text-align: right;
            }
            .period-label {
              font-size: 10px;
              font-weight: 700;
              color: #4f46e5;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .period-val {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            .info-grid {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              border: 1px solid #e2e8f0;
              background: #f8fafc;
              border-radius: 6px;
              overflow: hidden;
            }
            .info-grid td {
              padding: 7px 12px;
              border: 1px solid #e2e8f0;
              font-size: 11.5px;
              vertical-align: top;
            }
            .info-label {
              display: block;
              font-size: 9.5px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
              margin-bottom: 1px;
            }
            .info-val {
              font-weight: 700;
              color: #0f172a;
            }
            .tables-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
              margin-bottom: 16px;
            }
            .table-wrap {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              overflow: hidden;
            }
            .table-title {
              padding: 7px 12px;
              font-weight: 700;
              font-size: 11.5px;
              border-bottom: 1px solid #cbd5e1;
            }
            .earnings-title {
              background: #ecfdf5;
              color: #047857;
            }
            .deductions-title {
              background: #fef2f2;
              color: #b91c1c;
            }
            table.item-table {
              width: 100%;
              border-collapse: collapse;
            }
            .total-row td {
              padding: 8px 12px;
              font-weight: 700;
              font-size: 12px;
              border-top: 2px solid #cbd5e1;
              background: #f8fafc;
            }
            .net-box {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
              border-radius: 8px;
              padding: 14px 18px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 18px;
            }
            .net-title {
              font-size: 10px;
              font-weight: 700;
              color: #15803d;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .net-val {
              font-size: 20px;
              font-weight: 800;
              color: #166534;
            }
            .net-words {
              font-size: 11px;
              color: #334155;
              font-style: italic;
              margin-top: 2px;
            }
            .footer-disclaimer {
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9.5px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <div class="header">
              <div>
                <div class="company-name">Employee Management System</div>
                <div class="company-sub">Corporate Technology Park, Outer Ring Road, Bengaluru - 560103</div>
                <div class="company-sub">Tax Assessment Unit: Bengaluru Division VII | CIN: U72200KA2024PTC123456</div>
              </div>
              <div class="period-box">
                <div class="period-label">Official Payslip</div>
                <div class="period-val">${payslip.pay_period}</div>
              </div>
            </div>

            <table class="info-grid">
              <tr>
                <td style="width: 25%;">
                  <span class="info-label">Employee Name</span>
                  <span class="info-val">${payslip.employee_name}</span>
                </td>
                <td style="width: 25%;">
                  <span class="info-label">Employee Code</span>
                  <span class="info-val" style="font-family: monospace;">${payslip.employee_code}</span>
                </td>
                <td style="width: 25%;">
                  <span class="info-label">Designation</span>
                  <span class="info-val">${payslip.designation}</span>
                </td>
                <td style="width: 25%;">
                  <span class="info-label">Department</span>
                  <span class="info-val">${payslip.department}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span class="info-label">Bank Account</span>
                  <span class="info-val" style="font-family: monospace;">${payslip.bank_account_masked || "N/A"}</span>
                </td>
                <td>
                  <span class="info-label">PAN Number</span>
                  <span class="info-val" style="font-family: monospace;">${payslip.pan_masked || "N/A"}</span>
                </td>
                <td>
                  <span class="info-label">Calendar / Paid Days</span>
                  <span class="info-val">${payslip.days_worked || 30} / ${payslip.days_in_month || 30} Days</span>
                </td>
                <td>
                  <span class="info-label">Payment Date</span>
                  <span class="info-val">${payslip.disbursed_on || "Processed"}</span>
                </td>
              </tr>
              ${payslip.transaction_ref ? `
              <tr>
                <td colspan="4">
                  <span class="info-label">Transaction Reference (UTR / Bank Ref)</span>
                  <span class="info-val" style="font-family: monospace;">${payslip.transaction_ref}</span>
                </td>
              </tr>` : ""}
            </table>

            <div class="tables-container">
              <div class="table-wrap">
                <div class="table-title earnings-title">Earnings (Salary Components)</div>
                <table class="item-table">
                  ${earningsRows}
                  <tr class="total-row">
                    <td>Gross Earnings</td>
                    <td style="text-align: right; color: #047857;">₹${(Number(payslip.gross_earnings) || 0).toLocaleString("en-IN")}</td>
                  </tr>
                </table>
              </div>

              <div class="table-wrap">
                <div class="table-title deductions-title">Statutory Deductions</div>
                <table class="item-table">
                  ${deductionsRows}
                  <tr class="total-row">
                    <td>Total Deductions</td>
                    <td style="text-align: right; color: #b91c1c;">- ₹${(Number(payslip.total_deductions) || 0).toLocaleString("en-IN")}</td>
                  </tr>
                </table>
              </div>
            </div>

            <div class="net-box">
              <div>
                <div class="net-title">Net Salary Transferred</div>
                <div class="net-val">₹${(Number(payslip.net_pay) || 0).toLocaleString("en-IN")}</div>
                <div class="net-words">${payslip.net_pay_words || ""}</div>
              </div>
              <div style="text-align: right; font-size: 11px; color: #166534;">
                <strong>Payment Status: PAID</strong>
                <div>Mode: Direct Bank Transfer</div>
              </div>
            </div>

            <div class="footer-disclaimer">
              <div>* Note: This is an authentic computer-generated statement and does not require a physical seal or signature.</div>
              <div>Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  };

  const handleDisburse = async (runId: string) => {
    try {
      await api.payroll.disburse(runId);
      setBannerFeedback({
        type: "success",
        message: "Payroll disbursement recorded and marked paid successfully.",
      });
      loadPayroll();
    } catch (err: any) {
      console.warn("Failed to disburse payroll:", err);
      setBannerFeedback({
        type: "error",
        message: err.message || "Failed to disburse payroll.",
      });
    }
  };

  const handleExecuteBatch = async () => {
    setProcessingBatch(true);
    setBatchFeedback(null);
    try {
      const res = await api.payroll.processBatch({
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
      });
      setIsProcessModalOpen(false);
      setBannerFeedback({
        type: "success",
        message: `Batch payroll calculation executed successfully! Total runs computed: ${res.total_processed ?? res.total ?? "all active employees"}.`,
      });
      await Promise.all([loadPayroll(), loadSalaries()]);
    } catch (err: any) {
      setBatchFeedback({
        type: "error",
        message: err.message || "Failed to execute batch payroll computation.",
      });
    } finally {
      setProcessingBatch(false);
    }
  };

  // Open Edit Modal for an existing salary structure
  const handleOpenSalaryEdit = (sal: SalaryStructure) => {
    setSelectedSalary(sal);
    setEditingEmpPublicId(sal.employee_public_id);
    setEditingBasicSalary(Number(sal.basic_salary) || 0);
    setEditingCurrency(sal.currency || "INR");
    setEditingEffectiveFrom(sal.effective_from || new Date().toISOString().split("T")[0]);

    if (sal.components && sal.components.length > 0) {
      setEditingComponents(
        sal.components.map((c) => ({
          component_id: c.component_id,
          component_name: c.component_name,
          component_type: c.component_type,
          amount: Number(c.amount) || 0,
        }))
      );
    } else {
      const comps: SalaryComponentItem[] = [];
      if (sal.hra) comps.push({ component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: Number(sal.hra) });
      if (sal.conveyance_allowance) comps.push({ component_name: "Conveyance Allowance", component_type: "earning", amount: Number(sal.conveyance_allowance) });
      if (sal.special_allowance) comps.push({ component_name: "Special Allowance", component_type: "earning", amount: Number(sal.special_allowance) });
      if (sal.provident_fund) comps.push({ component_name: "Provident Fund (PF)", component_type: "deduction", amount: Number(sal.provident_fund) });
      if (sal.professional_tax) comps.push({ component_name: "Professional Tax", component_type: "deduction", amount: Number(sal.professional_tax) });
      if (sal.tds_tax) comps.push({ component_name: "TDS / Income Tax", component_type: "deduction", amount: Number(sal.tds_tax) });
      setEditingComponents(comps);
    }
    setSalaryError(null);
    setIsSalaryModalOpen(true);
  };

  // Open Create Modal for adding a new salary structure
  const handleOpenSalaryCreate = () => {
    setSelectedSalary(null);
    setEditingEmpPublicId(employees[0]?.public_id || "");
    setEditingBasicSalary(60000);
    setEditingCurrency("INR");
    setEditingEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEditingComponents([
      { component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: 25000 },
      { component_name: "Special Allowance", component_type: "earning", amount: 15000 },
      { component_name: "Provident Fund (PF)", component_type: "deduction", amount: 7200 },
      { component_name: "Professional Tax", component_type: "deduction", amount: 200 },
      { component_name: "TDS / Income Tax", component_type: "deduction", amount: 5000 },
    ]);
    setSalaryError(null);
    setIsSalaryModalOpen(true);
  };

  // Dynamic component handlers inside the modal
  const handleAddEditingComponent = (type: "earning" | "deduction") => {
    setEditingComponents((prev) => [
      ...prev,
      {
        component_name: type === "earning" ? "Custom Allowance" : "Custom Deduction",
        component_type: type,
        amount: 0,
      },
    ]);
  };

  const handleUpdateEditingComponent = (idx: number, field: "component_name" | "amount", val: any) => {
    setEditingComponents((prev) => {
      const next = [...prev];
      if (field === "amount") {
        next[idx] = { ...next[idx], amount: Math.max(0, Number(val) || 0) };
      } else {
        next[idx] = { ...next[idx], component_name: val };
      }
      return next;
    });
  };

  const handleRemoveEditingComponent = (idx: number) => {
    setEditingComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  // Computed modal metrics
  const modalEarnings = editingComponents.filter((c) => c.component_type === "earning");
  const modalDeductions = editingComponents.filter((c) => c.component_type === "deduction");
  const modalTotalEarnings = modalEarnings.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const modalGross = Number(editingBasicSalary || 0) + modalTotalEarnings;
  const modalTotalDeductions = modalDeductions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const modalNet = Math.max(0, modalGross - modalTotalDeductions);

  // Save revision
  const handleSaveSalaryRevision = async () => {
    if (!editingEmpPublicId) {
      setSalaryError("Please select an employee.");
      return;
    }
    setSalarySaving(true);
    setSalaryError(null);
    try {
      await api.salaries.createRevision({
        employee_public_id: editingEmpPublicId,
        basic_salary: Number(editingBasicSalary),
        currency: editingCurrency,
        effective_from: editingEffectiveFrom,
        components: editingComponents,
      });
      await Promise.all([loadSalaries(), loadPayroll()]);
      setIsSalaryModalOpen(false);
    } catch (err: any) {
      setSalaryError(err.message || "Failed to save salary revision.");
    } finally {
      setSalarySaving(false);
    }
  };

  // Filtered salary structures for display
  const filteredSalaries = salaryStructures.filter((s) => {
    const q = salarySearch.toLowerCase();
    const name = (s.employee_name || "").toLowerCase();
    const code = (s.employee_code || "").toLowerCase();
    const dept = (s.department_name || "").toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q);
  });
  const paginatedSalaries = filteredSalaries.slice(
    (salaryPage - 1) * salaryPageSize,
    salaryPage * salaryPageSize
  );

  // Computed live financial metrics from real pay runs
  const disbursedRuns = runs.filter((r) => (r.payment_status || "").toLowerCase() === "paid");
  const pendingRuns = runs.filter((r) => (r.payment_status || "").toLowerCase() === "pending");
  const disbursedTotal = disbursedRuns.reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0);
  const pendingTotal = pendingRuns.reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0);

  // Employee-specific live computations
  const latestRun = runs[0];
  const employeeTakeHome = latestRun ? Number(latestRun.net_pay) || 0 : 0;
  const employeeDeductions = latestRun ? Number(latestRun.total_deductions) || 0 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {isEmployeeRole ? "My Salary & Payslips" : "Compensation & Payroll"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            {isEmployeeRole
              ? "Inspect your monthly earnings, statutory EPF/tax deductions, and download payslips"
              : "Salary structures, dynamic allowance components, custom deductions, and batch disbursement"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isEmployeeRole && canManageSalary && (
            <button onClick={handleOpenSalaryCreate} className="btn btn-secondary">
              <Plus size={16} /> New Salary Structure
            </button>
          )}
          {canProcess && (
            <button onClick={() => setIsProcessModalOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Execute Pay Run Batch
            </button>
          )}
        </div>
      </div>

      {/* Banner Feedback for Operations */}
      {bannerFeedback && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            background:
              bannerFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${
              bannerFeedback.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
            color:
              bannerFeedback.type === "success"
                ? "var(--color-emerald-400)"
                : "var(--color-rose-400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {bannerFeedback.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <Info size={18} />
            )}
            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
              {bannerFeedback.message}
            </span>
          </div>
          <button
            onClick={() => setBannerFeedback(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.2rem",
              lineHeight: 1,
              padding: "2px 6px",
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs Navigation (Admin & HR) */}
      {!isEmployeeRole && (
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: 2,
          }}
        >
          <button
            onClick={() => setActiveTab("runs")}
            className="btn btn-ghost"
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "8px 16px",
              color: activeTab === "runs" ? "var(--color-primary-300)" : "var(--text-muted)",
              borderBottom: activeTab === "runs" ? "2px solid var(--color-primary-500)" : "2px solid transparent",
              borderRadius: "4px 4px 0 0",
              background: activeTab === "runs" ? "rgba(99, 102, 241, 0.08)" : "transparent",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <WalletCards size={16} />
            Payroll Batches & Runs
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 7px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.08)",
              }}
            >
              {runs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("structures")}
            className="btn btn-ghost"
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "8px 16px",
              color: activeTab === "structures" ? "var(--color-primary-300)" : "var(--text-muted)",
              borderBottom: activeTab === "structures" ? "2px solid var(--color-primary-500)" : "2px solid transparent",
              borderRadius: "4px 4px 0 0",
              background: activeTab === "structures" ? "rgba(99, 102, 241, 0.08)" : "transparent",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={16} />
            Salary Structures & Dynamic Deductions
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 7px",
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--color-emerald-400)",
              }}
            >
              {salaryStructures.length}
            </span>
          </button>
        </div>
      )}

      {/* Financial Metrics Summary */}
      <div className="grid-cols-2">
        <div className="card">
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            {isEmployeeRole ? "Latest Net Take-Home" : "Total Disbursed (Completed)"}
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-emerald-400)", marginBottom: 4 }}>
            {isEmployeeRole
              ? latestRun
                ? `₹${employeeTakeHome.toLocaleString("en-IN")}`
                : "₹0"
              : `₹${disbursedTotal.toLocaleString("en-IN")}`}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {isEmployeeRole
              ? latestRun
                ? `Pay period: ${latestRun.pay_period_start} to ${latestRun.pay_period_end}`
                : "No processed payslips found in backend"
              : `${disbursedRuns.length} completed batch pay run${disbursedRuns.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="card">
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            {isEmployeeRole ? "Latest Total Deductions" : "Pending Disbursements"}
          </span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: isEmployeeRole ? "var(--color-primary-400)" : "var(--color-amber-400)", marginBottom: 4 }}>
            {isEmployeeRole
              ? latestRun
                ? `₹${employeeDeductions.toLocaleString("en-IN")}`
                : "₹0"
              : `₹${pendingTotal.toLocaleString("en-IN")}`}
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {isEmployeeRole
              ? latestRun
                ? "Statutory TDS, EPF and Professional Tax withholdings"
                : "No active deduction records"
              : `${pendingRuns.length} employee pay run${pendingRuns.length === 1 ? "" : "s"} awaiting disbursement`}
          </span>
        </div>
      </div>

      {/* TAB 1: Payroll Runs Table */}
      {(isEmployeeRole || activeTab === "runs") && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {isEmployeeRole ? "My Pay Slips & Disbursements" : "Payroll Run Records"}
            </h2>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Showing {runs.length} of {totalItems} records
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Gross Salary</th>
                  <th>Deductions</th>
                  <th>Net Disbursed</th>
                  <th>Status</th>
                  <th>Payment Reference</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                      No payroll records found.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.public_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {r.employee_name || "Employee"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {r.employee_code} • {r.department_name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {r.pay_period_start} to {r.pay_period_end}
                        </div>
                      </td>
                      <td>₹{(Number(r.gross_earnings) || 0).toLocaleString("en-IN")}</td>
                      <td style={{ color: "var(--color-rose-400)" }}>
                        - ₹{(Number(r.total_deductions) || 0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: "var(--color-emerald-400)" }}>
                          ₹{(Number(r.net_pay) || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={r.payment_status} />
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          {r.payment_reference || "Pending Batch"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={() => handleViewPayslip(r)}
                            className="btn btn-secondary btn-sm"
                            title="View itemized payslip"
                          >
                            <FileText size={14} /> Payslip
                          </button>
                          {r.payment_status === "pending" && canProcess && (
                            <button
                              onClick={() => handleDisburse(r.public_id)}
                              className="btn btn-success btn-sm"
                              title="Authorize disbursement"
                            >
                              <Send size={14} /> Disburse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemLabel="payroll records"
          />
        </div>
      )}

      {/* TAB 2: Salary Structures & Dynamic Deductions Table */}
      {!isEmployeeRole && activeTab === "structures" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Active Salary Structures & Compensation Profiles
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Configure base salaries, dynamic earning components, and statutory/custom deductions per employee.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative", minWidth: 240 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search employee, code, dept..."
                  className="input-field"
                  style={{ paddingLeft: 30, fontSize: "0.82rem", height: 34 }}
                  value={salarySearch}
                  onChange={(e) => {
                    setSalarySearch(e.target.value);
                    setSalaryPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base Fixed</th>
                  <th>Earning Components</th>
                  <th>Gross Salary</th>
                  <th>Custom & Statutory Deductions</th>
                  <th>Net Take-Home</th>
                  <th>Effective From</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                      No salary structures found. Click "+ New Salary Structure" to create one.
                    </td>
                  </tr>
                ) : (
                  paginatedSalaries.map((sal) => {
                    const comps = sal.components || [];
                    const earnings = comps.filter((c) => c.component_type === "earning");
                    const deductions = comps.filter((c) => c.component_type === "deduction");
                    const earningTotal = earnings.reduce((s, c) => s + (Number(c.amount) || 0), 0);
                    const deductionTotal = deductions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
                    const gross = Number(sal.gross_salary || (Number(sal.basic_salary) + earningTotal));

                    return (
                      <tr key={sal.public_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {sal.employee_name || "Employee"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {sal.employee_code || sal.employee_public_id?.substring(0, 8)} • {sal.department_name || "General"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            ₹{Number(sal.basic_salary).toLocaleString("en-IN")}
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>monthly fixed</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600, color: "var(--color-emerald-400)", fontSize: "0.82rem" }}>
                              +₹{earningTotal.toLocaleString("en-IN")}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {earnings.length} component{earnings.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            ₹{gross.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600, color: "var(--color-rose-400)", fontSize: "0.82rem" }}>
                              -₹{deductionTotal.toLocaleString("en-IN")}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {deductions.length} deduction{deductions.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: "var(--color-emerald-400)", fontSize: "0.95rem" }}>
                            ₹{Number(sal.net_salary).toLocaleString("en-IN")}
                          </span>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            CTC: ₹{(gross * 12).toLocaleString("en-IN")}/yr
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            {sal.effective_from}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            onClick={() => handleOpenSalaryEdit(sal)}
                            className="btn btn-secondary btn-sm"
                            title="Edit salary components and deductions"
                            style={{ gap: 6 }}
                          >
                            <Sliders size={14} /> Adjust Salary
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={salaryPage}
            totalItems={filteredSalaries.length}
            pageSize={salaryPageSize}
            onPageChange={setSalaryPage}
            onPageSizeChange={setSalaryPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemLabel="salary profiles"
          />
        </div>
      )}

      {/* Salary Adjustment & Dynamic Components Modal */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title={selectedSalary ? `Adjust Salary: ${selectedSalary.employee_name || "Employee"}` : "Define New Salary Structure"}
        maxWidth={760}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {salaryError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-rose-400)",
                fontSize: "0.85rem",
              }}
            >
              {salaryError}
            </div>
          )}

          {/* Employee & Effective Date Selection */}
          <div className="grid-cols-2" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Employee *</label>
              {selectedSalary ? (
                <input
                  type="text"
                  disabled
                  className="input-field"
                  value={`${selectedSalary.employee_name || "Employee"} (${selectedSalary.employee_code || selectedSalary.employee_public_id?.substring(0, 8)})`}
                  style={{ opacity: 0.8 }}
                />
              ) : (
                <select
                  className="input-field"
                  value={editingEmpPublicId}
                  onChange={(e) => setEditingEmpPublicId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.public_id} value={emp.public_id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.department_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Effective From Date *</label>
              <input
                type="date"
                required
                className="input-field"
                value={editingEffectiveFrom}
                onChange={(e) => setEditingEffectiveFrom(e.target.value)}
              />
            </div>
          </div>

          {/* Base Fixed Monthly Salary */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>
              Base Fixed Monthly Salary ({editingCurrency}) *
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                min={0}
                required
                className="input-field"
                style={{ fontSize: "1.1rem", fontWeight: 700 }}
                value={editingBasicSalary}
                onChange={(e) => setEditingBasicSalary(Math.max(0, Number(e.target.value) || 0))}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                per month
              </span>
            </div>
          </div>

          {/* Earnings (Dynamic Salary Components) */}
          <div
            style={{
              padding: "14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(16, 185, 129, 0.03)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--color-emerald-400)" }}>
                  Earnings & Allowances ({modalEarnings.length})
                </span>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block" }}>
                  Subtotal: ₹{modalTotalEarnings.toLocaleString("en-IN")} / mo
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddEditingComponent("earning")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.75rem", padding: "4px 10px", gap: 4 }}
              >
                <Plus size={13} /> Add Earning Component
              </button>
            </div>

            {modalEarnings.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                No additional earnings added. Click "+ Add Earning Component" to add allowances like HRA, Bonus, Conveyance.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editingComponents.map((comp, idx) => {
                  if (comp.component_type !== "earning") return null;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ flex: 2, fontSize: "0.84rem" }}
                        placeholder="Allowance Name (e.g. HRA, Special Allowance, Bonus)"
                        value={comp.component_name}
                        onChange={(e) => handleUpdateEditingComponent(idx, "component_name", e.target.value)}
                      />
                      <input
                        type="number"
                        min={0}
                        className="input-field"
                        style={{ flex: 1, fontSize: "0.84rem", fontWeight: 600 }}
                        placeholder="Amount (₹)"
                        value={comp.amount}
                        onChange={(e) => handleUpdateEditingComponent(idx, "amount", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEditingComponent(idx)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--color-rose-400)", padding: "6px" }}
                        title="Delete component"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deductions (Dynamic Withholdings) */}
          <div
            style={{
              padding: "14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(244, 63, 94, 0.03)",
              border: "1px solid rgba(244, 63, 94, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--color-rose-400)" }}>
                  Deductions & Withholdings ({modalDeductions.length})
                </span>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block" }}>
                  Subtotal: ₹{modalTotalDeductions.toLocaleString("en-IN")} / mo
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddEditingComponent("deduction")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.75rem", padding: "4px 10px", gap: 4 }}
              >
                <Plus size={13} /> Add Deduction
              </button>
            </div>

            {modalDeductions.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                No deductions configured. Click "+ Add Deduction" to add Provident Fund, Professional Tax, Health Insurance, or TDS.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editingComponents.map((comp, idx) => {
                  if (comp.component_type !== "deduction") return null;
                  return (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ flex: 2, fontSize: "0.84rem" }}
                        placeholder="Deduction Name (e.g. Provident Fund, Health Insurance, Loan)"
                        value={comp.component_name}
                        onChange={(e) => handleUpdateEditingComponent(idx, "component_name", e.target.value)}
                      />
                      <input
                        type="number"
                        min={0}
                        className="input-field"
                        style={{ flex: 1, fontSize: "0.84rem", fontWeight: 600 }}
                        placeholder="Amount (₹)"
                        value={comp.amount}
                        onChange={(e) => handleUpdateEditingComponent(idx, "amount", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEditingComponent(idx)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--color-rose-400)", padding: "6px" }}
                        title="Delete deduction"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Compensation Summary Card */}
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08))",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block" }}>
                Monthly Net Take-Home Pay
              </span>
              <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-emerald-400)" }}>
                ₹{modalNet.toLocaleString("en-IN")} / month
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Gross: <strong>₹{modalGross.toLocaleString("en-IN")}</strong> | Deductions: <strong style={{ color: "var(--color-rose-400)" }}>-₹{modalTotalDeductions.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-primary-300)", marginTop: 2 }}>
                Annual CTC: ₹{(modalGross * 12).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
            <button
              type="button"
              disabled={salarySaving}
              onClick={() => setIsSalaryModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={salarySaving}
              onClick={handleSaveSalaryRevision}
              className="btn btn-primary"
            >
              {salarySaving ? "Saving Revision..." : "Save Salary Revision"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Itemized Printable Payslip Modal */}
      <Modal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        title="Official Itemized Payslip"
        maxWidth={720}
      >
        {selectedPayslip && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Payslip Header */}
            <div style={{ borderBottom: "2px solid var(--border-strong)", paddingBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Employee Management System
                </h3>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Corporate Technology Park, Outer Ring Road, Bengaluru - 560103
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Tax Assessment Unit: Bengaluru Division VII
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-primary-400)", textTransform: "uppercase" }}>
                  Payslip For Period
                </span>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {selectedPayslip.pay_period}
                </div>
              </div>
            </div>

            {/* Employee & Bank Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, background: "var(--bg-surface-elevated)", padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Employee Name</span>
                <strong>{selectedPayslip.employee_name}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Employee Code</span>
                <strong style={{ fontFamily: "var(--font-mono)" }}>{selectedPayslip.employee_code}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Department & Role</span>
                <span>{selectedPayslip.designation} ({selectedPayslip.department})</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Bank Account (Masked)</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{selectedPayslip.bank_account_masked || "N/A"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>PAN Number (Masked)</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{selectedPayslip.pan_masked || "N/A"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.75rem" }}>Paid / Working Days</span>
                <span>{selectedPayslip.days_worked || 30} / {selectedPayslip.days_in_month || 30} Days</span>
              </div>
            </div>

            {/* Itemized Earnings & Deductions Tables Side-by-Side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Earnings Column */}
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--color-emerald-400)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginBottom: 8 }}>
                  Earnings (Components)
                </div>
                {(selectedPayslip.earnings || []).map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "4px 0" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{e.label}</span>
                    <span style={{ fontWeight: 600 }}>₹{(Number(e.amount) || 0).toLocaleString("en-IN")}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 700, borderTop: "1px solid var(--border-strong)", paddingTop: 8, marginTop: 12 }}>
                  <span>Gross Earnings</span>
                  <span style={{ color: "var(--color-emerald-400)" }}>₹{(Number(selectedPayslip.gross_earnings) || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Deductions Column */}
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--color-rose-400)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginBottom: 8 }}>
                  Statutory Deductions
                </div>
                {(selectedPayslip.deductions || []).map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "4px 0" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--color-rose-400)" }}>- ₹{(Number(d.amount) || 0).toLocaleString("en-IN")}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 700, borderTop: "1px solid var(--border-strong)", paddingTop: 8, marginTop: 12 }}>
                  <span>Total Deductions</span>
                  <span style={{ color: "var(--color-rose-400)" }}>- ₹{(Number(selectedPayslip.total_deductions) || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Net Pay Callout */}
            <div style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1))", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Net Salary Transferred
                </span>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-emerald-400)" }}>
                  ₹{(Number(selectedPayslip.net_pay) || 0).toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontStyle: "italic", marginTop: 2 }}>
                  {selectedPayslip.net_pay_words}
                </div>
              </div>

              {selectedPayslip.transaction_ref && (
                <div style={{ textAlign: "right", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  <div>Ref: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedPayslip.transaction_ref}</span></div>
                  <div>Processed: {selectedPayslip.disbursed_on}</div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => handlePrintPayslip(selectedPayslip)}
                className="btn btn-secondary btn-sm"
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setIsPayslipModalOpen(false)}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Process Batch Modal */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title="Execute Batch Payroll Calculation"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            This action computes salary formulas for all employees based on working calendar days, verified attendance timesheets, approved leaves, EPF, and tax slabs.
          </p>

          {batchFeedback && (
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
              <Info size={16} />
              <span>{batchFeedback.message}</span>
            </div>
          )}

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Pay Period Start *</label>
              <input
                type="date"
                value={payPeriodStart}
                onChange={(e) => setPayPeriodStart(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pay Period End *</label>
              <input
                type="date"
                value={payPeriodEnd}
                onChange={(e) => setPayPeriodEnd(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              disabled={processingBatch}
              onClick={() => setIsProcessModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processingBatch}
              onClick={handleExecuteBatch}
              className="btn btn-primary"
            >
              {processingBatch ? "Computing Payroll..." : "Confirm & Generate Pending Runs"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

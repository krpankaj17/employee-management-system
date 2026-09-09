/**
 * Payroll and Compensation Types
 */

export interface SalaryComponentItem {
  component_id?: number;
  component_name: string;
  component_type: "earning" | "deduction";
  amount: number;
}

export interface SalaryStructure {
  public_id: string;
  employee_public_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  basic_salary: number;
  hra?: number;
  conveyance_allowance?: number;
  special_allowance?: number;
  provident_fund?: number;
  professional_tax?: number;
  tds_tax?: number;
  gross_salary?: number;
  net_salary: number;
  currency: string;
  effective_from: string;
  effective_to?: string | null;
  components?: SalaryComponentItem[];
}

export interface BankDetail {
  public_id: string;
  employee_public_id: string;
  account_holder_name?: string;
  bank_name: string;
  account_number: string;
  routing_code?: string;
  ifsc_code?: string;
  branch_name?: string | null;
  account_type: "Savings" | "Current" | "Salary" | "savings" | "current" | string;
  is_primary: boolean;
}

export interface PayrollRun {
  public_id: string;
  employee_public_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  designation_name?: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  payment_status: "pending" | "paid" | "failed" | "cancelled" | string;
  payment_date?: string | null;
  payment_reference?: string | null;
  payment_mode?: string | null;
  created_at?: string;
}

export interface PayslipDetail {
  payroll_public_id: string;
  employee_public_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  designation: string;
  bank_account_masked: string;
  pan_masked: string;
  pay_period: string;
  days_in_month: number;
  days_worked: number;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  net_pay_words: string;
  disbursed_on?: string | null;
  transaction_ref?: string | null;
}

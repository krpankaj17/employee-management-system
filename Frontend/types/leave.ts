/**
 * Leave Management Types
 */

export interface LeaveType {
  public_id: string;
  type_name: string;
  name?: string;
  type_code: string;
  annual_quota: number;
  max_days_per_year?: number;
  is_carry_forward: boolean;
  is_paid: boolean;
  description?: string;
}

export interface CreateLeaveTypePayload {
  name: string;
  max_days_per_year: number;
  is_paid?: boolean;
  description?: string;
  auto_allocate_all?: boolean;
}

export interface UpdateLeaveTypePayload {
  name: string;
  max_days_per_year: number;
  is_paid?: boolean;
  description?: string;
}

export interface AllocateLeaveBalancePayload {
  employee_public_id: string;
  leave_type_public_id: string;
  year: number;
  total_allocated: number;
}

export interface LeaveBalance {
  balance_id: number;
  employee_public_id: string;
  leave_type_public_id: string;
  leave_type_name: string;
  type_code: string;
  year: number;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  total_allocated?: number;
  used_leaves?: number;
  remaining_leaves?: number;
}

export interface LeaveRequest {
  public_id: string;
  employee_public_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  leave_type_public_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  action_by_employee_name?: string;
  action_notes?: string;
  created_at: string;
}


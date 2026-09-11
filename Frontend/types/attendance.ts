/**
 * Attendance Tracking Types
 */

export interface AttendanceRecord {
  attendance_id: number | string;
  public_id?: string;
  employee_public_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  date: string; // YYYY-MM-DD
  check_in_time: string | null; // ISO timestamp
  check_out_time: string | null; // ISO timestamp
  check_in?: string | null; // backend alias
  check_out?: string | null; // backend alias
  work_mode: "Office" | "Remote" | "Hybrid";
  status: "Present" | "Absent" | "Half_Day" | "On_Leave" | "Late";
  total_hours?: number;
  notes?: string;
  is_late?: boolean;
}

export interface AttendanceSummary {
  present_count: number;
  absent_count: number;
  late_count: number;
  on_leave_count: number;
  total_employees: number;
  average_work_hours: number;
}

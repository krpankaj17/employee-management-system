/**
 * Department and Designation Types
 */

export interface Department {
  public_id: string;
  department_name: string;
  department_code: string;
  dept_name?: string;
  dept_code?: string;
  head_employee_public_id?: string | null;
  head_employee_name?: string | null;
  employee_count?: number;
  description?: string;
}

export interface Designation {
  public_id: string;
  designation_name: string;
  title?: string;
  designation_code?: string;
  department_public_id?: string;
  department_name?: string;
  grade_level?: string;
  description?: string;
  min_salary?: number;
  max_salary?: number;
}


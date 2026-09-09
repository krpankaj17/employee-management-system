/**
 * Project Management Types
 */

export interface ProjectMember {
  member_id: number;
  project_public_id: string;
  employee_public_id: string;
  employee_name: string;
  role_in_project: "Lead" | "Developer" | "Designer" | "QA" | "DevOps";
  joined_at: string;
}

export interface Project {
  public_id: string;
  project_code: string;
  project_name: string;
  description: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  start_date: string;
  end_date?: string | null;
  head_employee_public_id?: string | null;
  head_employee_name?: string | null;
  project_head_public_id?: string | null;
  project_head_name?: string | null;
  members_count: number;
  member_count?: number;
  members?: ProjectMember[];
  completion_percentage?: number;
}

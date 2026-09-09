/**
 * Performance Review Types
 */

export interface PerformanceReview {
  public_id: string;
  employee_public_id: string;
  employee_name: string;
  department_name?: string;
  designation_name?: string;
  reviewer_public_id: string;
  reviewer_name: string;
  review_cycle: string; // e.g. "Q1 2026", "Annual 2025"
  performance_score: number; // 1 to 5
  strengths: string;
  areas_of_improvement: string;
  goals: string;
  status: "Draft" | "Submitted" | "Acknowledged";
  employee_comments?: string | null;
  created_at: string;
}

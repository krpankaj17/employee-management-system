/**
 * Common Generics and Global Types
 * 
 * 🎓 LEARNING NOTE:
 * Generic types like Paginated<T> allow you to reuse pagination logic for ANY entity
 * without duplicating code.
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number | null;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Enterprise Roles exactly matching backend:
 * 1. Admin - Super Administrator with unrestricted system privileges
 * 2. HR_Manager - People operations, payroll, attendance, onboarding
 * 3. Department_Head - Department leader with team oversight & leave approvals
 * 4. Project_Manager - Project Lead managing project deliverables & reviews
 * 5. Employee - Standard company employee with self-service capabilities
 */
export type UserRole = "Admin" | "HR_Manager" | "Department_Head" | "Project_Manager" | "Employee";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

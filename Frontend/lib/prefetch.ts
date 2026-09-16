import { api } from "./apiClient";

/**
 * High-performance lean prefetch for navigation links.
 * Prefetches essential first-page data into client SWR memory cache.
 */
export function prefetchTabData(href: string, employeePublicId?: string | null, isEmployeeRole?: boolean) {
  try {
    switch (href) {
      case "/employees":
        api.employees.search({ skip: 0, limit: 10 }).catch(() => {});
        api.departments.list().catch(() => {});
        api.designations.list().catch(() => {});
        api.dashboard.getSummary().catch(() => {});
        break;
      case "/attendance": {
        const empId = isEmployeeRole && employeePublicId ? employeePublicId : undefined;
        // 1. Dashboard summary warms the adherence card immediately for 0ms render
        api.dashboard.getSummary().catch(() => {});
        // 2. Lean attendance records: limit to 50 items (sufficient for initial paginated view)
        api.attendance.getRecords({ limit: 50, employee_public_id: empId }).catch(() => {});
        api.employees.list({ limit: 50 }).catch(() => {});
        api.leaves.getRequests({ limit: 50, employee_public_id: empId }).catch(() => {});
        if (isEmployeeRole) {
          api.leaves.getBalances().catch(() => {});
        }
        api.attendance.getSettings().catch(() => {});
        break;
      }
      case "/dashboard":
        api.dashboard.getSummary().catch(() => {});
        break;
      case "/leaves":
        api.leaves.getBalances().catch(() => {});
        api.leaves.getRequests({ limit: 50 }).catch(() => {});
        api.leaves.listTypes().catch(() => {});
        break;
      case "/payroll":
        api.payroll.getRuns({ limit: 20 }).catch(() => {});
        break;
      case "/projects":
        api.projects.list({ limit: 20 }).catch(() => {});
        break;
      case "/reviews":
        api.reviews.list({ limit: 20 }).catch(() => {});
        break;
      case "/departments":
        api.departments.list().catch(() => {});
        api.departments.listDesignations().catch(() => {});
        break;
      case "/roles":
        api.auth.listRolesDetailed().catch(() => {});
        api.auth.listPermissions().catch(() => {});
        break;
      case "/approvals":
        api.auth.listPendingUsers().catch(() => {});
        break;
      case "/announcements":
        api.announcements.list().catch(() => {});
        break;
      case "/holidays":
        api.holidays.list().catch(() => {});
        break;
    }
  } catch (e) {}
}

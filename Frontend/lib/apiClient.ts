/**
 * Universal Dual-Backend API Client & Adapter
 * 
 * Interoperable with:
 * 1. Java Spring Boot (http://localhost:8080)
 * 2. Python FastAPI (http://localhost:8000)
 * 3. Standalone Mock In-Memory Mode
 * 
 * Normalizes request payloads and response envelopes transparently.
 */

import { API_CONFIG, getBaseUrl, isMockData, getActiveBackend, setActiveBackend, BackendType } from "./config";
import { Paginated } from "@/types/common";
import { Employee, EmployeeFilterParams, Address, EmergencyContact } from "@/types/employee";
import { AttendanceRecord } from "@/types/attendance";
import { LeaveBalance, LeaveRequest, LeaveType } from "@/types/leave";
import { PayrollRun, PayslipDetail, SalaryStructure, BankDetail, SalaryComponentItem } from "@/types/payroll";
import { Project, ProjectMember } from "@/types/project";
import { PerformanceReview } from "@/types/review";
import { Department, Designation } from "@/types/department";
import { Announcement } from "@/types/announcement";
import { Holiday } from "@/types/holiday";
import { AuditLog } from "@/types/audit";
import { DocumentRecord, DocumentUploadPayload, DocumentVerifyPayload } from "@/types/document";
import { showToast } from "@/components/ui/Toast";
import {
  UserProfile,
  UserSignupIn,
  SendOtpIn,
  SendOtpOut,
  ForgotPasswordIn,
  ResetPasswordIn,
  ChangePasswordIn,
  Role,
  Permission,
  RoleCreateIn,
  RoleUpdateIn,
  RoleDetail,
} from "@/types/auth";
import * as mockData from "@/data";
import { getActiveUser, hasPermission, getActiveRole, MOCK_USERS_BY_ROLE, normalizeUserProfile } from "./auth";

/**
 * Helper to check if a token string has valid JWT structure (3 dot-separated base64 segments)
 */
export function isValidJwt(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.trim().split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Creates a syntactically valid 3-part mock JWT for offline demo mode
 */
export function createMockJwt(sub = "usr-demo", role = "Admin"): string {
  const b64 = (str: string) => {
    try {
      if (typeof window !== "undefined" && window.btoa) {
        return window.btoa(unescape(encodeURIComponent(str))).replace(/=/g, "");
      }
      return Buffer.from(str).toString("base64url");
    } catch {
      return "mockseg";
    }
  };
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 86400 }));
  const signature = b64("mock_signature_hash");
  return `${header}.${payload}.${signature}`;
}

/**
 * Humanizes backend field keys into user-friendly form labels.
 */
export function humanizeFieldName(loc: string): string {
  if (!loc) return "Field";
  const map: Record<string, string> = {
    username: "Corporate email / username",
    email: "Corporate email",
    corporate_email: "Corporate email",
    personal_email: "Personal email",
    password: "Password",
    current_password: "Current password",
    new_password: "New password",
    confirm_password: "Confirm password",
    first_name: "First name",
    last_name: "Last name",
    display_name: "Full name",
    name: "Name",
    title: "Title",
    phone: "Phone number",
    phone_number: "Phone number",
    department_id: "Department",
    department_name: "Department name",
    department_code: "Department code",
    designation_id: "Designation / Role",
    salary: "Salary",
    base_salary: "Base salary",
    hourly_rate: "Hourly rate",
    hire_date: "Date of joining",
    joining_date: "Date of joining",
    date_of_birth: "Date of birth",
    leave_type: "Leave type",
    leave_type_id: "Leave type",
    start_date: "Start date",
    end_date: "End date",
    reason: "Reason",
    notes: "Notes",
    content: "Notice content",
    amount: "Amount",
    bonus: "Bonus",
    deductions: "Deductions",
  };
  if (map[loc.toLowerCase()]) return map[loc.toLowerCase()];
  return loc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Translates database constraint errors, raw exceptions, and technical tracebacks into user-friendly English.
 */
export function cleanRawErrorMessage(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  const lower = raw.toLowerCase();

  // PostgreSQL Unique Constraint
  if (lower.includes("duplicate key value") || lower.includes("unique constraint")) {
    if (lower.includes("email")) {
      return "An employee or user account with this email address already exists.";
    }
    if (lower.includes("employee_id")) {
      return "This Employee ID is already assigned to another employee.";
    }
    if (lower.includes("department_code") || lower.includes("dept_code")) {
      return "A department with this code already exists. Please choose a different code.";
    }
    if (lower.includes("department_name")) {
      return "A department with this name already exists.";
    }
    if (lower.includes("attendance")) {
      return "An attendance record already exists for this employee today.";
    }
    return "A duplicate record with these unique details already exists.";
  }

  // PostgreSQL Foreign Key Constraint
  if (lower.includes("foreign key constraint") || lower.includes("violates foreign key")) {
    return "The referenced item (e.g. department, manager, or project) does not exist or has been removed.";
  }

  // PostgreSQL Not-Null Constraint
  if (lower.includes("not-null constraint") || lower.includes("violates not-null")) {
    const colMatch = raw.match(/column\s+"([^"]+)"/i);
    const colName = colMatch ? humanizeFieldName(colMatch[1]) : "A required field";
    return `${colName} is required and cannot be left empty.`;
  }

  // Missing table or database migration error
  if (lower.includes("relation") && lower.includes("does not exist")) {
    return "Database table is undergoing updates. Please refresh the page or try again shortly.";
  }

  // Auth / Credentials
  if (lower.includes("incorrect username or password") || lower === "invalid credentials") {
    return "Invalid corporate email or password. Please verify your credentials.";
  }
  if (lower.includes("token has expired") || lower.includes("signature has expired")) {
    return "Your login session has expired. Please sign in again.";
  }
  if (lower.includes("could not validate credentials")) {
    return "Security session verification failed. Please sign in again.";
  }
  if (lower.includes("not enough permissions") || lower.includes("permission denied")) {
    return "You do not have permission to perform this action.";
  }

  // Redis / cache
  if (lower.includes("unable to connect to redis") || lower.includes("redisconnection")) {
    return "Cache server is unreachable. System is operating in direct database mode.";
  }

  // Raw Python tracebacks or internal library noise
  if (raw.includes("Traceback (most recent call last)") || raw.includes("psycopg2.") || raw.includes("sqlalchemy.")) {
    return "An internal server error occurred while processing the database query.";
  }

  return raw;
}

/**
 * Unified parser to transform API error responses into clear, human-understandable guidance.
 */
export function formatUserFacingErrorMessage(errorBody: any, status: number): string {
  if (!errorBody && !status) return "An unexpected error occurred. Please try again.";

  // 1. Check for field-level validation errors (Spring Boot / custom objects)
  const valErrors = errorBody?.validation_errors || errorBody?.validationErrors;
  if (valErrors && typeof valErrors === "object" && !Array.isArray(valErrors) && Object.keys(valErrors).length > 0) {
    return Object.entries(valErrors)
      .map(([k, v]) => `${humanizeFieldName(k)}: ${cleanRawErrorMessage(String(v))}`)
      .join("; ");
  }

  // 2. Check for FastAPI / Pydantic validation array
  if (Array.isArray(errorBody?.detail)) {
    const readableErrors = errorBody.detail
      .map((item: any) => {
        if (typeof item === "string") return cleanRawErrorMessage(item);
        if (!item || typeof item !== "object") return "";

        const loc = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : "";
        const fieldName = humanizeFieldName(loc);
        const rawMsg = (item.msg || item.detail || "").toString();
        const type = (item.type || "").toString();

        if (type === "missing" || rawMsg.toLowerCase().includes("field required")) {
          return `${fieldName} is required`;
        }
        if (type === "string_too_short" || rawMsg.includes("at least 1 character")) {
          const min = item.ctx?.min_length;
          return min && min > 1
            ? `${fieldName} must be at least ${min} characters`
            : `${fieldName} cannot be empty`;
        }
        if (type === "string_too_long") {
          const max = item.ctx?.max_length;
          return max
            ? `${fieldName} cannot exceed ${max} characters`
            : `${fieldName} exceeds maximum allowed length`;
        }
        if (type.includes("email") || rawMsg.toLowerCase().includes("valid email")) {
          return `Please enter a valid corporate email address for ${fieldName}`;
        }
        if (type.includes("int") || type.includes("float") || type.includes("decimal")) {
          return `${fieldName} must be a valid numeric value`;
        }
        if (type.includes("date")) {
          return `${fieldName} must be a valid date in YYYY-MM-DD format`;
        }
        if (type.includes("greater_than")) {
          const gt = item.ctx?.gt ?? item.ctx?.ge ?? 0;
          return `${fieldName} must be greater than ${gt}`;
        }
        if (type.includes("less_than")) {
          const lt = item.ctx?.lt ?? item.ctx?.le;
          return `${fieldName} must be less than or equal to ${lt}`;
        }

        return loc ? `${fieldName}: ${cleanRawErrorMessage(rawMsg)}` : cleanRawErrorMessage(rawMsg);
      })
      .filter(Boolean);

    if (readableErrors.length > 0) {
      return readableErrors.join(" • ");
    }
  }

  // 3. String detail / message / error property
  let raw = "";
  if (typeof errorBody?.detail === "string" && errorBody.detail.trim()) {
    raw = errorBody.detail.trim();
  } else if (typeof errorBody?.detail === "object" && errorBody.detail !== null) {
    raw = errorBody.detail.message || errorBody.detail.msg || "";
  } else if (typeof errorBody?.message === "string" && errorBody.message.trim()) {
    raw = errorBody.message.trim();
  } else if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
    raw = errorBody.error.trim();
  }

  const cleaned = cleanRawErrorMessage(raw);
  if (cleaned) return cleaned;

  // 4. Standard HTTP status fallbacks
  switch (status) {
    case 400:
      return "The submitted data was invalid or incomplete. Please check your form entries.";
    case 401:
      return "Your login session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested record or resource was not found.";
    case 409:
      return "A conflicting record already exists with these details.";
    case 422:
      return "One or more form fields are invalid. Please check the highlighted inputs.";
    case 429:
      return "Too many requests. Please pause a moment before retrying.";
    case 500:
      return "Internal server error. The server encountered an issue processing this request.";
    case 502:
    case 503:
    case 504:
      return "The backend server is temporarily unavailable or restarting. Please try again shortly.";
    default:
      return status ? `Request failed with status code ${status}.` : "Unable to complete request. Please try again.";
  }
}

/**
 * Low-level HTTP fetch helper with token attachment and error normalization
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = typeof window !== "undefined" ? localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : null;
  
  // Guard against malformed or non-JWT tokens when communicating with live backend servers
  if (token && !isMockData()) {
    if (!isValidJwt(token)) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      }
      token = null;
    }
  }

  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const currentBackend = getActiveBackend();
  const base = getBaseUrl().replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;
  let response!: Response;

  let isNetworkFailure = false;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (netErr: any) {
    isNetworkFailure = true;
  }

  // If backend connection failed, handle gracefully without crashing UI
  if (isNetworkFailure) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ems_backend_offline", {
          detail: {
            endpoint,
            url,
            method: options.method || "GET",
            message: `Python backend server at ${getBaseUrl()} is currently offline.`,
          },
        })
      );
    }

      const isReadOperation = !options.method || options.method.toUpperCase() === "GET";
      if (isReadOperation) {
        console.warn(`[EMS Offline Guard] Safe fallback provided for GET ${endpoint}`);
        // Dual-purpose fallback that acts as an empty Array AND an object with .items and .total
        const fallback: any = [];
        fallback.items = [];
        fallback.total = 0;
        fallback.ok = false;
        fallback.data = [];
        fallback.message = "Backend server is currently offline.";
        return fallback as T;
      }

    const offlineErr = new Error(`Failed to connect to backend server at ${getBaseUrl()}. Is the server running?`);
    (offlineErr as any).isHandled = true;
    (offlineErr as any).isOffline = true;
    throw offlineErr;
  }

  // Handle automatic session refresh if access token expired (HTTP 401)
  if (response.status === 401 && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/auth/refresh")) {
    let refreshed = false;
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN) : null;
    if (refreshToken && isValidJwt(refreshToken)) {
      try {
        const refreshRes = await fetch(`${getBaseUrl()}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken, refreshToken: refreshToken }),
        });
        if (refreshRes.ok) {
          const tokenData = await refreshRes.json();
          const newAccessToken = tokenData.access_token || tokenData.accessToken;
          const newRefreshToken = tokenData.refresh_token || tokenData.refreshToken;
          if (newAccessToken && isValidJwt(newAccessToken) && typeof window !== "undefined") {
            localStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
            if (newRefreshToken && isValidJwt(newRefreshToken)) {
              localStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
            }
            headers.set("Authorization", `Bearer ${newAccessToken}`);
            response = await fetch(url, { ...options, headers });
            if (response.ok) {
              refreshed = true;
            }
          }
        }
      } catch (e) {}
    }

    // If session is unrecoverable (401 and refresh failed or not available)
    if (!refreshed && response.status === 401) {
      if (typeof window !== "undefined") {
        const isIntentional =
          sessionStorage.getItem("ems_intentional_logout") === "true" ||
          sessionStorage.getItem("ems_logged_out") === "true";

        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE);

        // If currently on an authenticated dashboard page, redirect smoothly to login
        if (typeof window.location !== "undefined" && window.location.pathname !== "/login") {
          if (isIntentional) {
            window.location.replace("/login");
          } else {
            window.location.replace("/login?session_expired=true");
          }
          return {} as T;
        }
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const msg = formatUserFacingErrorMessage(errorBody, response.status);

    const err: any = new Error(msg);
    err.status = response.status;
    err.body = errorBody;

    // Parse retry cooldown seconds if rate limited (HTTP 429) or returned in body
    const retryHeader = response.headers?.get ? response.headers.get("Retry-After") : null;
    if (retryHeader && !isNaN(Number(retryHeader))) {
      err.retryAfter = parseInt(retryHeader, 10);
    } else if (errorBody && errorBody.retry_after && !isNaN(Number(errorBody.retry_after))) {
      err.retryAfter = parseInt(errorBody.retry_after, 10);
    } else {
      const waitMatch = msg.match(/wait\s+(\d+)\s+seconds/i);
      if (waitMatch) {
        err.retryAfter = parseInt(waitMatch[1], 10);
      }
    }

    throw err;
  }

  // Support 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ── Project Normalizer ────────────────────────────────────────────────────────
export function normalizeProject(p: any): Project {
  if (!p) return p;
  const headName = p.head_employee_name || p.project_head_name || null;
  const headId = p.head_employee_public_id || p.project_head_public_id || null;
  const membersCount =
    p.members_count !== undefined
      ? p.members_count
      : p.member_count !== undefined
      ? p.member_count
      : p.members
      ? p.members.length
      : 0;

  return {
    ...p,
    project_code: p.project_code || `PRJ-${(p.public_id || "").substring(0, 4).toUpperCase()}`,
    head_employee_name: headName,
    project_head_name: headName,
    head_employee_public_id: headId,
    project_head_public_id: headId,
    members_count: membersCount,
    member_count: membersCount,
    completion_percentage:
      p.completion_percentage !== undefined
        ? p.completion_percentage
        : p.status === "completed"
        ? 100
        : p.status === "active"
        ? 65
        : 20,
  };
}

export function normalizePayrollRun(raw: any): PayrollRun {
  const gross = Number(raw.gross_earnings ?? raw.gross_amount ?? 0);
  const net = Number(raw.net_pay ?? raw.net_paid ?? 0);
  const deductions = Number(raw.total_deductions ?? (gross - net));
  return {
    public_id: String(raw.public_id || ""),
    employee_public_id: String(raw.employee_public_id || ""),
    employee_name: raw.employee_name || (raw.employee ? `${raw.employee.first_name} ${raw.employee.last_name}`.trim() : "Employee"),
    employee_code: raw.employee_code || raw.employee?.employee_code || "",
    department_name: raw.department_name || raw.employee?.department?.dept_name || undefined,
    designation_name: raw.designation_name || raw.designation_title || raw.employee?.designation?.title || undefined,
    pay_period_start: String(raw.pay_period_start || ""),
    pay_period_end: String(raw.pay_period_end || ""),
    gross_earnings: gross,
    total_deductions: deductions,
    net_pay: net,
    payment_status: raw.payment_status || "pending",
    payment_date: raw.payment_date || null,
    payment_reference: raw.payment_reference || raw.transaction_ref || null,
    payment_mode: raw.payment_method || raw.payment_mode || null,
    created_at: raw.created_at,
  };
}

export function normalizePayslip(raw: any): PayslipDetail {
  const gross = Number(raw.gross_earnings ?? raw.gross_amount ?? 0);
  const deductionsAmt = Number(raw.total_deductions ?? 0);
  const net = Number(raw.net_pay ?? raw.net_paid ?? 0);
  const earningsList = (raw.earnings || raw.earnings_breakdown || []).map((e: any) => ({
    label: e.label || e.component_name || "Allowance",
    amount: Number(e.amount || 0),
  }));
  const deductionsList = (raw.deductions || raw.deductions_breakdown || []).map((d: any) => ({
    label: d.label || d.component_name || "Deduction",
    amount: Number(d.amount || 0),
  }));
  return {
    payroll_public_id: raw.payroll_public_id || raw.public_id,
    employee_public_id: raw.employee_public_id || "",
    employee_name: raw.employee_name || "Employee",
    employee_code: raw.employee_code || "",
    department: raw.department || raw.department_name || "General",
    designation: raw.designation || raw.designation_title || "Staff",
    bank_account_masked: raw.bank_account_masked || (raw.bank_name ? `•••• ${raw.bank_name}` : "•••• ••••"),
    pan_masked: raw.pan_masked || "••••••••",
    pay_period: raw.pay_period || `${raw.pay_period_start || ""} to ${raw.pay_period_end || ""}`,
    days_in_month: Number(raw.days_in_period || raw.days_in_month || 30),
    days_worked: Number(raw.days_present || raw.days_worked || 30),
    earnings: earningsList,
    deductions: deductionsList,
    gross_earnings: gross,
    total_deductions: deductionsAmt,
    net_pay: net,
    net_pay_words: raw.net_pay_words || `Rupees ${net.toLocaleString("en-IN")} Only`,
    disbursed_on: raw.disbursed_on || raw.payment_date || null,
    transaction_ref: raw.transaction_ref || null,
  };
}

export function normalizeLeaveType(raw: any): LeaveType {
  const name = raw.type_name || raw.name || "Leave Type";
  const quota = Number(raw.annual_quota ?? raw.max_days_per_year ?? raw.maxDaysPerYear ?? 0);
  const code = raw.type_code || raw.code || (name ? name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) : "LV");
  return {
    public_id: String(raw.public_id || raw.publicId || ""),
    type_name: name,
    name: name,
    type_code: code,
    annual_quota: quota,
    max_days_per_year: quota,
    is_carry_forward: Boolean(raw.is_carry_forward ?? raw.isCarryForward ?? false),
    is_paid: Boolean(raw.is_paid ?? raw.isPaid ?? true),
    description: raw.description || "",
  };
}

export function normalizeLeaveBalance(raw: any): LeaveBalance {
  const allocated = Number(raw.allocated_days ?? raw.total_allocated ?? raw.totalAllocated ?? 0);
  const used = Number(raw.used_days ?? raw.used_leaves ?? raw.usedLeaves ?? 0);
  const remaining = Number(raw.remaining_days ?? raw.remaining_leaves ?? raw.remainingLeaves ?? (allocated - used));
  const leaveTypeName = raw.leave_type_name || raw.leaveTypeName || raw.name || "Leave";
  const typeCode = raw.type_code || raw.code || (leaveTypeName ? leaveTypeName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) : "LV");

  return {
    balance_id: Number(raw.balance_id ?? raw.id ?? Math.floor(Math.random() * 10000)),
    employee_public_id: String(raw.employee_public_id || raw.employeePublicId || ""),
    leave_type_public_id: String(raw.leave_type_public_id || raw.leaveTypePublicId || ""),
    leave_type_name: leaveTypeName,
    type_code: typeCode,
    year: Number(raw.year ?? new Date().getFullYear()),
    allocated_days: allocated,
    used_days: used,
    pending_days: Number(raw.pending_days ?? 0),
    remaining_days: remaining,
    total_allocated: allocated,
    used_leaves: used,
    remaining_leaves: remaining,
  };
}

/**
 * Universal API Gateway covering 100% of Backend API Endpoints
 */
export const api = {
  // ── 1. Authentication & RBAC (`/auth/*`) ─────────────────────────────────────
  auth: {
    sendOtp: async (payload: SendOtpIn): Promise<SendOtpOut> => {
      if (isMockData()) {
        return {
          ok: true,
          message: `6-digit verification OTP dispatched to ${payload.email}. Valid for 5 minutes.`,
          retry_after: 150,
          expires_in_seconds: 300,
        };
      }
      return request<SendOtpOut>("/auth/send-otp", { method: "POST", body: JSON.stringify(payload) });
    },

    signup: async (payload: UserSignupIn) => {
      if (isMockData()) {
        const createdUser: UserProfile = {
          public_id: `usr-${Date.now().toString().slice(-4)}`,
          email: payload.email,
          display_name: payload.display_name,
          is_active: true,
          is_verified: true,
          employee_public_id: null,
          roles: [],
          permissions: [],
        };
        return {
          ok: true,
          message: "Account registered successfully.",
          user: createdUser,
          tokens: {
            access_token: createMockJwt(createdUser.public_id, "Employee"),
            refresh_token: createMockJwt(createdUser.public_id, "Employee"),
            token_type: "bearer",
          },
        };
      }
      const body = {
        email: payload.email,
        display_name: payload.display_name,
        password: payload.password,
        otp: (payload.otp || payload.otp_code || "").trim(),
      };
      const res = await request<any>("/auth/signup", { method: "POST", body: JSON.stringify(body) });
      const accessToken = res.tokens?.access_token || res.tokens?.accessToken || res.access_token || res.accessToken;
      const refreshToken = res.tokens?.refresh_token || res.tokens?.refreshToken || res.refresh_token || res.refreshToken;
      if (accessToken && typeof window !== "undefined") {
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, accessToken);
        if (refreshToken) localStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }
      return res;
    },

    login: async (payload: { email: string; password?: string }) => {
      if (isMockData()) {
        const user = Object.values(MOCK_USERS_BY_ROLE).find((u) => u.email.toLowerCase() === payload.email.toLowerCase()) || MOCK_USERS_BY_ROLE.Admin;
        const mockRole = user.roles[0]?.role_name || "Admin";
        return {
          ok: true,
          tokens: {
            access_token: createMockJwt(user.public_id, mockRole),
            refresh_token: createMockJwt(user.public_id, mockRole),
            token_type: "bearer",
          },
          user,
        };
      }

      const res = await request<any>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
      const accessToken = res.tokens?.access_token || res.tokens?.accessToken || res.access_token || res.accessToken;
      const refreshToken = res.tokens?.refresh_token || res.tokens?.refreshToken || res.refresh_token || res.refreshToken;

      if (accessToken && typeof window !== "undefined") {
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, accessToken);
        if (refreshToken) localStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      }

      return {
        ok: true,
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "bearer",
        },
        user: res.user,
        roles: res.roles || res.user?.roles || [],
        permissions: res.permissions || res.user?.permissions || [],
      };
    },

    forgotPassword: async (payload: ForgotPasswordIn): Promise<SendOtpOut> => {
      if (isMockData()) {
        return {
          ok: true,
          message: `Password reset OTP sent to ${payload.email}. (Cooldown: 150s)`,
          retry_after: 150,
          expires_in_seconds: 300,
        };
      }
      return request<SendOtpOut>("/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) });
    },

    resetPassword: async (payload: ResetPasswordIn) => {
      if (isMockData()) {
        return { ok: true, message: "Password has been successfully reset." };
      }
      const body = {
        email: payload.email,
        otp: payload.otp || payload.otp_code,
        new_password: payload.new_password,
      };
      return request<any>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) });
    },

    changePassword: async (payload: ChangePasswordIn) => {
      if (isMockData()) {
        return { ok: true, message: "Your corporate password was changed successfully." };
      }
      const body = {
        current_password: payload.current_password || payload.old_password,
        new_password: payload.new_password,
      };
      return request<any>("/auth/change-password", { method: "POST", body: JSON.stringify(body) });
    },

    refreshToken: async (refreshToken: string) => {
      if (isMockData()) {
        return { access_token: "mock-refreshed-jwt-token", token_type: "bearer" };
      }
      return request<any>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken, refreshToken: refreshToken }),
      });
    },

    getMe: async (): Promise<UserProfile> => {
      if (isMockData()) {
        return getActiveUser();
      }
      return request<UserProfile>("/auth/me");
    },

    listRoles: async (): Promise<Role[]> => {
      if (isMockData()) {
        return Object.values(MOCK_USERS_BY_ROLE).map((u) => u.roles[0]);
      }
      const roles = await request<any[]>("/auth/roles");
      return Array.isArray(roles) ? roles : [];
    },

    listRolesDetailed: async (): Promise<RoleDetail[]> => {
      if (isMockData()) {
        return mockData.MOCK_ROLES;
      }
      const roles = await request<any[]>("/auth/roles");
      return Array.isArray(roles) ? roles : [];
    },

    getRole: async (identifier: string): Promise<RoleDetail> => {
      if (isMockData()) {
        const r = mockData.MOCK_ROLES.find((x) => x.public_id === identifier || x.role_name === identifier);
        if (!r) throw new Error("Role not found");
        return r;
      }
      return request<RoleDetail>(`/auth/roles/${identifier}`);
    },

    createRole: async (payload: RoleCreateIn): Promise<RoleDetail> => {
      if (isMockData()) {
        const created: RoleDetail = {
          public_id: `role-${Date.now()}`,
          role_name: payload.role_name.trim().replace(/\s+/g, "_"),
          description: payload.description || "Custom enterprise role",
          permissions: payload.permissions || payload.permission_names || [],
          user_count: 0,
          is_system: false,
        };
        mockData.MOCK_ROLES.push(created);
        return created;
      }
      const body = {
        role_name: payload.role_name,
        description: payload.description,
        permission_names: payload.permission_names || payload.permissions || [],
      };
      return request<RoleDetail>("/auth/roles", { method: "POST", body: JSON.stringify(body) });
    },

    updateRole: async (identifier: string, payload: RoleUpdateIn): Promise<RoleDetail> => {
      if (isMockData()) {
        const found = mockData.MOCK_ROLES.find((r) => r.public_id === identifier || r.role_name === identifier);
        if (!found) throw new Error("Role not found");
        if (payload.role_name) found.role_name = payload.role_name;
        if (payload.description) found.description = payload.description;
        if (payload.permissions) found.permissions = payload.permissions;
        return found;
      }
      const body = {
        role_name: payload.role_name,
        description: payload.description,
        permission_names: payload.permission_names || payload.permissions || [],
      };
      return request<RoleDetail>(`/auth/roles/${identifier}`, { method: "PUT", body: JSON.stringify(body) });
    },

    addPermissionsToRole: async (identifier: string, permissionNames: string[]): Promise<RoleDetail> => {
      if (isMockData()) {
        const found = mockData.MOCK_ROLES.find((r) => r.public_id === identifier || r.role_name === identifier);
        if (!found) throw new Error("Role not found");
        found.permissions = Array.from(new Set([...found.permissions, ...permissionNames]));
        return found;
      }
      return request<RoleDetail>(`/auth/roles/${identifier}/permissions`, {
        method: "POST",
        body: JSON.stringify({ permission_names: permissionNames }),
      });
    },

    revokePermissionFromRole: async (identifier: string, permissionName: string): Promise<RoleDetail> => {
      if (isMockData()) {
        const found = mockData.MOCK_ROLES.find((r) => r.public_id === identifier || r.role_name === identifier);
        if (!found) throw new Error("Role not found");
        found.permissions = found.permissions.filter((p) => p !== permissionName);
        return found;
      }
      return request<RoleDetail>(`/auth/roles/${identifier}/permissions/${permissionName}`, { method: "DELETE" });
    },

    deleteRole: async (identifier: string): Promise<{ message: string }> => {
      if (isMockData()) {
        const idx = mockData.MOCK_ROLES.findIndex((r) => r.public_id === identifier || r.role_name === identifier);
        if (idx !== -1) {
          if (mockData.MOCK_ROLES[idx].is_system) throw new Error("Cannot delete built-in system role");
          mockData.MOCK_ROLES.splice(idx, 1);
        }
        return { message: "Role deleted successfully." };
      }
      return request<{ message: string }>(`/auth/roles/${identifier}`, { method: "DELETE" });
    },

    listPermissions: async (): Promise<Permission[]> => {
      if (isMockData()) {
        return mockData.MOCK_PERMISSIONS;
      }
      const perms = await request<any[]>("/auth/permissions");
      return Array.isArray(perms) ? perms : [];
    },

    listPendingUsers: async (): Promise<UserProfile[]> => {
      if (isMockData()) {
        return mockData.MOCK_PENDING_USERS;
      }
      const users = await request<any[]>("/auth/pending-users");
      return Array.isArray(users) ? users.map(normalizeUserProfile) : [];
    },

    listUsers: async (): Promise<UserProfile[]> => {
      if (isMockData()) {
        return mockData.MOCK_ALL_USERS;
      }
      const users = await request<any[]>("/auth/users");
      return Array.isArray(users) ? users.map(normalizeUserProfile) : [];
    },

    assignUserRoles: async (userPublicId: string, roleNames: string[]) => {
      if (isMockData()) {
        const found = mockData.MOCK_ALL_USERS.find((u) => u.public_id === userPublicId);
        if (found) {
          found.roles = roleNames.map((rn, idx) => ({
            role_id: idx + 10,
            role_name: rn as any,
            description: `Assigned as ${rn}`,
            permissions: [],
          }));
        }
        return { ok: true, message: `Roles [${roleNames.join(", ")}] assigned successfully.` };
      }
      return request<any>(`/auth/users/${userPublicId}/roles`, {
        method: "POST",
        body: JSON.stringify({ role_names: roleNames }),
      });
    },

    revokeUserRole: async (userPublicId: string, roleName: string) => {
      if (isMockData()) {
        const found = mockData.MOCK_ALL_USERS.find((u) => u.public_id === userPublicId);
        if (found) {
          found.roles = found.roles.filter((r) => r.role_name !== roleName);
        }
        return { ok: true, message: `Role ${roleName} revoked successfully.` };
      }
      return request<any>(`/auth/users/${userPublicId}/roles/${roleName}`, {
        method: "DELETE",
      });
    },

    rejectUser: async (userPublicId: string) => {
      if (isMockData()) {
        const pIdx = mockData.MOCK_PENDING_USERS.findIndex((u) => u.public_id === userPublicId);
        if (pIdx !== -1) mockData.MOCK_PENDING_USERS.splice(pIdx, 1);
        const aIdx = mockData.MOCK_ALL_USERS.findIndex((u) => u.public_id === userPublicId);
        if (aIdx !== -1) mockData.MOCK_ALL_USERS.splice(aIdx, 1);
        return { ok: true, message: "User registration rejected." };
      }
      return request<any>(`/auth/users/${userPublicId}/reject`, {
        method: "POST",
      });
    },

    updateUserAccess: async (
      userPublicId: string,
      payload: {
        roles?: string[];
        custom_permissions?: string[];
        revoked_permissions?: string[];
        is_active?: boolean;
      }
    ) => {
      if (isMockData()) {
        const found = mockData.MOCK_ALL_USERS.find((u) => u.public_id === userPublicId);
        if (found) {
          if (payload.roles !== undefined) {
            found.roles = payload.roles.map((rn, idx) => ({
              role_id: idx + 10,
              role_name: rn as any,
              description: `Assigned as ${rn}`,
              permissions: [],
            }));
          }
          if (payload.custom_permissions !== undefined) found.custom_permissions = payload.custom_permissions;
          if (payload.revoked_permissions !== undefined) found.revoked_permissions = payload.revoked_permissions;
          if (payload.is_active !== undefined) found.is_active = payload.is_active;
        }
        return { ok: true, message: "User access updated" };
      }
      if (payload.roles && payload.roles.length > 0) {
        await api.auth.assignUserRoles(userPublicId, payload.roles);
      }
      return request<any>(`/auth/users/${userPublicId}/access`, {
        method: "PUT",
        body: JSON.stringify({
          roles: payload.roles,
          custom_permissions: payload.custom_permissions,
          revoked_permissions: payload.revoked_permissions,
          is_active: payload.is_active,
        }),
      });
    },
  },

  // ── 2. Employees Module (`/employees/*`) ─────────────────────────────────────
  employees: {
    list: async (params: EmployeeFilterParams = {}): Promise<Paginated<Employee>> => {
      return api.employees.search(params);
    },

    search: async (params: EmployeeFilterParams = {}): Promise<Paginated<Employee>> => {
      const user = getActiveUser();
      const role = getActiveRole();
      const hasPerm = hasPermission("employee:read") || hasPermission("employee:view") || role === "Admin" || role === "HR_Manager";

      if (isMockData()) {
        let items = [...mockData.MOCK_EMPLOYEES];
        if (!hasPerm) {
          items = items.filter((e) => e.public_id === user.employee_public_id);
        } else {
          if (params.search) {
            const q = params.search.toLowerCase();
            items = items.filter(
              (e) =>
                e.first_name.toLowerCase().includes(q) ||
                e.last_name.toLowerCase().includes(q) ||
                e.email.toLowerCase().includes(q) ||
                e.employee_code.toLowerCase().includes(q)
            );
          }
          if (params.department_public_id) {
            items = items.filter((e) => e.department_public_id === params.department_public_id);
          }
          if (params.employee_status) {
            items = items.filter((e) => e.employee_status.toLowerCase() === params.employee_status?.toLowerCase());
          }
        }
        const skip = params.skip || 0;
        const limit = params.limit || 20;
        return { items: items.slice(skip, skip + limit), total: items.length, skip, limit };
      }

      // Build backend-compatible query params
      const qParams: Record<string, string> = {};
      if (params.skip !== undefined) qParams.skip = String(params.skip);
      if (params.limit !== undefined) qParams.limit = String(params.limit);
      if (params.department_public_id) qParams.department_public_id = params.department_public_id;
      if (params.designation_public_id) qParams.designation_public_id = params.designation_public_id;
      if (params.employee_status) qParams.employee_status = params.employee_status.toLowerCase();
      if (params.employment_type) qParams.employment_type = params.employment_type.toLowerCase();
      if (params.gender) qParams.gender = params.gender.toLowerCase();

      // Search mapping
      if (params.search) {
        const s = params.search.trim();
        if (s.includes("@")) {
          qParams.email = s;
        } else if (s.toUpperCase().startsWith("EMP-")) {
          qParams.employee_code = s;
        } else {
          qParams.first_name = s;
        }
      }
      if (params.first_name) qParams.first_name = params.first_name;
      if (params.last_name) qParams.last_name = params.last_name;
      if (params.email) qParams.email = params.email;
      if (params.employee_code) qParams.employee_code = params.employee_code;

      const queryStr = new URLSearchParams(qParams).toString();
      const res = await request<any>(`/employees/search?${queryStr}`);
      return {
        items: res.items || [],
        total: res.total || (res.items ? res.items.length : 0),
        skip: res.skip || 0,
        limit: res.limit || 20,
      };
    },

    getById: async (publicId: string): Promise<Employee> => {
      if (isMockData()) {
        const found = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === publicId);
        if (!found) throw new Error("Employee record not found");
        return found;
      }
      const res = await request<any>(`/employees/search?public_id=${publicId}`);
      if (res && res.items && res.items.length > 0) return res.items[0];
      const fallbackEmp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === publicId);
      if (fallbackEmp) return fallbackEmp;
      return (res && typeof res === "object" && !Array.isArray(res) && res.public_id ? res : ({} as any));
    },

    getMe: async (): Promise<Employee> => {
      if (isMockData()) {
        const user = getActiveUser();
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === user.employee_public_id) || mockData.MOCK_EMPLOYEES[0];
        return emp;
      }
      return request<Employee>("/employees/me");
    },

    create: async (payload: Partial<Employee>): Promise<Employee> => {
      if (isMockData()) {
        const empId = `emp-${Date.now().toString().slice(-4)}`;
        const created: Employee = {
          public_id: empId,
          employee_code: payload.employee_code || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          first_name: payload.first_name || "New",
          last_name: payload.last_name || "Employee",
          email: payload.email || `employee.${Date.now()}@company.in`,
          phone_number: payload.phone_number || payload.phone || "+91 98000 00000",
          gender: (payload.gender || "Male") as any,
          joining_date: payload.joining_date || new Date().toISOString().split("T")[0],
          employment_type: (payload.employment_type || "Full_Time") as any,
          employee_status: "Active",
          department_public_id: payload.department_public_id,
          designation_public_id: payload.designation_public_id,
          reporting_manager_public_id: payload.reporting_manager_public_id,
          addresses: [],
        };
        mockData.MOCK_EMPLOYEES.unshift(created);
        return created;
      }

      const body = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone || payload.phone_number,
        date_of_birth: payload.date_of_birth || "1995-05-15",
        gender: payload.gender ? payload.gender.toLowerCase() : "male",
        joining_date: payload.joining_date || new Date().toISOString().split("T")[0],
        employee_status: (payload.employee_status || "active").toLowerCase(),
        employment_type: (payload.employment_type || "full_time").toLowerCase(),
        department_public_id: payload.department_public_id,
        designation_public_id: payload.designation_public_id,
        reporting_manager_public_id: payload.reporting_manager_public_id,
        employee_code: payload.employee_code,
      };
      return request<Employee>("/employees", { method: "POST", body: JSON.stringify(body) });
    },

    updateMe: async (payload: Partial<Employee> & { addresses?: any[]; emergency_contacts?: any[] }): Promise<Employee> => {
      if (isMockData()) {
        const user = getActiveUser();
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === user.employee_public_id) || mockData.MOCK_EMPLOYEES[0];
        Object.assign(emp, payload);
        return emp;
      }
      const body: any = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone || payload.phone_number,
        gender: payload.gender ? payload.gender.toLowerCase() : undefined,
        date_of_birth: payload.date_of_birth,
      };
      if (payload.addresses !== undefined) {
        body.addresses = payload.addresses;
      }
      if (payload.emergency_contacts !== undefined) {
        body.emergency_contacts = payload.emergency_contacts;
      }
      return request<Employee>("/employees/me", { method: "PUT", body: JSON.stringify(body) });
    },

    update: async (publicId: string, payload: Partial<Employee>): Promise<Employee> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === publicId);
        if (!emp) throw new Error("Employee not found");
        Object.assign(emp, payload);
        return emp;
      }
      const body = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone || payload.phone_number,
        date_of_birth: payload.date_of_birth,
        gender: payload.gender ? payload.gender.toLowerCase() : undefined,
        employee_status: payload.employee_status ? payload.employee_status.toLowerCase() : undefined,
        employment_type: payload.employment_type ? payload.employment_type.toLowerCase() : undefined,
        department_public_id: payload.department_public_id,
        designation_public_id: payload.designation_public_id,
        reporting_manager_public_id: payload.reporting_manager_public_id,
      };
      return request<Employee>(`/employees/${publicId}`, { method: "PUT", body: JSON.stringify(body) });
    },

    toggleStatus: async (publicId: string, status: string): Promise<Employee> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === publicId);
        if (!emp) throw new Error("Employee not found");
        emp.employee_status = status as any;
        return emp;
      }
      const existing = await api.employees.getById(publicId);
      return api.employees.update(publicId, {
        ...existing,
        employee_status: status.toLowerCase(),
      });
    },

    adminSetup: async (publicId: string, payload: any) => {
      if (isMockData()) {
        return { ok: true, message: "Employee admin setup completed" };
      }
      return request<any>(`/employees/${publicId}/admin-setup`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },

    onboardPendingUser: async (payload: {
      user_public_id: string;
      role_name: string;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      department_public_id: string;
      department_name?: string;
      designation_public_id?: string;
      designation_name?: string;
      reporting_manager_public_id?: string | null;
      joining_date: string;
      employment_type: string;
      basic_salary: number;
      hra?: number;
      conveyance?: number;
      special_allowance?: number;
      bank_name?: string;
      account_number?: string;
      routing_code?: string;
      ifsc_code?: string;
    }) => {
      if (isMockData()) {
        const empId = `emp-${Date.now().toString().slice(-4)}`;
        const createdEmp: Employee = {
          public_id: empId,
          user_public_id: payload.user_public_id,
          employee_code: payload.employee_code,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone_number: "+91 98000 12345",
          gender: "Male",
          joining_date: payload.joining_date,
          employment_type: payload.employment_type as any,
          employee_status: "Active",
          department_public_id: payload.department_public_id,
          designation_public_id: payload.designation_public_id,
          reporting_manager_public_id: payload.reporting_manager_public_id || null,
          addresses: [],
        };
        mockData.MOCK_EMPLOYEES.unshift(createdEmp);
        return createdEmp;
      }

      // Assign role to user
      const userProfile = await api.auth.assignUserRoles(payload.user_public_id, [payload.role_name]);
      const empPublicId = userProfile?.employee_public_id || payload.user_public_id;

      // Configure employee corporate and financial data
      await api.employees.adminSetup(empPublicId, {
        department_public_id: payload.department_public_id,
        designation_public_id: payload.designation_public_id,
        reporting_manager_public_id: payload.reporting_manager_public_id || undefined,
        joining_date: payload.joining_date,
        employment_type: (payload.employment_type || "full_time").toLowerCase(),
        employee_code: payload.employee_code,
        first_name: payload.first_name,
        last_name: payload.last_name,
        bank_name: payload.bank_name || undefined,
        account_number: payload.account_number || undefined,
        routing_code: payload.routing_code || payload.ifsc_code || undefined,
        basic_salary: Number(payload.basic_salary) || undefined,
        hra: Number(payload.hra) || undefined,
        conveyance: Number(payload.conveyance) || undefined,
        special_allowance: Number(payload.special_allowance) || undefined,
      });

      return api.employees.getById(empPublicId);
    },

    delete: async (publicId: string) => {
      if (isMockData()) {
        const idx = mockData.MOCK_EMPLOYEES.findIndex((e) => e.public_id === publicId);
        if (idx !== -1) mockData.MOCK_EMPLOYEES.splice(idx, 1);
        return { ok: true, message: "Employee offboarded successfully" };
      }
      return request<any>(`/employees/${publicId}`, { method: "DELETE" });
    },

    // ── Address Sub-resources
    getAddresses: async (employeePublicId: string): Promise<Address[]> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        return emp?.addresses || [];
      }
      const res = await request<Address[]>(`/employees/${employeePublicId}/addresses`);
      return Array.isArray(res) ? res : [];
    },

    addAddress: async (employeePublicId: string, address: Partial<Address>): Promise<Address> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        const newAddr: Address = {
          public_id: `addr-${Date.now()}`,
          address_public_id: `addr-${Date.now()}`,
          address_type: address.address_type || "current",
          street_address: address.street_address || "",
          city: address.city || "Bengaluru",
          state: address.state || "Karnataka",
          pincode: address.pincode || address.postal_code || "560001",
          postal_code: address.pincode || address.postal_code || "560001",
          country: address.country || "India",
          is_primary: address.is_primary ?? true,
        };
        emp?.addresses?.push(newAddr);
        return newAddr;
      }
      const body = {
        street_address: address.street_address,
        city: address.city,
        state: address.state,
        country: address.country || "India",
        pincode: address.pincode || address.postal_code || "560001",
        address_type: (address.address_type || "current").toLowerCase(),
        is_primary: address.is_primary ?? true,
      };
      return request<Address>(`/employees/${employeePublicId}/addresses`, { method: "POST", body: JSON.stringify(body) });
    },

    deleteAddress: async (employeePublicId: string, addressPublicId: string) => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        if (emp) emp.addresses = emp.addresses?.filter((a) => a.public_id !== addressPublicId && a.address_public_id !== addressPublicId);
        return { ok: true };
      }
      return request<any>(`/employees/${employeePublicId}/addresses/${addressPublicId}`, { method: "DELETE" });
    },

    // ── Emergency Contacts Sub-resources
    getEmergencyContacts: async (employeePublicId: string): Promise<EmergencyContact[]> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        return emp?.emergency_contacts || [];
      }
      const res = await request<EmergencyContact[]>(`/employees/${employeePublicId}/emergency-contacts`);
      return Array.isArray(res) ? res : [];
    },

    addEmergencyContact: async (employeePublicId: string, contact: Partial<EmergencyContact>): Promise<EmergencyContact> => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        const newC: EmergencyContact = {
          contact_id: Date.now(),
          contact_name: contact.contact_name || "Contact",
          relationship: contact.relationship || "Spouse",
          phone: contact.phone || contact.phone_number || "+91 98000 00000",
          phone_number: contact.phone || contact.phone_number || "+91 98000 00000",
          email: contact.email,
          is_primary: contact.is_primary ?? true,
        };
        emp?.emergency_contacts?.push(newC);
        return newC;
      }
      const body = {
        contact_name: contact.contact_name,
        relationship: contact.relationship,
        phone: contact.phone || contact.phone_number,
        email: contact.email,
        is_primary: contact.is_primary ?? true,
      };
      return request<EmergencyContact>(`/employees/${employeePublicId}/emergency-contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    deleteEmergencyContact: async (employeePublicId: string, contactId: number) => {
      if (isMockData()) {
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === employeePublicId);
        if (emp) emp.emergency_contacts = emp.emergency_contacts?.filter((c) => c.contact_id !== contactId);
        return { ok: true };
      }
      return request<any>(`/employees/${employeePublicId}/emergency-contacts/${contactId}`, { method: "DELETE" });
    },
  },

  // ── 3. Bank Details (`/bank-details/*`) ───────────────────────────────────────
  bankDetails: {
    getByEmployee: async (employeePublicId: string): Promise<BankDetail | null> => {
      if (isMockData()) {
        const found = mockData.MOCK_BANK_DETAILS.find((b) => b.employee_public_id === employeePublicId);
        return found || null;
      }
      const res = await request<any>(`/bank-details/${employeePublicId}`);
      if (Array.isArray(res)) {
        return res.find((b: any) => b.is_primary) || res[0] || null;
      }
      return res || null;
    },

    getMyBankDetails: async (): Promise<BankDetail[]> => {
      if (isMockData()) {
        return mockData.MOCK_BANK_DETAILS.slice(0, 1);
      }
      return request<BankDetail[]>("/bank-details/me");
    },

    create: async (payload: Partial<BankDetail>): Promise<BankDetail> => {
      if (isMockData()) {
        const newBank: BankDetail = {
          public_id: `bnk-${Date.now()}`,
          employee_public_id: payload.employee_public_id || "emp-mock",
          bank_name: payload.bank_name || "Primary Bank",
          account_number: payload.account_number || "0000000000",
          routing_code: payload.routing_code || payload.ifsc_code || "BANK0001",
          branch_name: payload.branch_name || "Main Branch",
          account_type: payload.account_type || "savings",
          is_primary: payload.is_primary ?? true,
        };
        mockData.MOCK_BANK_DETAILS.push(newBank);
        return newBank;
      }
      return request<BankDetail>("/bank-details", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    update: async (publicId: string, payload: Partial<BankDetail>): Promise<BankDetail> => {
      if (isMockData()) {
        const item = mockData.MOCK_BANK_DETAILS.find((b) => b.public_id === publicId);
        if (item) Object.assign(item, payload);
        return item || mockData.MOCK_BANK_DETAILS[0];
      }
      return request<BankDetail>(`/bank-details/${publicId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },

    delete: async (publicId: string): Promise<any> => {
      if (isMockData()) {
        const idx = mockData.MOCK_BANK_DETAILS.findIndex((b) => b.public_id === publicId);
        if (idx >= 0) mockData.MOCK_BANK_DETAILS.splice(idx, 1);
        return { ok: true };
      }
      return request<any>(`/bank-details/${publicId}`, { method: "DELETE" });
    },
  },

  // ── 4. Compensation & Salaries (`/salaries/*`) ────────────────────────────────
  salaries: {
    listAll: async (): Promise<SalaryStructure[]> => {
      if (isMockData()) {
        return [...mockData.MOCK_SALARY_STRUCTURES];
      }
      const res = await request<any>("/salaries");
      return Array.isArray(res) ? res : [];
    },

    getEmployeeSalaries: async (employeePublicId: string): Promise<SalaryStructure> => {
      if (isMockData()) {
        const found = mockData.MOCK_SALARY_STRUCTURES.find((s) => s.employee_public_id === employeePublicId);
        if (found) return found;
        return {
          public_id: `sal-mock-${employeePublicId}`,
          employee_public_id: employeePublicId,
          basic_salary: 50000,
          gross_salary: 75000,
          net_salary: 68000,
          currency: "INR",
          effective_from: new Date().toISOString().split("T")[0],
          components: [
            { component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: 20000 },
            { component_name: "Special Allowance", component_type: "earning", amount: 5000 },
            { component_name: "Provident Fund (PF)", component_type: "deduction", amount: 6000 },
            { component_name: "Professional Tax", component_type: "deduction", amount: 1000 },
          ],
        };
      }
      const res = await request<any>(`/salaries/${employeePublicId}`);
      if (res && res.active_salary) {
        return {
          ...res.active_salary,
          employee_name: res.employee_name,
          employee_code: res.employee_code,
        };
      }
      return res;
    },

    getMySalaries: async (): Promise<SalaryStructure> => {
      if (isMockData()) {
        return mockData.MOCK_SALARY_STRUCTURES[0];
      }
      const res = await request<any>("/salaries/me");
      if (res && res.active_salary) {
        return {
          ...res.active_salary,
          employee_name: res.employee_name,
          employee_code: res.employee_code,
        };
      }
      return res;
    },

    createRevision: async (payload: {
      employee_public_id: string;
      basic_salary: number;
      currency?: string;
      effective_from: string;
      components?: { component_name: string; component_type: "earning" | "deduction"; amount: number }[];
    }): Promise<SalaryStructure> => {
      if (isMockData()) {
        const earnings = (payload.components || []).filter((c) => c.component_type === "earning").reduce((sum, c) => sum + Number(c.amount || 0), 0);
        const deductions = (payload.components || []).filter((c) => c.component_type === "deduction").reduce((sum, c) => sum + Number(c.amount || 0), 0);
        const net = Number(payload.basic_salary || 0) + earnings - deductions;
        const newSal: SalaryStructure = {
          public_id: `sal-${Date.now()}`,
          employee_public_id: payload.employee_public_id,
          basic_salary: Number(payload.basic_salary || 0),
          net_salary: net,
          gross_salary: Number(payload.basic_salary || 0) + earnings,
          currency: payload.currency || "INR",
          effective_from: payload.effective_from || new Date().toISOString().split("T")[0],
          effective_to: null,
          components: payload.components || [],
        };
        const idx = mockData.MOCK_SALARY_STRUCTURES.findIndex((s) => s.employee_public_id === payload.employee_public_id);
        if (idx >= 0) {
          mockData.MOCK_SALARY_STRUCTURES[idx] = newSal;
        } else {
          mockData.MOCK_SALARY_STRUCTURES.push(newSal);
        }
        return newSal;
      }
      return request<SalaryStructure>("/salaries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    updateRevision: async (publicId: string, payload: any): Promise<SalaryStructure> => {
      if (isMockData()) {
        const item = mockData.MOCK_SALARY_STRUCTURES.find((s) => s.public_id === publicId);
        if (item) {
          Object.assign(item, payload);
          return item;
        }
        return mockData.MOCK_SALARY_STRUCTURES[0];
      }
      return request<SalaryStructure>(`/salaries/${publicId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },

    deleteRevision: async (publicId: string): Promise<any> => {
      if (isMockData()) {
        const idx = mockData.MOCK_SALARY_STRUCTURES.findIndex((s) => s.public_id === publicId);
        if (idx >= 0) mockData.MOCK_SALARY_STRUCTURES.splice(idx, 1);
        return { ok: true };
      }
      return request<any>(`/salaries/${publicId}`, { method: "DELETE" });
    },
  },

  // ── 5. Documents Module (`/documents/*`) ─────────────────────────────────────
  documents: {
    listByEmployee: async (employeePublicId: string): Promise<DocumentRecord[]> => {
      if (isMockData()) {
        return mockData.MOCK_DOCUMENTS.filter((d) => d.employee_public_id === employeePublicId);
      }
      const docs = await request<DocumentRecord[]>(`/documents/employee/${employeePublicId}`);
      return Array.isArray(docs) ? docs : [];
    },

    list: async (employeePublicId: string): Promise<DocumentRecord[]> => {
      return api.documents.listByEmployee(employeePublicId);
    },

    listPending: async (): Promise<DocumentRecord[]> => {
      if (isMockData()) {
        return mockData.MOCK_DOCUMENTS.filter(
          (d) => !d.status || d.status === "Pending_Verification" || d.status.toLowerCase().includes("pending")
        );
      }
      const docs = await request<DocumentRecord[]>("/documents/pending");
      return Array.isArray(docs) ? docs : [];
    },

    upload: async (payload: DocumentUploadPayload): Promise<DocumentRecord> => {
      if (isMockData()) {
        const newDoc: DocumentRecord = {
          public_id: `doc-${Date.now().toString().slice(-4)}`,
          employee_public_id: payload.employee_public_id,
          employee_name: "Employee",
          document_name: payload.document_name,
          document_type: payload.document_type,
          document_url: `/uploads/${payload.document_name}.pdf`,
          file_size_bytes: 1024000,
          mime_type: "application/pdf",
          status: "Pending_Verification",
          created_at: new Date().toISOString(),
        };
        mockData.MOCK_DOCUMENTS.unshift(newDoc);
        return newDoc;
      }

      const formData = new FormData();
      formData.append("employee_public_id", payload.employee_public_id);
      formData.append("document_type", payload.document_type);
      if (payload.document_name) {
        formData.append("document_name", payload.document_name);
      }
      if (payload.file) {
        formData.append("file", payload.file);
      }

      return request<DocumentRecord>("/documents/upload", { method: "POST", body: formData });
    },

    getViewUrl: (publicId: string): string => {
      const token = typeof window !== "undefined" ? localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : null;
      const base = getBaseUrl();
      return `${base}/documents/${publicId}/view${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    },

    getDownloadUrl: (publicId: string): string => {
      const token = typeof window !== "undefined" ? localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : null;
      const base = getBaseUrl();
      return `${base}/documents/${publicId}/download${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    },

    download: async (publicId: string, filename?: string) => {
      if (isMockData()) {
        showToast.info("Mock download completed successfully.");
        return;
      }
      const token = typeof window !== "undefined" ? localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : null;
      const url = `${getBaseUrl()}/documents/${publicId}/download`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to download document (${res.status})`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename || `document-${publicId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    },

    verify: async (publicId: string, payload: DocumentVerifyPayload): Promise<DocumentRecord> => {
      if (isMockData()) {
        const doc = mockData.MOCK_DOCUMENTS.find((d) => d.public_id === publicId);
        if (!doc) throw new Error("Document not found");
        doc.status = payload.status;
        doc.verification_notes = payload.verification_notes;
        return doc;
      }
      return request<DocumentRecord>(`/documents/${publicId}/verify`, { method: "POST", body: JSON.stringify(payload) });
    },

    delete: async (publicId: string) => {
      if (isMockData()) {
        const idx = mockData.MOCK_DOCUMENTS.findIndex((d) => d.public_id === publicId);
        if (idx !== -1) mockData.MOCK_DOCUMENTS.splice(idx, 1);
        return { ok: true };
      }
      return request<any>(`/documents/${publicId}`, { method: "DELETE" });
    },
  },

  // ── 6. Departments & Designations (`/departments/*`, `/designations/*`) ──────
  departments: {
    list: async (): Promise<Department[]> => {
      if (isMockData()) return mockData.MOCK_DEPARTMENTS;
      const res = await request<any>("/departments");
      const list = Array.isArray(res) ? res : res.items || [];
      return list.map((d: any) => ({
        public_id: d.public_id || d.id || "",
        department_name: d.dept_name || d.department_name || "Unnamed Department",
        department_code: d.dept_code || d.department_code || "DEPT",
        dept_name: d.dept_name || d.department_name,
        dept_code: d.dept_code || d.department_code,
        head_employee_public_id: d.head_employee_public_id || null,
        head_employee_name: d.head_employee_name || null,
        employee_count: d.employee_count ?? 0,
        description: d.description || "",
      }));
    },

    getById: async (publicId: string): Promise<Department> => {
      if (isMockData()) {
        const d = mockData.MOCK_DEPARTMENTS.find((x) => x.public_id === publicId);
        if (!d) throw new Error("Department not found");
        return d;
      }
      return request<Department>(`/departments/${publicId}`);
    },

    getMyDepartment: async (): Promise<Department> => {
      if (isMockData()) return mockData.MOCK_DEPARTMENTS[0];
      return request<Department>("/departments/me");
    },

    getMyDepartmentEmployees: async () => {
      if (isMockData()) return { items: mockData.MOCK_EMPLOYEES.slice(0, 5), total: 5 };
      return request<any>("/departments/me/employees");
    },

    create: async (payload: { dept_name: string; dept_code: string; description?: string; head_employee_public_id?: string }) => {
      if (isMockData()) {
        const d: Department = {
          public_id: `dept-${Date.now()}`,
          department_code: payload.dept_code,
          department_name: payload.dept_name,
          dept_code: payload.dept_code,
          dept_name: payload.dept_name,
          description: payload.description,
          employee_count: 0,
        };
        mockData.MOCK_DEPARTMENTS.push(d);
        return d;
      }
      const body = {
        dept_name: payload.dept_name,
        dept_code: payload.dept_code,
        description: payload.description || "",
        head_employee_public_id: payload.head_employee_public_id || null,
      };
      const res = await request<any>("/departments", { method: "POST", body: JSON.stringify(body) });
      return {
        public_id: res.public_id || "",
        department_name: res.dept_name || res.department_name || payload.dept_name,
        department_code: res.dept_code || res.department_code || payload.dept_code,
        dept_name: res.dept_name || payload.dept_name,
        dept_code: res.dept_code || payload.dept_code,
        head_employee_public_id: res.head_employee_public_id || null,
        head_employee_name: res.head_employee_name || null,
        employee_count: res.employee_count ?? 0,
        description: res.description || payload.description || "",
      };
    },

    update: async (
      publicId: string,
      payload: { dept_name: string; dept_code: string; description?: string; head_employee_public_id?: string | null }
    ): Promise<Department> => {
      const headId = payload.head_employee_public_id || null;
      if (isMockData()) {
        const idx = mockData.MOCK_DEPARTMENTS.findIndex((d) => d.public_id === publicId);
        if (idx !== -1) {
          const current = mockData.MOCK_DEPARTMENTS[idx];
          const updated: Department = {
            ...current,
            department_name: payload.dept_name,
            dept_name: payload.dept_name,
            department_code: payload.dept_code,
            dept_code: payload.dept_code,
            description: payload.description !== undefined ? payload.description : current.description,
            head_employee_public_id: headId,
          };
          if (headId) {
            const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === headId);
            updated.head_employee_name = emp ? `${emp.first_name} ${emp.last_name}` : null;
          } else {
            updated.head_employee_name = null;
          }
          mockData.MOCK_DEPARTMENTS[idx] = updated;
          return updated;
        }
        throw new Error("Department not found");
      }

      const body = {
        dept_name: payload.dept_name,
        dept_code: payload.dept_code,
        description: payload.description || "",
        head_employee_public_id: headId || "",
      };
      const res = await request<any>(`/departments/${publicId}`, { method: "PUT", body: JSON.stringify(body) });
      return {
        public_id: res.public_id || publicId,
        department_name: res.dept_name || res.department_name || payload.dept_name,
        department_code: res.dept_code || res.department_code || payload.dept_code,
        dept_name: res.dept_name || payload.dept_name,
        dept_code: res.dept_code || payload.dept_code,
        head_employee_public_id: res.head_employee_public_id || null,
        head_employee_name: res.head_employee_name || null,
        employee_count: res.employee_count ?? 0,
        description: res.description || payload.description || "",
      };
    },

    delete: async (publicId: string): Promise<{ ok: boolean; details?: string }> => {
      if (isMockData()) {
        const idx = mockData.MOCK_DEPARTMENTS.findIndex((d) => d.public_id === publicId);
        if (idx !== -1) mockData.MOCK_DEPARTMENTS.splice(idx, 1);
        return { ok: true, details: "Department deleted" };
      }
      return request<any>(`/departments/${publicId}`, { method: "DELETE" });
    },

    getEmployees: async (publicId: string): Promise<any[]> => {
      if (isMockData()) {
        return mockData.MOCK_EMPLOYEES.filter((e) => e.department_public_id === publicId);
      }
      const res = await request<any>(`/departments/${publicId}/employees`);
      return Array.isArray(res) ? res : res.items || [];
    },

    listDesignations: async (): Promise<Designation[]> => {
      if (isMockData()) return mockData.MOCK_DESIGNATIONS;
      const res = await request<any>("/designations");
      const list = Array.isArray(res) ? res : res.items || [];
      return list.map((des: any) => ({
        public_id: des.public_id || des.id || "",
        designation_name: des.title || des.designation_name || "Designation",
        title: des.title || des.designation_name || "Designation",
        designation_code: des.designation_code || des.title?.replace(/\s+/g, "_").toUpperCase(),
        department_public_id: des.department_public_id || undefined,
        department_name: des.department_name || undefined,
        grade_level: des.grade_level || "L1",
        description: des.description || "",
        min_salary: des.min_salary,
        max_salary: des.max_salary,
      }));
    },

    createDesignation: async (payload: { title?: string; designation_name?: string; grade_level?: string; description?: string; designation_code?: string; department_public_id?: string }) => {
      const title = payload.title || payload.designation_name || "Role";
      const grade = payload.grade_level || "L1";
      const desc = payload.description || "";
      if (isMockData()) {
        const des: Designation = {
          public_id: `des-${Date.now()}`,
          designation_code: payload.designation_code || title.replace(/\s+/g, "_").toUpperCase(),
          designation_name: title,
          title,
          grade_level: grade,
          description: desc,
          department_public_id: payload.department_public_id,
        };
        mockData.MOCK_DESIGNATIONS.push(des);
        return des;
      }
      const body = {
        title,
        grade_level: grade,
        description: desc,
      };
      const res = await request<any>("/designations", { method: "POST", body: JSON.stringify(body) });
      return {
        public_id: res.public_id || "",
        title: res.title || title,
        designation_name: res.title || title,
        grade_level: res.grade_level || grade,
        description: res.description || desc,
      };
    },
  },

  designations: {
    list: async (): Promise<Designation[]> => {
      return api.departments.listDesignations();
    },
    create: async (payload: { title?: string; designation_name?: string; grade_level?: string; description?: string; designation_code?: string; department_public_id?: string }): Promise<Designation> => {
      return api.departments.createDesignation(payload);
    },
  },

  // ── 7. Attendance Module (`/attendance/*`) ────────────────────────────────────
  attendance: {
    checkIn: async (workMode: "Office" | "Remote" | "Hybrid" | "in_office" | "remote" | "field", notes?: string): Promise<AttendanceRecord> => {
      if (isMockData()) {
        const user = getActiveUser();
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === user.employee_public_id) || mockData.MOCK_EMPLOYEES[0];
        const todayStr = new Date().toISOString().split("T")[0];
        const existingToday = mockData.MOCK_ATTENDANCE_RECORDS.find(
          (r) => (r.employee_public_id === emp.public_id || r.employee_public_id === user.employee_public_id) && r.date === todayStr
        );
        if (existingToday) {
          if (!existingToday.check_out_time) {
            throw new Error(`You already have an active check-in for today (${todayStr}).`);
          }
          throw new Error(`Check-in is only allowed once per day. Your shift for today (${todayStr}) has already been completed.`);
        }
        const newRecord: AttendanceRecord = {
          attendance_id: Date.now(),
          employee_public_id: emp.public_id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_code: emp.employee_code,
          department_name: emp.department_name,
          date: todayStr,
          check_in_time: new Date().toISOString(),
          check_out_time: null,
          work_mode: workMode as any,
          status: "Present",
          total_hours: 0,
          notes,
        };
        mockData.MOCK_ATTENDANCE_RECORDS.unshift(newRecord);
        return newRecord;
      }
      const modeMap: Record<string, string> = {
        Office: "in_office",
        Remote: "remote",
        Hybrid: "in_office",
        in_office: "in_office",
        remote: "remote",
        field: "field",
      };
      const body = {
        work_mode: modeMap[workMode] || "in_office",
        notes: notes || "Check-in from EMS Portal",
        timezone: "Asia/Kolkata",
      };
      const res = await request<any>("/attendance/check-in", { method: "POST", body: JSON.stringify(body) });
      const record = res.record || res;
      return {
        attendance_id: record.attendance_id ?? record.public_id ?? Date.now(),
        employee_public_id: record.employee_public_id ?? record.employeePublicId ?? "",
        employee_name: record.employee_name ?? record.employeeName,
        employee_code: record.employee_code ?? record.employeeCode,
        department_name: record.department_name ?? record.departmentName,
        date: record.date ?? new Date().toISOString().split("T")[0],
        check_in_time: record.check_in_time ?? record.checkIn ?? record.check_in ?? new Date().toISOString(),
        check_out_time: record.check_out_time ?? record.checkOut ?? record.check_out ?? null,
        work_mode: record.work_mode ?? record.workMode ?? "Office",
        status: "Present",
        total_hours: record.total_hours != null ? Number(record.total_hours) : record.totalHours != null ? Number(record.totalHours) : undefined,
        notes: record.notes,
      };
    },

    checkOut: async (notes?: string): Promise<AttendanceRecord> => {
      if (isMockData()) {
        const user = getActiveUser();
        const active = mockData.MOCK_ATTENDANCE_RECORDS.find(
          (r) => (r.employee_public_id === user.employee_public_id || !r.employee_public_id) && !r.check_out_time
        );
        if (active) {
          active.check_out_time = new Date().toISOString();
          active.status = "Present";
          active.total_hours = 8.5;
          return active;
        }
        return mockData.MOCK_ATTENDANCE_RECORDS[0];
      }
      const res = await request<any>("/attendance/check-out", { method: "POST", body: JSON.stringify({ notes: notes || "Check-out" }) });
      const record = res.record || res;
      return {
        attendance_id: record.attendance_id ?? record.public_id ?? Date.now(),
        employee_public_id: record.employee_public_id ?? record.employeePublicId ?? "",
        employee_name: record.employee_name ?? record.employeeName,
        employee_code: record.employee_code ?? record.employeeCode,
        department_name: record.department_name ?? record.departmentName,
        date: record.date ?? new Date().toISOString().split("T")[0],
        check_in_time: record.check_in_time ?? record.checkIn ?? record.check_in ?? null,
        check_out_time: record.check_out_time ?? record.checkOut ?? record.check_out ?? new Date().toISOString(),
        work_mode: record.work_mode ?? record.workMode ?? "Office",
        status: "Present",
        total_hours: record.total_hours != null ? Number(record.total_hours) : record.totalHours != null ? Number(record.totalHours) : 8.0,
        notes: record.notes,
      };
    },

    getRecords: async (params: { employee_public_id?: string; date?: string; date_from?: string; date_to?: string; status?: string; skip?: number; limit?: number } = {}): Promise<Paginated<AttendanceRecord>> => {
      if (isMockData()) {
        let items = [...mockData.MOCK_ATTENDANCE_RECORDS];
        if (params.employee_public_id) items = items.filter((r) => r.employee_public_id === params.employee_public_id);
        if (params.date) items = items.filter((r) => r.date === params.date);
        const skip = params.skip || 0;
        const limit = params.limit || 20;
        return { items: items.slice(skip, skip + limit), total: items.length, skip, limit };
      }
      const qParams: Record<string, string> = {};
      if (params.employee_public_id) qParams.employee_public_id = params.employee_public_id;
      if (params.status) qParams.status = params.status;
      if (params.skip !== undefined) qParams.skip = String(params.skip);
      if (params.limit !== undefined) qParams.limit = String(params.limit);
      if (params.date_from) qParams.date_from = params.date_from;
      if (params.date_to) qParams.date_to = params.date_to;
      if (params.date) {
        qParams.date_from = params.date;
        qParams.date_to = params.date;
      }
      const q = new URLSearchParams(qParams).toString();
      const res = await request<any>(`/attendance/records?${q}`);
      const rawItems: any[] = res.items || (Array.isArray(res) ? res : []);
      const normalizeRecord = (r: any): AttendanceRecord => {
        const inTime = r.check_in_time ?? r.checkIn ?? r.check_in ?? null;
        const outTime = r.check_out_time ?? r.checkOut ?? r.check_out ?? null;
        let effStatus = r.status || "Present";
        if ((inTime || outTime) && String(effStatus).toLowerCase() === "absent") {
          effStatus = "Present";
        }
        return {
          attendance_id: r.attendance_id != null ? r.attendance_id : (r.id != null ? r.id : (r.public_id ?? Date.now())),
          public_id: r.public_id ?? r.publicId ?? undefined,
          employee_public_id: r.employee_public_id ?? r.employeePublicId ?? "",
          employee_name: r.employee_name ?? r.employeeName ?? undefined,
          employee_code: r.employee_code ?? r.employeeCode ?? undefined,
          department_name: r.department_name ?? r.departmentName ?? undefined,
          date: r.date ?? "",
          check_in_time: inTime,
          check_out_time: outTime,
          work_mode: r.work_mode ?? r.workMode ?? "Office",
          status: effStatus,
          total_hours: r.total_hours != null ? Number(r.total_hours) : r.totalHours != null ? Number(r.totalHours) : undefined,
          notes: r.notes ?? undefined,
        };
      };
      return {
        items: rawItems.map(normalizeRecord),
        total: res.total || (Array.isArray(res) ? res.length : 0),
        skip: res.skip || 0,
        limit: res.limit || 20,
      };
    },

    createManualRecord: async (payload: {
      employee_public_id?: string;
      date: string;
      check_in?: string;
      check_out?: string;
      work_mode?: string;
      status?: string;
      notes?: string;
    }): Promise<AttendanceRecord> => {
      if (isMockData()) {
        const matchedEmp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === payload.employee_public_id);
        const empName = matchedEmp ? `${matchedEmp.first_name} ${matchedEmp.last_name}`.trim() : "Employee";
        const empCode = matchedEmp?.employee_code || "EMP";
        const deptName = matchedEmp?.department_name || "General";

        const checkInIso = payload.check_in
          ? (payload.check_in.includes("T") ? payload.check_in : `${payload.date}T${payload.check_in.length === 5 ? `${payload.check_in}:00` : payload.check_in}`)
          : null;
        const checkOutIso = payload.check_out
          ? (payload.check_out.includes("T") ? payload.check_out : `${payload.date}T${payload.check_out.length === 5 ? `${payload.check_out}:00` : payload.check_out}`)
          : null;

        const newRecord: AttendanceRecord = {
          attendance_id: Date.now(),
          employee_public_id: payload.employee_public_id || "emp-005",
          employee_name: empName,
          employee_code: empCode,
          department_name: deptName,
          date: payload.date,
          check_in_time: checkInIso,
          check_out_time: checkOutIso,
          work_mode: (payload.work_mode as any) || "in_office",
          status: (payload.status as any) || "Present",
          total_hours: 8,
          notes: payload.notes,
        };
        mockData.MOCK_ATTENDANCE_RECORDS.unshift(newRecord);
        return newRecord;
      }
      const workModeMap: Record<string, string> = {
        office: "in_office",
        "work from office": "in_office",
        in_office: "in_office",
        remote: "remote",
        "remote / home": "remote",
        hybrid: "in_office",
        "client site": "field",
        field: "field",
      };
      const normalizedMode = workModeMap[(payload.work_mode || "office").toLowerCase()] || "in_office";
      const rawRes = await request<any>("/attendance/records", {
        method: "POST",
        body: JSON.stringify({ ...payload, work_mode: normalizedMode }),
      });
      return {
        attendance_id: rawRes.attendance_id ?? rawRes.public_id ?? Date.now(),
        employee_public_id: rawRes.employee_public_id ?? payload.employee_public_id ?? "",
        employee_name: rawRes.employee_name,
        employee_code: rawRes.employee_code,
        department_name: rawRes.department_name,
        date: rawRes.date ?? payload.date,
        check_in_time: rawRes.check_in_time ?? rawRes.check_in ?? payload.check_in ?? null,
        check_out_time: rawRes.check_out_time ?? rawRes.check_out ?? payload.check_out ?? null,
        work_mode: rawRes.work_mode ?? payload.work_mode ?? "in_office",
        status: rawRes.status ?? payload.status ?? "Present",
        total_hours: rawRes.total_hours != null ? Number(rawRes.total_hours) : undefined,
        notes: rawRes.notes ?? payload.notes,
      };
    },

    deleteRecord: async (attendanceId: string | number): Promise<{ ok: boolean }> => {
      const idStr = String(attendanceId);
      if (isMockData()) {
        const idx = mockData.MOCK_ATTENDANCE_RECORDS.findIndex(
          (r) => String(r.attendance_id) === idStr || String((r as any).public_id) === idStr
        );
        if (idx !== -1) mockData.MOCK_ATTENDANCE_RECORDS.splice(idx, 1);
        return { ok: true };
      }
      await request<any>(`/attendance/records/${encodeURIComponent(idStr)}`, { method: "DELETE" });
      return { ok: true };
    },

    getToday: async (employeePublicId?: string): Promise<AttendanceRecord | null> => {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await api.attendance.getRecords({
        date: todayStr,
        employee_public_id: employeePublicId,
        limit: 1,
      });
      return res.items?.[0] || null;
    },
  },

  // ── 8. Holidays Module (`/holidays/*`) ────────────────────────────────────────
  holidays: {
    list: async (): Promise<Holiday[]> => {
      if (isMockData()) return mockData.MOCK_HOLIDAYS_2026;
      const res = await request<any>("/holidays");
      return Array.isArray(res) ? res : res.items || [];
    },

    create: async (payload: Partial<Holiday>): Promise<Holiday> => {
      if (isMockData()) {
        const newH: Holiday = {
          holiday_id: Date.now(),
          public_id: `hol-${Date.now()}`,
          name: payload.name || "Holiday",
          date: payload.date || new Date().toISOString().split("T")[0],
          day_of_week: payload.day_of_week || "Monday",
          holiday_type: payload.holiday_type || "National",
          region: payload.region || "National",
          is_optional: payload.is_optional || false,
          description: payload.description,
        };
        mockData.MOCK_HOLIDAYS_2026.push(newH);
        return newH;
      }
      return request<Holiday>("/holidays", { method: "POST", body: JSON.stringify(payload) });
    },

    delete: async (id: string | number): Promise<{ ok: boolean }> => {
      if (isMockData()) {
        const idx = mockData.MOCK_HOLIDAYS_2026.findIndex(
          (h) => (h.public_id && h.public_id === String(id)) || h.holiday_id === Number(id)
        );
        if (idx !== -1) mockData.MOCK_HOLIDAYS_2026.splice(idx, 1);
        return { ok: true };
      }
      await request<any>(`/holidays/${id}`, { method: "DELETE" });
      return { ok: true };
    },
  },

  // ── 9. Leaves Module (`/leaves/*`) ───────────────────────────────────────────
  leaves: {
    listTypes: async (): Promise<LeaveType[]> => {
      if (isMockData()) return mockData.MOCK_LEAVE_TYPES.map(normalizeLeaveType);
      const res = await request<any>("/leaves/types");
      const list = Array.isArray(res) ? res : res.items || [];
      return list.map(normalizeLeaveType);
    },

    getBalances: async (employeePublicId?: string): Promise<LeaveBalance[]> => {
      if (isMockData()) {
        const user = getActiveUser();
        const targetEmpId = employeePublicId || user?.employee_public_id || "emp-001";
        const empBals = mockData.MOCK_LEAVE_BALANCES.filter((b) => b.employee_public_id === targetEmpId);
        if (empBals.length > 0) {
          return empBals.map(normalizeLeaveBalance);
        }
        return mockData.MOCK_LEAVE_TYPES.map((lt, idx) => ({
          balance_id: 100 + idx,
          employee_public_id: targetEmpId,
          leave_type_public_id: lt.public_id,
          leave_type_name: lt.type_name || lt.name || "Leave",
          type_code: lt.type_code || String(lt.type_name || lt.name || "LV").slice(0, 3).toUpperCase(),
          year: 2026,
          allocated_days: lt.annual_quota || lt.max_days_per_year || 15,
          used_days: 0,
          pending_days: 0,
          remaining_days: lt.annual_quota || lt.max_days_per_year || 15,
          total_allocated: lt.annual_quota || lt.max_days_per_year || 15,
          used_leaves: 0,
          remaining_leaves: lt.annual_quota || lt.max_days_per_year || 15,
        })).map(normalizeLeaveBalance);
      }
      const endpoint = employeePublicId ? `/leaves/balances/${employeePublicId}` : "/leaves/balances/me";
      const res = await request<any>(endpoint);
      const list = Array.isArray(res) ? res : res.items || [];
      return list.map(normalizeLeaveBalance);
    },

    getRequests: async (params: { employee_public_id?: string; status_filter?: string; skip?: number; limit?: number } = {}): Promise<Paginated<LeaveRequest>> => {
      if (isMockData()) {
        let items = [...mockData.MOCK_LEAVE_REQUESTS];
        if (params.employee_public_id) items = items.filter((r) => r.employee_public_id === params.employee_public_id);
        if (params.status_filter) items = items.filter((r) => r.status === params.status_filter);
        const skip = params.skip || 0;
        const limit = params.limit || 20;
        return { items: items.slice(skip, skip + limit), total: items.length, skip, limit };
      }
      const q = new URLSearchParams(params as any).toString();
      const res = await request<any>(`/leaves/requests?${q}`);
      return {
        items: res.items || (Array.isArray(res) ? res : []),
        total: res.total || (Array.isArray(res) ? res.length : 0),
        skip: res.skip || 0,
        limit: res.limit || 20,
      };
    },

    submitRequest: async (payload: {
      leave_type_public_id: string;
      start_date: string;
      end_date: string;
      total_days?: number;
      reason: string;
      employee_public_id?: string;
    }): Promise<LeaveRequest> => {
      let days = payload.total_days;
      if (days === undefined || days <= 0) {
        const s = new Date(payload.start_date);
        const e = new Date(payload.end_date);
        const diffMs = e.getTime() - s.getTime();
        days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      }
      const finalPayload = {
        ...payload,
        total_days: days,
      };
      if (isMockData()) {
        const user = getActiveUser();
        const emp = mockData.MOCK_EMPLOYEES.find((e) => e.public_id === user.employee_public_id) || mockData.MOCK_EMPLOYEES[0];
        const newReq: LeaveRequest = {
          public_id: `lr-${Date.now().toString().slice(-4)}`,
          employee_public_id: payload.employee_public_id || emp.public_id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_code: emp.employee_code,
          department_name: emp.department_name,
          leave_type_public_id: payload.leave_type_public_id,
          leave_type_name: "Annual Leave",
          start_date: payload.start_date,
          end_date: payload.end_date,
          total_days: days,
          reason: payload.reason,
          status: "pending",
          created_at: new Date().toISOString(),
        };
        mockData.MOCK_LEAVE_REQUESTS.unshift(newReq);
        return newReq;
      }
      return request<LeaveRequest>("/leaves/requests", { method: "POST", body: JSON.stringify(finalPayload) });
    },

    createType: async (payload: {
      name: string;
      description?: string;
      max_days_per_year: number;
      is_paid?: boolean;
    }): Promise<LeaveType> => {
      if (isMockData()) {
        const newType: LeaveType = {
          public_id: `lt-${Date.now().toString().slice(-4)}`,
          type_name: payload.name,
          name: payload.name,
          type_code: payload.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) || "LV",
          annual_quota: payload.max_days_per_year,
          max_days_per_year: payload.max_days_per_year,
          is_carry_forward: false,
          is_paid: payload.is_paid !== false,
          description: payload.description || "",
        };
        mockData.MOCK_LEAVE_TYPES.push(newType);
        return newType;
      }
      const res = await request<any>("/leaves/types", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          max_days_per_year: payload.max_days_per_year,
          is_paid: payload.is_paid !== false,
        }),
      });
      return normalizeLeaveType(res);
    },

    updateType: async (
      publicId: string,
      payload: {
        name: string;
        description?: string;
        max_days_per_year: number;
        is_paid?: boolean;
      }
    ): Promise<LeaveType> => {
      if (isMockData()) {
        const item = mockData.MOCK_LEAVE_TYPES.find((t) => t.public_id === publicId);
        if (item) {
          item.type_name = payload.name;
          item.name = payload.name;
          item.annual_quota = payload.max_days_per_year;
          item.max_days_per_year = payload.max_days_per_year;
          if (payload.description !== undefined) item.description = payload.description;
          if (payload.is_paid !== undefined) item.is_paid = payload.is_paid;
          return item;
        }
        throw new Error("Leave type not found");
      }
      const res = await request<any>(`/leaves/types/${publicId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          max_days_per_year: payload.max_days_per_year,
          is_paid: payload.is_paid !== false,
        }),
      });
      return normalizeLeaveType(res);
    },

    deleteType: async (publicId: string): Promise<{ ok: boolean; message?: string }> => {
      if (isMockData()) {
        const idx = mockData.MOCK_LEAVE_TYPES.findIndex((t) => t.public_id === publicId);
        if (idx !== -1) mockData.MOCK_LEAVE_TYPES.splice(idx, 1);
        return { ok: true, message: "Leave type deleted" };
      }
      return request<any>(`/leaves/types/${publicId}`, { method: "DELETE" });
    },

    allocateQuota: async (payload: {
      employee_public_id: string;
      leave_type_public_id: string;
      year: number;
      total_allocated: number;
    }): Promise<LeaveBalance> => {
      if (isMockData()) {
        const existing = mockData.MOCK_LEAVE_BALANCES.find(
          (b) => b.employee_public_id === payload.employee_public_id && b.leave_type_public_id === payload.leave_type_public_id
        );
        if (existing) {
          existing.allocated_days = payload.total_allocated;
          existing.remaining_days = payload.total_allocated - existing.used_days;
          return existing;
        }
        const newBal: LeaveBalance = {
          balance_id: Date.now(),
          employee_public_id: payload.employee_public_id,
          leave_type_public_id: payload.leave_type_public_id,
          leave_type_name: "Leave",
          type_code: "LV",
          year: payload.year,
          allocated_days: payload.total_allocated,
          used_days: 0,
          pending_days: 0,
          remaining_days: payload.total_allocated,
        };
        mockData.MOCK_LEAVE_BALANCES.push(newBal);
        return newBal;
      }
      const res = await request<any>("/leaves/allocate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return normalizeLeaveBalance(res);
    },

    actionRequest: async (publicId: string, action: "approve" | "reject", comments?: string): Promise<LeaveRequest> => {
      if (isMockData()) {
        const req = mockData.MOCK_LEAVE_REQUESTS.find((r) => r.public_id === publicId);
        if (!req) throw new Error("Leave request not found");
        req.status = action === "approve" ? "approved" : "rejected";
        return req;
      }
      const body = {
        action: action === "approve" ? "approved" : "rejected",
        status: action === "approve" ? "approved" : "rejected",
        remarks: comments || `Action ${action}d via EMS Portal`,
        rejection_reason: action === "reject" ? (comments || "Rejected by reviewer") : null,
      };
      return request<LeaveRequest>(`/leaves/requests/${publicId}/action`, { method: "POST", body: JSON.stringify(body) });
    },

    cancelRequest: async (publicId: string) => {
      if (isMockData()) {
        const req = mockData.MOCK_LEAVE_REQUESTS.find((r) => r.public_id === publicId);
        if (req) req.status = "cancelled";
        return { ok: true };
      }
      return request<any>(`/leaves/requests/${publicId}/cancel`, { method: "POST" });
    },
  },

  // ── 10. Payroll Module (`/payroll/*`) ────────────────────────────────────────
  payroll: {
    getRuns: async (params: { employee_public_id?: string; payment_status?: string; skip?: number; limit?: number } = {}): Promise<Paginated<PayrollRun>> => {
      if (isMockData()) {
        let items = [...mockData.MOCK_PAYROLL_RUNS];
        if (params.payment_status) items = items.filter((r) => r.payment_status === params.payment_status);
        const skip = params.skip || 0;
        const limit = params.limit || 20;
        return { items: items.slice(skip, skip + limit).map(normalizePayrollRun), total: items.length, skip, limit };
      }
      const cleanParams: Record<string, string> = {};
      if (params.skip !== undefined && params.skip !== null) cleanParams.skip = String(params.skip);
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = String(params.limit);
      if (params.payment_status) cleanParams.payment_status = params.payment_status;
      if (params.employee_public_id && params.employee_public_id !== "undefined" && params.employee_public_id !== "null") {
        cleanParams.employee_public_id = params.employee_public_id;
      }
      const q = new URLSearchParams(cleanParams).toString();
      const res = await request<any>(`/payroll/runs${q ? `?${q}` : ""}`);
      const rawItems = res.items || (Array.isArray(res) ? res : []);
      return {
        items: rawItems.map(normalizePayrollRun),
        total: res.total ?? (Array.isArray(res) ? res.length : rawItems.length),
        skip: res.skip || 0,
        limit: res.limit || 20,
      };
    },

    getPayslip: async (payrollPublicId: string): Promise<PayslipDetail> => {
      if (isMockData()) {
        return normalizePayslip(mockData.MOCK_PAYSLIP_SAMPLE);
      }
      try {
        const res = await request<any>(`/payroll/runs/${payrollPublicId}/payslip`);
        return normalizePayslip(res);
      } catch {
        const res = await request<any>(`/payroll/runs/${payrollPublicId}`);
        return normalizePayslip(res);
      }
    },

    disburse: async (payrollPublicId: string): Promise<PayrollRun> => {
      if (isMockData()) {
        const run = mockData.MOCK_PAYROLL_RUNS.find((r) => r.public_id === payrollPublicId);
        if (run) run.payment_status = "paid";
        return run || mockData.MOCK_PAYROLL_RUNS[0];
      }
      const body = { payment_reference: `CMS-NEFT-${Date.now()}` };
      return request<PayrollRun>(`/payroll/runs/${payrollPublicId}/disburse`, { method: "POST", body: JSON.stringify(body) });
    },

    processBatch: async (payload: {
      pay_period_start: string;
      pay_period_end: string;
      department_public_id?: string;
      employee_public_id?: string;
    }): Promise<any> => {
      if (isMockData()) {
        return { total_processed: 5, total_disbursed: 285000, message: "Batch payroll calculation executed successfully" };
      }
      return request<any>("/payroll/process", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    getSalary: async (employeePublicId: string): Promise<SalaryStructure> => {
      return api.salaries.getEmployeeSalaries(employeePublicId);
    },

    updateSalary: async (employeePublicId: string, payload: Partial<SalaryStructure>): Promise<SalaryStructure> => {
      let components = payload.components ? [...payload.components] : [];
      if (components.length === 0) {
        if (payload.hra) components.push({ component_name: "House Rent Allowance (HRA)", component_type: "earning", amount: Number(payload.hra) });
        if (payload.conveyance_allowance) components.push({ component_name: "Conveyance Allowance", component_type: "earning", amount: Number(payload.conveyance_allowance) });
        if (payload.special_allowance) components.push({ component_name: "Special Allowance", component_type: "earning", amount: Number(payload.special_allowance) });
        if (payload.provident_fund) components.push({ component_name: "Provident Fund (PF)", component_type: "deduction", amount: Number(payload.provident_fund) });
        if (payload.professional_tax) components.push({ component_name: "Professional Tax", component_type: "deduction", amount: Number(payload.professional_tax) });
        if (payload.tds_tax) components.push({ component_name: "TDS / Income Tax", component_type: "deduction", amount: Number(payload.tds_tax) });
      }

      return api.salaries.createRevision({
        employee_public_id: employeePublicId,
        basic_salary: Number(payload.basic_salary || 0),
        currency: payload.currency || "INR",
        effective_from: payload.effective_from || new Date().toISOString().split("T")[0],
        components,
      });
    },

    getBankDetails: async (employeePublicId: string): Promise<BankDetail | null> => {
      return api.bankDetails.getByEmployee(employeePublicId);
    },

    updateBankDetails: async (employeePublicId: string, payload: Partial<BankDetail>): Promise<BankDetail> => {
      const existing = await api.bankDetails.getByEmployee(employeePublicId);
      if (existing && existing.public_id) {
        return api.bankDetails.update(existing.public_id, payload);
      }
      return api.bankDetails.create({ ...payload, employee_public_id: employeePublicId });
    },
  },



  // ── 11. Projects Module (`/projects/*`) ──────────────────────────────────────
  projects: {
    list: async (): Promise<Project[]> => {
      if (isMockData()) return mockData.MOCK_PROJECTS.map(normalizeProject);
      const res = await request<any>("/projects");
      const items = Array.isArray(res) ? res : res.items || [];
      return items.map(normalizeProject);
    },

    getById: async (publicId: string): Promise<Project> => {
      if (isMockData()) {
        const p = mockData.MOCK_PROJECTS.find((x) => x.public_id === publicId);
        if (!p) throw new Error("Project not found");
        return normalizeProject(p);
      }
      const res = await request<any>(`/projects/${publicId}`);
      return normalizeProject(res);
    },

    create: async (payload: Partial<Project>): Promise<Project> => {
      const headId = payload.head_employee_public_id || payload.project_head_public_id || null;
      if (isMockData()) {
        const created: Project = {
          public_id: `proj-${Date.now()}`,
          project_code: payload.project_code || "PRJ-NEW",
          project_name: payload.project_name || "New Project",
          description: payload.description || "",
          status: payload.status || "active",
          start_date: payload.start_date || new Date().toISOString().split("T")[0],
          head_employee_public_id: headId,
          project_head_public_id: headId,
          head_employee_name: payload.head_employee_name || payload.project_head_name || "Lead",
          project_head_name: payload.project_head_name || payload.head_employee_name || "Lead",
          members_count: 1,
          member_count: 1,
          completion_percentage: 0,
          members: [],
        };
        mockData.MOCK_PROJECTS.unshift(created);
        return created;
      }
      const body = {
        ...payload,
        project_head_public_id: headId,
        head_employee_public_id: headId,
      };
      const res = await request<any>("/projects", { method: "POST", body: JSON.stringify(body) });
      return normalizeProject(res);
    },

    update: async (publicId: string, payload: Partial<Project>): Promise<Project> => {
      const headId =
        payload.head_employee_public_id !== undefined
          ? payload.head_employee_public_id
          : payload.project_head_public_id !== undefined
          ? payload.project_head_public_id
          : undefined;

      if (isMockData()) {
        const idx = mockData.MOCK_PROJECTS.findIndex((p) => p.public_id === publicId);
        if (idx !== -1) {
          const current = mockData.MOCK_PROJECTS[idx];
          const updated: Project = {
            ...current,
            ...payload,
          };
          if (headId !== undefined) {
            updated.head_employee_public_id = headId || null;
            updated.project_head_public_id = headId || null;
            if (!headId) {
              updated.head_employee_name = null;
              updated.project_head_name = null;
            } else {
              const emp = (mockData.MOCK_EMPLOYEES as any[])?.find((e) => e.public_id === headId);
              const resolvedName = emp ? `${emp.first_name} ${emp.last_name}` : "Lead";
              updated.head_employee_name = payload.head_employee_name || payload.project_head_name || resolvedName;
              updated.project_head_name = payload.head_employee_name || payload.project_head_name || resolvedName;
            }
          }
          mockData.MOCK_PROJECTS[idx] = updated;
          return normalizeProject(updated);
        }
        throw new Error("Project not found");
      }

      const body: any = { ...payload };
      if (headId !== undefined) {
        body.project_head_public_id = headId || "";
        body.head_employee_public_id = headId || "";
      }

      const res = await request<any>(`/projects/${publicId}`, { method: "PUT", body: JSON.stringify(body) });
      return normalizeProject(res.project || res);
    },

    delete: async (publicId: string) => {
      if (isMockData()) {
        const idx = mockData.MOCK_PROJECTS.findIndex((p) => p.public_id === publicId);
        if (idx !== -1) mockData.MOCK_PROJECTS.splice(idx, 1);
        return { ok: true };
      }
      return request<any>(`/projects/${publicId}`, { method: "DELETE" });
    },

    addMember: async (projectPublicId: string, payload: { employee_public_id: string; role_in_project: string }): Promise<ProjectMember> => {
      if (isMockData()) {
        return {
          member_id: Date.now(),
          project_public_id: projectPublicId,
          employee_public_id: payload.employee_public_id,
          employee_name: "Team Member",
          role_in_project: payload.role_in_project as any,
          joined_at: new Date().toISOString().split("T")[0],
        };
      }
      return request<ProjectMember>(`/projects/${projectPublicId}/members`, { method: "POST", body: JSON.stringify(payload) });
    },

    removeMember: async (projectPublicId: string, employeePublicId: string) => {
      if (isMockData()) return { ok: true };
      return request<any>(`/projects/${projectPublicId}/members/${employeePublicId}`, { method: "DELETE" });
    },
  },

  // ── 12. Performance Reviews (`/reviews/*`) ───────────────────────────────────
  reviews: {
    list: async (params: { employee_public_id?: string; reviewer_public_id?: string } = {}): Promise<PerformanceReview[]> => {
      if (isMockData()) return mockData.MOCK_REVIEWS;
      const q = new URLSearchParams(params as any).toString();
      const res = await request<any>(`/reviews?${q}`);
      const items: any[] = Array.isArray(res) ? res : res.items || [];
      return items.map((r: any) => ({
        public_id: r.public_id,
        employee_public_id: r.employee_public_id,
        employee_name: r.employee_name || "Employee",
        reviewer_public_id: r.reviewer_public_id,
        reviewer_name: r.reviewer_name || "Manager",
        department_name: r.department_name || "Operations",
        designation_name: r.designation_name || "Associate",
        review_cycle: r.review_cycle || (r.review_period_start ? `${r.review_period_start.substring(0, 4)} Review` : "Annual Review"),
        performance_score: r.performance_score !== undefined ? r.performance_score : (r.rating !== undefined ? r.rating : 4.0),
        strengths: r.strengths || r.comments || "Consistent execution and collaboration",
        areas_of_improvement: r.areas_of_improvement || "Continue expanding domain expertise",
        goals: r.goals || "Deliver key departmental milestones",
        status: (r.status === "finalized" ? "Submitted" : r.status) || "Submitted",
        created_at: r.created_at || r.review_period_start || new Date().toISOString(),
      }));
    },

    getById: async (publicId: string): Promise<PerformanceReview> => {
      if (isMockData()) {
        const r = mockData.MOCK_REVIEWS.find((x) => x.public_id === publicId);
        if (!r) throw new Error("Review not found");
        return r;
      }
      return request<PerformanceReview>(`/reviews/${publicId}`);
    },

    create: async (payload: Partial<PerformanceReview>): Promise<PerformanceReview> => {
      if (isMockData()) {
        const created: PerformanceReview = {
          public_id: `rev-${Date.now()}`,
          employee_public_id: payload.employee_public_id || "emp-005",
          employee_name: "Vikram Malhotra",
          reviewer_public_id: getActiveUser().employee_public_id || "emp-001",
          reviewer_name: getActiveUser().display_name,
          review_cycle: payload.review_cycle || "Q3 2026",
          performance_score: payload.performance_score || 4.5,
          strengths: payload.strengths || "Excellent code quality",
          areas_of_improvement: payload.areas_of_improvement || "None",
          goals: payload.goals || "Lead initiatives",
          status: "Submitted",
          created_at: new Date().toISOString(),
        };
        mockData.MOCK_REVIEWS.unshift(created);
        return created;
      }
      return request<PerformanceReview>("/reviews", { method: "POST", body: JSON.stringify(payload) });
    },

    update: async (publicId: string, payload: Partial<PerformanceReview> & { employee_comments?: string }): Promise<PerformanceReview> => {
      if (isMockData()) {
        const rev = mockData.MOCK_REVIEWS.find((x) => x.public_id === publicId);
        if (rev) {
          Object.assign(rev, payload);
          return rev;
        }
        throw new Error("Review not found");
      }
      return request<PerformanceReview>(`/reviews/${publicId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
  },

  // ── 13. Announcements (`/announcements/*`) ───────────────────────────────────
  announcements: {
    list: async (): Promise<Announcement[]> => {
      if (isMockData()) return mockData.MOCK_ANNOUNCEMENTS;
      const res = await request<any>("/announcements");
      return Array.isArray(res) ? res : res.items || [];
    },

    create: async (payload: Partial<Announcement>): Promise<Announcement> => {
      if (isMockData()) {
        const item: Announcement = {
          public_id: `ann-${Date.now()}`,
          title: payload.title || "Announcement",
          content: payload.content || "",
          priority: payload.priority || "Medium",
          target_audience: payload.target_audience || "All",
          author_name: getActiveUser().display_name,
          is_pinned: payload.is_pinned ?? false,
          published_at: new Date().toISOString(),
        };
        mockData.MOCK_ANNOUNCEMENTS.unshift(item);
        return item;
      }
      const p = (payload.priority || "normal").toString().trim().toLowerCase();
      const priorityMap: Record<string, string> = {
        low: "low",
        medium: "normal",
        normal: "normal",
        high: "high",
        urgent: "urgent",
      };
      const body = {
        title: payload.title,
        content: payload.content,
        priority: priorityMap[p] || "normal",
        target_type: (payload.target_audience || "all").toLowerCase() === "department" ? "department" : "all",
        expires_at: (payload as any).expires_at,
      };
      return request<Announcement>("/announcements", { method: "POST", body: JSON.stringify(body) });
    },

    delete: async (publicId: string) => {
      if (isMockData()) {
        const idx = mockData.MOCK_ANNOUNCEMENTS.findIndex((a) => a.public_id === publicId);
        if (idx !== -1) mockData.MOCK_ANNOUNCEMENTS.splice(idx, 1);
        return { ok: true };
      }
      return request<any>(`/announcements/${publicId}`, { method: "DELETE" });
    },

    togglePin: async (publicId: string): Promise<Announcement> => {
      if (isMockData()) {
        const ann = mockData.MOCK_ANNOUNCEMENTS.find((a) => a.public_id === publicId);
        if (ann) ann.is_pinned = !ann.is_pinned;
        return ann || mockData.MOCK_ANNOUNCEMENTS[0];
      }
      return request<Announcement>(`/announcements/${publicId}/pin`, { method: "PATCH" });
    },
  },

  // ── 14. Audit Trail (`/audit-logs/*`) ─────────────────────────────────────────
  audit: {
    list: async (): Promise<AuditLog[]> => {
      if (isMockData()) return mockData.MOCK_AUDIT_LOGS;
      const res = await request<any>("/audit-logs");
      const rawList = Array.isArray(res) ? res : res.items || [];
      return rawList.map((item: any) => {
        let detailsText = item.details || "";
        if (!detailsText) {
          if (item.new_values && item.old_values) {
            detailsText = `Updated from '${item.old_values}' to '${item.new_values}'`;
          } else if (item.new_values) {
            detailsText = `Values: ${item.new_values}`;
          } else if (item.entity_id) {
            detailsText = `Action on ${item.entity_name || "Record"} (ID: ${item.entity_id})`;
          } else {
            detailsText = `Action executed on ${item.entity_name || "system module"}`;
          }
        }
        const actionStr = (item.action || "AUDIT_EVENT").toUpperCase();
        let severity: "info" | "warning" | "critical" = item.severity || "info";
        if (actionStr.includes("DELETE") || actionStr.includes("REVOKE") || actionStr.includes("FAIL")) {
          severity = "critical";
        } else if (actionStr.includes("UPDATE") || actionStr.includes("ASSIGN") || actionStr.includes("CREATE")) {
          severity = "warning";
        }

        const userEmail = item.user_email || item.actor_email || "system@enterprise.local";
        const actorName = item.actor_name || (userEmail.includes("@") ? userEmail.split("@")[0] : userEmail);

        return {
          log_id: item.log_id || Math.floor(Math.random() * 100000),
          action: item.action || "SYSTEM_EVENT",
          module: item.entity_name || item.module || "Security",
          actor_name: actorName,
          actor_email: userEmail,
          ip_address: item.ip_address || "127.0.0.1",
          details: detailsText,
          timestamp: item.created_at || item.timestamp || new Date().toISOString(),
          severity,
        };
      });
    },
  },
};

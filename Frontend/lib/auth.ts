/**
 * Authentication and RBAC (Role-Based Access Control) Management
 * 
 * Supports:
 * - Real API authentication for Java Spring Boot (:8080) and Python FastAPI (:8000)
 * - Transparent offline fallback for Mock Standalone mode
 * - Role and permission resolution
 */

import { UserRole } from "@/types/common";
import { UserProfile } from "@/types/auth";
import { API_CONFIG, isMockData } from "./config";
import { MOCK_PERMISSIONS, MOCK_ALL_USERS, MOCK_PENDING_USERS } from "@/data/mockRoles";
import { useEffect, useState } from "react";
import { api, createMockJwt } from "./apiClient";
import { applyTheme, getInitialTheme } from "./theme";

/**
 * Pre-seeded Enterprise Accounts Directory for testing
 * Covers both mock demo accounts and real PostgreSQL seed accounts!
 */
export const MOCK_USER_CREDENTIALS: {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  designation: string;
  isDbAccount?: boolean;
}[] = [
  // Real Database Accounts (PostgreSQL)
  {
    email: "admin@company.com",
    password: "AdminPassword123!",
    role: "Admin",
    name: "System Administrator",
    designation: "Enterprise Super Admin (DB)",
    isDbAccount: true,
  },
  {
    email: "test.hr@company.com",
    password: "TestPass123!",
    role: "HR_Manager",
    name: "HR Manager",
    designation: "People Operations Lead (DB)",
    isDbAccount: true,
  },
  {
    email: "test.manager@company.com",
    password: "TestPass123!",
    role: "Department_Head",
    name: "Engineering Head",
    designation: "Department Head (DB)",
    isDbAccount: true,
  },
  {
    email: "test.emp@company.com",
    password: "TestPass123!",
    role: "Employee",
    name: "Test Employee",
    designation: "Software Engineer (DB)",
    isDbAccount: true,
  },
  // Standalone Mock Demo Accounts
  {
    email: "arjun.sharma@company.in",
    password: "Admin@123",
    role: "Admin",
    name: "Arjun Sharma",
    designation: "VP of Engineering & Super Admin",
  },
  {
    email: "priya.mehta@company.in",
    password: "Hr@123",
    role: "HR_Manager",
    name: "Priya Mehta",
    designation: "Head of People Operations",
  },
  {
    email: "sneha.iyer@company.in",
    password: "Dept@123",
    role: "Department_Head",
    name: "Sneha Iyer",
    designation: "Engineering Department Head",
  },
  {
    email: "rohan.verma@company.in",
    password: "Project@123",
    role: "Project_Manager",
    name: "Rohan Verma",
    designation: "Senior Project Delivery Manager",
  },
  {
    email: "vikram.malhotra@company.in",
    password: "Emp@123",
    role: "Employee",
    name: "Vikram Malhotra",
    designation: "Software Engineer (Self-Service)",
  },
];

export const MOCK_USERS_BY_ROLE: Record<UserRole, UserProfile> = {
  Admin: MOCK_ALL_USERS.find((u) => u.roles[0]?.role_name === "Admin")!,
  HR_Manager: MOCK_ALL_USERS.find((u) => u.roles[0]?.role_name === "HR_Manager")!,
  Department_Head: MOCK_ALL_USERS.find((u) => u.roles[0]?.role_name === "Department_Head")!,
  Project_Manager: MOCK_ALL_USERS.find((u) => u.roles[0]?.role_name === "Project_Manager")!,
  Employee: MOCK_ALL_USERS.find((u) => u.roles[0]?.role_name === "Employee")!,
};

/**
 * Normalizes user profile object so roles format ({ role_name }) and permissions are uniform
 */
export function normalizeUserProfile(rawUser: any): UserProfile {
  if (!rawUser) return MOCK_USERS_BY_ROLE.Employee;

  let normalizedRoles: { role_id?: number; role_name: UserRole }[] = [];
  if (Array.isArray(rawUser.roles)) {
    normalizedRoles = rawUser.roles.map((r: any) => {
      if (typeof r === "string") return { role_name: r as UserRole };
      if (r && typeof r === "object" && r.role_name) return r;
      return { role_name: (r || "Employee") as UserRole };
    });
  }

  return {
    public_id: rawUser.public_id || `usr-${Date.now()}`,
    email: rawUser.email || "",
    display_name: rawUser.display_name || rawUser.name || rawUser.email?.split("@")[0] || "User",
    name: rawUser.display_name || rawUser.name || rawUser.email?.split("@")[0] || "User",
    secondary_email: rawUser.secondary_email || null,
    is_active: rawUser.is_active ?? true,
    is_verified: rawUser.is_verified ?? true,
    employee_public_id: rawUser.employee_public_id || null,
    roles: normalizedRoles,
    permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
    custom_permissions: rawUser.custom_permissions || [],
    revoked_permissions: rawUser.revoked_permissions || [],
    created_at: rawUser.created_at || new Date().toISOString(),
    last_login: rawUser.last_login || null,
  };
}

/**
 * Server default role and user to guarantee identical SSR and initial client hydration
 */
export const SSR_DEFAULT_ROLE: UserRole = "Employee";
export const SSR_DEFAULT_USER: UserProfile = {
  public_id: "usr-guest",
  email: "user@company.com",
  display_name: "Corporate User",
  name: "Corporate User",
  is_active: true,
  is_verified: true,
  employee_public_id: null,
  roles: [{ role_name: "Employee" }],
  permissions: [],
};

/**
 * Retrieve the current authenticated user from storage (defaults to Admin if unauthenticated SSR)
 */
export function getActiveUser(): UserProfile {
  if (typeof window !== "undefined") {
    try {
      const storedUser = localStorage.getItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER);
      if (storedUser) {
        return normalizeUserProfile(JSON.parse(storedUser));
      }
    } catch (e) {}
  }
  return SSR_DEFAULT_USER;
}

/**
 * Get active role name of current authenticated user
 */
export function getActiveRole(): UserRole {
  if (typeof window !== "undefined") {
    try {
      const explicit = localStorage.getItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE) as UserRole;
      if (explicit && ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"].includes(explicit)) {
        return explicit;
      }
    } catch (e) {}
  }
  const user = getActiveUser();
  if (user?.roles && user.roles.length > 0) {
    const roleNames: UserRole[] = user.roles.map((r: any) =>
      typeof r === "string" ? (r as UserRole) : (r?.role_name as UserRole)
    );
    // Priority order: Admin > HR_Manager > Department_Head > Project_Manager > Employee
    const priority: UserRole[] = ["Admin", "HR_Manager", "Department_Head", "Project_Manager", "Employee"];
    for (const p of priority) {
      if (roleNames.includes(p)) return p;
    }
    return roleNames[0] || SSR_DEFAULT_ROLE;
  }
  return SSR_DEFAULT_ROLE;
}

/**
 * Check if the active user possesses a given permission
 */
export function hasPermission(permission: string): boolean {
  const user = getActiveUser();
  if (user?.is_active === false) return false;

  // 1. Explicit per-user revoked permission takes precedence
  if (user?.revoked_permissions?.includes(permission)) return false;

  // 2. Explicit per-user granted permission
  if (user?.custom_permissions?.includes(permission)) return true;

  const role = getActiveRole();
  if (role === "Admin") return true;

  if (user?.permissions?.includes(permission)) return true;
  if (permission.includes(":read") && user?.permissions?.includes(permission.replace(":read", ":view"))) return true;
  if (permission.includes(":view") && user?.permissions?.includes(permission.replace(":view", ":read"))) return true;

  return false;
}

/**
 * Check if active user has one of the allowed roles
 */
export function hasAnyRole(roles: UserRole[]): boolean {
  const currentRole = getActiveRole();
  if (currentRole === "Admin") return true;
  return roles.includes(currentRole);
}

/**
 * Check if current user is allowed to view general employee directory / other employees
 */
export function canViewAllEmployees(): boolean {
  const role = getActiveRole();
  return role === "Admin" || role === "HR_Manager" || role === "Department_Head" || role === "Project_Manager";
}

/**
 * Log out active user and clear session storage
 */
export function logoutUser(router?: any): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("ems_intentional_logout", "true");
      sessionStorage.setItem("ems_logged_out", "true");
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE);
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      // Preserve active theme without jarring flip (defaults to light)
      const currentTheme = getInitialTheme();
      applyTheme(currentTheme);
    } catch (e) {}

    if (router && typeof router.replace === "function") {
      router.replace("/login");
      setTimeout(() => {
        try {
          window.dispatchEvent(new Event("ems_auth_changed"));
        } catch (e) {}
      }, 50);
    } else {
      window.dispatchEvent(new Event("ems_auth_changed"));
      window.location.replace("/login");
    }
  }
}

/**
 * Authenticate with corporate email and password.
 * If backend mode is active (Java / Python), calls real /auth/login endpoint.
 * Otherwise, verifies against mock credentials.
 */
export async function authenticateWithCredentials(
  email: string,
  password: string
): Promise<{ ok: boolean; user?: UserProfile; isPending?: boolean; message: string }> {
  const trimmedEmail = email.trim().toLowerCase();

  // ── 1. Real Backend Mode (Java or Python) ───────────────────────────────────
  if (!isMockData()) {
    try {
      const res = await api.auth.login({ email: trimmedEmail, password });
      const normalized = normalizeUserProfile(res.user);
      const isPending = !normalized.roles || normalized.roles.length === 0;

      if (typeof window !== "undefined") {
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(normalized));
        if (!isPending && normalized.roles[0]?.role_name) {
          localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE, normalized.roles[0].role_name);
        }
        applyTheme(getInitialTheme());
        window.dispatchEvent(new Event("ems_auth_changed"));
      }
      return { ok: true, user: normalized, isPending, message: "Authentication successful" };
    } catch (err: any) {
      return { ok: false, message: err.message || "Invalid corporate credentials. Please verify your email and password." };
    }
  }

  // ── 2. Mock Standalone Mode ──────────────────────────────────────────────────
  const seeded = MOCK_USER_CREDENTIALS.find(
    (c) => c.email.toLowerCase() === trimmedEmail && c.password === password
  );

  if (seeded) {
    const user = MOCK_USERS_BY_ROLE[seeded.role];
    if (typeof window !== "undefined") {
      const mockRole = user.roles[0]?.role_name || "Employee";
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE, mockRole);
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, createMockJwt(user.public_id, mockRole));
      window.dispatchEvent(new Event("ems_auth_changed"));
    }
    return { ok: true, user, isPending: false, message: "Authentication successful" };
  }

  // Dynamic registered users in localStorage
  if (typeof window !== "undefined") {
    try {
      const dynamicUsersRaw = localStorage.getItem("ems_registered_users");
      if (dynamicUsersRaw) {
        const dynamicUsers: { email: string; password: string; user: UserProfile }[] = JSON.parse(dynamicUsersRaw);
        const match = dynamicUsers.find(
          (u) => u.email.toLowerCase() === trimmedEmail && u.password === password
        );
        if (match) {
          const isPending = !match.user.roles || match.user.roles.length === 0;
          const mockRole = match.user.roles[0]?.role_name || "Employee";
          localStorage.setItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(match.user));
          if (!isPending) {
            localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE, mockRole);
          }
          localStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, createMockJwt(match.user.public_id, mockRole));
          window.dispatchEvent(new Event("ems_auth_changed"));
          return { ok: true, user: match.user, isPending, message: "Authentication successful" };
        }
      }
    } catch (e) {}
  }

  return { ok: false, message: "Invalid corporate email or password. Please verify your credentials." };
}

/**
 * Register a new user with verified email OTP
 */
export async function registerNewUser(
  displayName: string,
  email: string,
  password: string,
  otp?: string
): Promise<{ ok: boolean; user?: UserProfile; message: string }> {
  if (!isMockData()) {
    try {
      const res = await api.auth.signup({
        email: email.trim().toLowerCase(),
        display_name: displayName.trim(),
        password,
        otp: otp || "123456",
      });
      const normalized = normalizeUserProfile(res.user);
      return { ok: true, user: normalized, message: "Registration successful" };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to register account" };
    }
  }

  // Mock standalone registration
  const publicId = `usr-reg-${Date.now()}`;
  const newUser: UserProfile = {
    public_id: publicId,
    email: email.trim().toLowerCase(),
    display_name: displayName.trim(),
    is_active: true,
    is_verified: true,
    employee_public_id: null,
    roles: [],
    permissions: [],
    created_at: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("ems_registered_users");
      const list = raw ? JSON.parse(raw) : [];
      list.push({ email: newUser.email, password, user: newUser });
      localStorage.setItem("ems_registered_users", JSON.stringify(list));

      const rawPending = localStorage.getItem("ems_pending_users");
      const pendingList = rawPending ? JSON.parse(rawPending) : [];
      pendingList.push({ email: newUser.email, password, user: newUser });
      localStorage.setItem("ems_pending_users", JSON.stringify(pendingList));
    } catch (e) {}
  }

  return { ok: true, user: newUser, message: "Account registered successfully" };
}

/**
 * Synchronize the current user profile, role, and linked employee from backend
 */
export async function syncCurrentUser(): Promise<UserProfile | null> {
  if (typeof window === "undefined" || isMockData()) return null;
  const token = localStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  if (!token) return null;
  try {
    const latest = await api.auth.getMe();
    if (latest && latest.public_id) {
      const normalized = normalizeUserProfile(latest);
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(normalized));
      if (normalized.roles && normalized.roles.length > 0) {
        const primary = typeof normalized.roles[0] === "string" ? normalized.roles[0] : (normalized.roles[0]?.role_name || "Employee");
        localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACTIVE_ROLE, primary);
      }
      window.dispatchEvent(new Event("ems_auth_changed"));
      return normalized;
    }
  } catch (err) {
    // Network or temporary failure
  }
  return null;
}

/**
 * Reactive unified authentication hook
 */
export function useAuth() {
  const [role, setRole] = useState<UserRole>(SSR_DEFAULT_ROLE);
  const [user, setUser] = useState<UserProfile>(SSR_DEFAULT_USER);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentRole = getActiveRole();
    const currentUser = getActiveUser();
    setRole(currentRole);
    setUser(currentUser);

    // Sync latest user role & permissions from backend on mount
    if (!isMockData()) {
      syncCurrentUser().then((synced) => {
        if (synced) {
          setUser(synced);
          setRole(getActiveRole());
        }
      });
    }

    const handleSync = () => {
      setRole(getActiveRole());
      setUser(getActiveUser());
    };

    window.addEventListener("ems_auth_changed", handleSync);
    window.addEventListener("ems_role_changed", handleSync);
    window.addEventListener("ems_backend_changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("ems_auth_changed", handleSync);
      window.removeEventListener("ems_role_changed", handleSync);
      window.removeEventListener("ems_backend_changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const isPending = !user?.roles || user.roles.length === 0;
  const isAdmin = role === "Admin" || (user?.roles?.some((r: any) => (typeof r === "string" ? r : r?.role_name) === "Admin") ?? false);
  const isHR = isAdmin || role === "HR_Manager" || (user?.roles?.some((r: any) => (typeof r === "string" ? r : r?.role_name) === "HR_Manager") ?? false);

  return {
    role,
    user,
    mounted,
    isEmployee: role === "Employee" && !isAdmin && !isHR,
    isAdmin,
    isHR,
    isPendingOnboarding: isPending,
    logout: logoutUser,
  };
}

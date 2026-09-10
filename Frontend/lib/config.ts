/**
 * Employee Management System - Master Configuration
 */

export type BackendType = "java" | "python" | "mock";

export const API_CONFIG = {
  APP_NAME: "Employee Management System",
  APP_SHORT_NAME: "EMS Portal",
  VERSION: "2.0.0",

  STORAGE_KEYS: {
    AUTH_TOKEN: "ems_access_token",
    REFRESH_TOKEN: "ems_refresh_token",
    CURRENT_USER: "ems_current_user",
    ACTIVE_ROLE: "ems_active_role",
    THEME: "ems_theme_preference",
    BACKEND_TARGET: "ems_backend_target",
  },

  get USE_MOCK_DATA(): boolean {
    return false;
  },

  get BASE_URL(): string {
    return getBaseUrl();
  },
};

/**
 * Retrieve the active backend target (locked to Python FastAPI backend)
 */
export function getActiveBackend(): BackendType {
  return "python";
}

/**
 * Set the active backend target (locked to Python FastAPI backend)
 */
export function setActiveBackend(_target?: BackendType): void {
  // Dedicated Python backend
}

/**
 * Check if the active configuration is running in standalone mock mode
 */
export function isMockData(): boolean {
  return false;
}

/**
 * Get active backend base URL (Python FastAPI backend).
 * Routes via the Next.js Reverse Proxy (/api/proxy) to keep backend
 * infrastructure private, hide raw hostnames, and eliminate CORS restrictions.
 */
export function getBaseUrl(): string {
  return "/api/proxy";
}


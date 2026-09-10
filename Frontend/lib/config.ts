/**
 * Employee Management System - Master Configuration & Dual-Backend Switcher
 * 
 * Supports:
 * 1. "java"   -> Java Spring Boot (http://localhost:8080)
 * 2. "python" -> Python FastAPI (http://localhost:8000)
 * 3. "mock"   -> Standalone in-memory mock demo mode
 */

export type BackendType = "java" | "python" | "mock";

export const BACKEND_SERVERS: Record<"java" | "python", { name: string; url: string; port: number; icon: string }> = {
  java: {
    name: "Java Spring Boot",
    url: process.env.NEXT_PUBLIC_JAVA_BACKEND_URL || "http://localhost:8080",
    port: 8080,
    icon: "☕",
  },
  python: {
    name: "Python FastAPI",
    url: process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "http://localhost:8000",
    port: 8000,
    icon: "🐍",
  },
};

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
    return isMockData();
  },

  get BASE_URL(): string {
    return getBaseUrl();
  },
};

/**
 * Retrieve the active backend target ("java" | "python" | "mock")
 * Defaults to "python" or "java" if backend mode is preferred, or "mock" if offline.
 */
export function getActiveBackend(): BackendType {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(API_CONFIG.STORAGE_KEYS.BACKEND_TARGET) as BackendType | null;
      if (stored && (stored === "java" || stored === "python" || stored === "mock")) {
        return stored;
      }
    } catch (e) {}
  }
  return "python";
}

/**
 * Set the active backend target and notify listeners
 */
export function setActiveBackend(target: BackendType): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(API_CONFIG.STORAGE_KEYS.BACKEND_TARGET, target);
      window.dispatchEvent(new CustomEvent("ems_backend_changed", { detail: { target } }));
    } catch (e) {}
  }
}

/**
 * Check if the active configuration is running in standalone mock mode
 */
export function isMockData(): boolean {
  return getActiveBackend() === "mock";
}

/**
 * Get active backend base URL
 */
export function getBaseUrl(): string {
  const backend = getActiveBackend();
  if (backend === "java") return BACKEND_SERVERS.java.url;
  if (backend === "python") return BACKEND_SERVERS.python.url;
  return BACKEND_SERVERS.python.url;
}

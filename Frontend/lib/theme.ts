/**
 * Theme Management (Dark & Light Mode)
 * 
 * 🎓 LEARNING NOTE:
 * Dark/Light mode is powered by setting `data-theme="dark"` or `data-theme="light"`
 * on the <html> root element. All CSS variables automatically update instantly.
 */

import { API_CONFIG } from "./config";

export type Theme = "dark" | "light";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const savedTheme = localStorage.getItem(API_CONFIG.STORAGE_KEYS.THEME) as Theme | null;
  if (savedTheme === "dark") {
    return "dark";
  }

  return "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.backgroundColor = "#080914";
    document.documentElement.style.colorScheme = "dark";
  } else {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.backgroundColor = "#f8fafc";
    document.documentElement.style.colorScheme = "light";
  }
  localStorage.setItem(API_CONFIG.STORAGE_KEYS.THEME, theme);
  window.dispatchEvent(new CustomEvent("ems_theme_changed", { detail: { theme } }));
}

export function toggleTheme(): Theme {
  const current = (document.documentElement.getAttribute("data-theme") as Theme) || getInitialTheme();
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

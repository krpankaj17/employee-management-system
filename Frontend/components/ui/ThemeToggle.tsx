"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getInitialTheme, toggleTheme, applyTheme, Theme } from "@/lib/theme";

/**
 * ThemeToggle Component
 * Allows user to seamlessly toggle between Dark and Light mode
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);

    const handleThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setTheme(e.detail.theme);
        document.documentElement.setAttribute("data-theme", e.detail.theme);
      }
    };

    window.addEventListener("ems_theme_changed", handleThemeChange);
    return () => window.removeEventListener("ems_theme_changed", handleThemeChange);
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  if (!mounted) {
    return <div style={{ width: 38, height: 38 }} />;
  }

  return (
    <button
      onClick={handleToggle}
      className="btn btn-ghost"
      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
      aria-label="Toggle theme"
      style={{
        width: 38,
        height: 38,
        padding: 0,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-elevated)",
      }}
    >
      {theme === "dark" ? (
        <Sun size={18} style={{ color: "var(--color-amber-400)" }} />
      ) : (
        <Moon size={18} style={{ color: "var(--color-primary-500)" }} />
      )}
    </button>
  );
}

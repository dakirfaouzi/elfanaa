"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useAdminPrefs } from "./AdminPrefs";

/**
 * Tri-state theme toggle: Light → Dark → System → Light.
 *
 * Hydration safety
 * ────────────────
 * On the server we render the same icon regardless of theme so the
 * SSR output matches the first client render byte-for-byte.  The icon
 * then updates after mount via `useEffect` once the prefs context
 * publishes the persisted preference.  This avoids React's
 * "text content did not match" hydration warning and the brief
 * flicker that comes with it.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useAdminPrefs();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const labelFor = (t: "light" | "dark" | "system") =>
    t === "light" ? "Switch to dark theme" : t === "dark" ? "Switch to system theme" : "Switch to light theme";

  const icon = !mounted ? <Sun size={16} /> : theme === "light" ? <Sun size={16} /> : theme === "dark" ? <Moon size={16} /> : <Monitor size={16} />;

  return (
    <button
      type="button"
      className="fa-icon-btn fa-theme-toggle"
      onClick={cycle}
      aria-label={mounted ? labelFor(theme) : "Theme"}
      title={mounted ? labelFor(theme) : "Theme"}
      data-mode={mounted ? theme : "light"}
    >
      {icon}
    </button>
  );
}

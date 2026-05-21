"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSWRConfig } from "swr";

/**
 * Admin preferences — the small bag of user-facing UI state that needs
 * to live above every page (theme, auto-refresh cadence, refresh stamp).
 *
 * Strict scope
 * ────────────
 * This file owns ONLY presentation concerns:
 *   • The current theme ('light' | 'dark' | 'system').
 *   • The auto-refresh interval (off | 30s | 1m | 5m).
 *   • The "last refreshed at" timestamp, updated whenever a manual or
 *     automatic refresh fires.
 *
 * It does NOT touch any business logic, API endpoint, payload shape,
 * routing, or auth.  The "refresh" action is a thin wrapper over SWR's
 * global `mutate()` — it tells SWR to revalidate every key matching
 * `/api/admin/*`, which causes every admin page that uses
 * `useSWR(adminFetcher)` to refetch.  No fetch logic changes.
 *
 * Persistence
 * ───────────
 * Theme is persisted to `localStorage` under `fa-theme` and applied
 * synchronously by the bootstrap script in `app/admin/layout.tsx`
 * (zero FOUC).  The auto-refresh interval is persisted under
 * `fa-refresh-interval`.  Both are wrapped in `try/catch` to tolerate
 * private-browsing and ITP edge cases without crashing the admin.
 */

type Theme = "light" | "dark" | "system";
type Interval = 0 | 30 | 60 | 300;

const THEME_KEY = "fa-theme";
const INTERVAL_KEY = "fa-refresh-interval";

type Ctx = {
  theme: Theme;
  /** Effective theme actually applied (system → light or dark). */
  resolvedTheme: "light" | "dark";
  setTheme: (next: Theme) => void;

  interval: Interval;
  setInterval: (next: Interval) => void;

  refreshing: boolean;
  /**
   * Timestamp of the most recent successful refresh trigger.  Display
   * components turn this into "Updated 2 min ago".  Updated optimistically
   * — the value is set *before* SWR finishes revalidating because we want
   * the visual feedback to fire instantly.  If we relied on individual
   * SWR `onSuccess` callbacks we'd race with multiple endpoints and the
   * label would flicker.
   */
  lastRefreshedAt: number;
  refresh: () => void;
};

const AdminPrefsCtx = createContext<Ctx | null>(null);

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

function readSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyThemeAttr(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-fa-theme", resolved);
}

export function AdminPrefsProvider({ children }: { children: ReactNode }) {
  /* ── Theme ──────────────────────────────────────────────────── */

  // We deliberately default to "system" on the server so SSR is
  // deterministic; the real preference is read in the effect below.
  // The bootstrap script in layout.tsx has already applied the
  // correct attribute so there is no visual flash.
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = safeGet(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setThemeState(saved);
    }
    setSystemTheme(readSystemTheme());
  }, []);

  // Live system-theme sync so a user changing OS theme while the admin
  // is open updates immediately (only when explicit preference is
  // "system" — fixed light/dark choices are obeyed).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyThemeAttr(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    safeSet(THEME_KEY, next);
  }, []);

  /* ── Refresh + auto-refresh ─────────────────────────────────── */

  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [interval, setIntervalState] = useState<Interval>(0);

  useEffect(() => {
    const saved = safeGet(INTERVAL_KEY);
    if (saved === "30" || saved === "60" || saved === "300" || saved === "0") {
      setIntervalState(Number(saved) as Interval);
    }
  }, []);

  /**
   * Mutate every SWR key whose URL starts with `/api/admin/`.
   * Returning a thenable lets us toggle the spinner state until the
   * underlying fetches resolve.  Errors are swallowed: SWR surfaces
   * them via each hook's own `error` field, so this control should
   * not double-render an error UI of its own.
   */
  const triggerRefresh = useCallback(() => {
    setLastRefreshedAt(Date.now());
    setRefreshing(true);
    Promise.resolve(
      mutate(
        (key) => typeof key === "string" && key.startsWith("/api/admin/"),
        undefined,
        { revalidate: true }
      )
    )
      .catch(() => {
        /* SWR surfaces errors per-hook. */
      })
      .finally(() => {
        // Show the spin for at least one full rotation so a fast cache
        // hit doesn't look like the click did nothing.
        window.setTimeout(() => setRefreshing(false), 600);
      });
  }, [mutate]);

  // Auto-refresh timer.  We use a single setInterval ref-counted by
  // the chosen cadence; cleaning it up on cadence change is critical
  // to avoid double-fires.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (interval > 0) {
      timerRef.current = window.setInterval(() => {
        // Skip the refresh if the page is hidden (background tab on
        // mobile, switched apps).  Saves data and avoids waking the
        // backend for nothing.
        if (typeof document !== "undefined" && document.hidden) return;
        triggerRefresh();
      }, interval * 1000);
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [interval, triggerRefresh]);

  const setInterval = useCallback((next: Interval) => {
    setIntervalState(next);
    safeSet(INTERVAL_KEY, String(next));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      interval,
      setInterval,
      refreshing,
      lastRefreshedAt,
      refresh: triggerRefresh,
    }),
    [theme, resolvedTheme, setTheme, interval, setInterval, refreshing, lastRefreshedAt, triggerRefresh]
  );

  return <AdminPrefsCtx.Provider value={value}>{children}</AdminPrefsCtx.Provider>;
}

export function useAdminPrefs(): Ctx {
  const ctx = useContext(AdminPrefsCtx);
  if (!ctx) {
    // Defensive default — if a component is ever rendered outside the
    // provider (legacy/test/storybook), it gets a no-op shape so it
    // doesn't crash the whole admin.
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => undefined,
      interval: 0,
      setInterval: () => undefined,
      refreshing: false,
      lastRefreshedAt: Date.now(),
      refresh: () => undefined,
    };
  }
  return ctx;
}

/* ────────────────────────────────────────────────────────────────
 * Small helper: format a timestamp as "Updated 2 min ago" using a
 * cheap epoch-diff (no date-fns dependency on the hot path).
 * Component callers re-run this on a 30-second interval to keep the
 * label fresh.
 * ──────────────────────────────────────────────────────────────── */

export function formatStampAgo(ts: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

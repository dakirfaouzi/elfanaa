"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ChevronDown, Check, Zap } from "lucide-react";
import { formatStampAgo, useAdminPrefs } from "./AdminPrefs";

/**
 * Premium refresh control inspired by Meta Ads Manager / Stripe /
 * Vercel Analytics.
 *
 * Three pieces, all driven by `useAdminPrefs()`:
 *   1. Refresh button — fires `refresh()` which triggers SWR `mutate`
 *      across every `/api/admin/*` key.  Spins while pending.
 *   2. "Updated 2 min ago" stamp — derived from `lastRefreshedAt`,
 *      re-rendered every 30 seconds so the label stays current
 *      without subscribing to a global timer.
 *   3. Auto-refresh interval menu — off / 30s / 1m / 5m, persisted to
 *      localStorage.  When > 0 the prefs context owns the
 *      `setInterval` and re-fires `refresh()` on cadence.
 *
 * No business logic, no API contract changes.  This control purely
 * tells SWR to revalidate its existing cache keys.
 */

const INTERVAL_OPTIONS: Array<{ value: 0 | 30 | 60 | 300; label: string }> = [
  { value: 0, label: "Off" },
  { value: 30, label: "Every 30 sec" },
  { value: 60, label: "Every 1 min" },
  { value: 300, label: "Every 5 min" },
];

export function RefreshControl() {
  const { refresh, refreshing, lastRefreshedAt, interval, setInterval } = useAdminPrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Keep "X min ago" label fresh — but only when something is mounted
  // and visible.  30s cadence is enough to feel live without burning
  // a render on every tick.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Close the interval menu on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      const target = e.target as Node | null;
      if (target && wrapperRef.current.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const stamp = formatStampAgo(lastRefreshedAt);
  const activeInterval = INTERVAL_OPTIONS.find((o) => o.value === interval) ?? INTERVAL_OPTIONS[0];

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="fa-refresh-stamp" aria-live="polite">
        Updated {stamp}
      </span>

      <div className="fa-refresh" role="group" aria-label="Refresh data">
        <button
          type="button"
          className="fa-refresh-btn"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh dashboard data"
          data-spinning={refreshing ? "true" : "false"}
        >
          <RefreshCw />
          <span>Refresh</span>
        </button>
        <span className="fa-refresh-divider" aria-hidden />
        <button
          type="button"
          className="fa-refresh-interval"
          data-active={interval > 0 ? "true" : "false"}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Auto-refresh interval"
        >
          {interval > 0 ? (
            <Zap size={12} style={{ marginRight: 4 }} />
          ) : null}
          <span>{shortLabel(activeInterval.value)}</span>
          <ChevronDown size={12} style={{ marginLeft: 4 }} />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Auto-refresh interval"
          className="fa-card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 200,
            padding: 6,
            zIndex: 40,
            boxShadow: "var(--fa-shadow-pop)",
          }}
        >
          <div className="fa-stack-sm" style={{ gap: 2 }}>
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={opt.value === interval}
                onClick={() => {
                  setInterval(opt.value);
                  setMenuOpen(false);
                }}
                className="fa-pill"
                data-active={opt.value === interval ? "true" : "false"}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingInline: 10,
                }}
              >
                <span>{opt.label}</span>
                {opt.value === interval ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function shortLabel(v: 0 | 30 | 60 | 300): string {
  if (v === 0) return "Auto";
  if (v === 30) return "30s";
  if (v === 60) return "1m";
  return "5m";
}

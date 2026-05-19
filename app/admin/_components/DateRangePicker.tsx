"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
] as const;

/**
 * Lightweight preset + custom range picker. Keeps state in the URL so
 * dashboards are deep-linkable and SSR-friendly. Falls back to "last_30"
 * when no range is set, matching the metrics layer's default.
 */
export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params?.get("range") ?? "last_30";
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(params?.get("from") ?? "");
  const [customTo, setCustomTo] = useState<string>(params?.get("to") ?? "");

  const apply = useCallback(
    (next: string, from?: string, to?: string) => {
      const sp = new URLSearchParams(params?.toString());
      sp.set("range", next);
      if (next === "custom" && from && to) {
        sp.set("from", from);
        sp.set("to", to);
      } else {
        sp.delete("from");
        sp.delete("to");
      }
      router.replace(`${pathname}?${sp.toString()}`);
      setOpen(false);
    },
    [params, pathname, router]
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="fa-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={14} />
        {PRESETS.find((p) => p.id === current)?.label ?? "Custom"}
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          {/* Invisible click-catcher — closes the popover when the user
           * taps anywhere outside.  Keyed below the dialog so the
           * dialog itself remains interactive.  Lives under the
           * sticky topbar (z-index 30) but above page content. */}
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "default",
              zIndex: 38,
            }}
          />
          <div
            role="dialog"
            className="fa-card"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: "min(308px, calc(100vw - 32px))",
              zIndex: 39,
              padding: 12,
              boxShadow: "0 18px 40px -16px rgba(56, 40, 24, 0.22)",
            }}
          >
            <div className="fa-stack-sm">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="fa-pill"
                  data-active={p.id === current ? "true" : "false"}
                  onClick={() => apply(p.id)}
                  style={{ width: "100%", textAlign: "left" }}
                >
                  {p.label}
                </button>
              ))}
              <hr className="fa-rule" />
              <div className="fa-meta">Custom range</div>
              <input
                type="date"
                className="fa-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <input
                type="date"
                className="fa-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
              <button
                type="button"
                className="fa-btn"
                data-tone="primary"
                onClick={() => {
                  if (!customFrom || !customTo) return;
                  apply(
                    "custom",
                    new Date(customFrom).toISOString(),
                    new Date(customTo).toISOString()
                  );
                }}
              >
                Apply custom
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

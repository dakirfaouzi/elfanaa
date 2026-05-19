"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfYesterday,
  endOfYesterday,
  subDays,
  subMonths,
} from "date-fns";
import { Calendar } from "./calendar/Calendar";

/**
 * Premium analytics date-range control.
 *
 * UX contract (matches Meta Ads Manager / Stripe / Shopify Analytics):
 *   • Trigger button shows the active range label (e.g. "Last 30 days"
 *     or "Jan 12 – Feb 10").
 *   • Popover on desktop (anchored to the trigger, right-aligned to
 *     avoid clipping the viewport edge) with a left-rail of presets
 *     and a right-pane calendar for custom ranges.
 *   • Bottom-sheet on mobile (< 640px) with a drag handle, identical
 *     internal layout in a single column.
 *   • Esc / click-outside / Apply / preset selection all close.
 *   • Auto-applies presets immediately (no extra click).
 *   • Custom range applies on Apply only — gives the user a chance to
 *     finish picking both endpoints.
 *
 * URL contract (unchanged)
 * ────────────────────────
 * The backend's `lib/admin/date-range.ts` understands these
 * `?range=` values: today, yesterday, last_7, last_30, last_90, custom.
 * Adding new presets (this_month, last_month, all_time) is done
 * entirely on the client by resolving them to a `custom` range with
 * explicit `from` / `to` ISO timestamps — no backend changes needed.
 */

type PresetId =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "this_month"
  | "last_month"
  | "last_90"
  | "all_time"
  | "custom";

type PresetDef = {
  id: PresetId;
  label: string;
  /** When set, applies as a backend-recognised range= preset. */
  serverPreset?: "today" | "yesterday" | "last_7" | "last_30" | "last_90";
  /** Resolves a [from, to] pair on the client for custom-only presets. */
  resolve?: () => { from: Date; to: Date };
};

const PRESETS: PresetDef[] = [
  { id: "today", label: "Today", serverPreset: "today" },
  { id: "yesterday", label: "Yesterday", serverPreset: "yesterday" },
  { id: "last_7", label: "Last 7 days", serverPreset: "last_7" },
  { id: "last_30", label: "Last 30 days", serverPreset: "last_30" },
  {
    id: "this_month",
    label: "This month",
    resolve: () => {
      const now = new Date();
      return { from: startOfMonth(now), to: endOfDay(now) };
    },
  },
  {
    id: "last_month",
    label: "Last month",
    resolve: () => {
      const ref = subMonths(new Date(), 1);
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    },
  },
  { id: "last_90", label: "Last 90 days", serverPreset: "last_90" },
  {
    id: "all_time",
    label: "All time",
    // A start-of-2024 floor is more than enough for any current
    // Elfanaa data window — keeps the URL human-friendly without
    // sending an absurd 1970 date.
    resolve: () => ({ from: new Date(Date.UTC(2024, 0, 1)), to: endOfDay(new Date()) }),
  },
];

function labelFromUrl(searchParams: URLSearchParams): string {
  const range = searchParams.get("range");
  if (!range || range === "last_30") return "Last 30 days";
  const preset = PRESETS.find((p) => p.id === range || p.serverPreset === range);
  if (preset && preset.id !== "custom") return preset.label;
  if (range === "custom") {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) {
      try {
        const a = format(new Date(from), "MMM d");
        const b = format(new Date(to), "MMM d");
        return a === b ? a : `${a} – ${b}`;
      } catch {
        /* fall through */
      }
    }
    return "Custom range";
  }
  return "Last 30 days";
}

function detectActivePreset(searchParams: URLSearchParams): PresetId {
  const range = searchParams.get("range");
  if (!range) return "last_30";
  if (range === "custom") {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) {
      const f = new Date(from);
      const t = new Date(to);
      // Try to recognise client-only presets by comparing the dates
      // to their generated boundaries.  Tolerance of one minute
      // accounts for clock drift between picker open + apply.
      for (const p of PRESETS) {
        if (!p.resolve) continue;
        const guess = p.resolve();
        if (
          Math.abs(guess.from.getTime() - f.getTime()) < 60_000 &&
          Math.abs(guess.to.getTime() - t.getTime()) < 60_000
        ) {
          return p.id;
        }
      }
      return "custom";
    }
    return "custom";
  }
  const match = PRESETS.find((p) => p.serverPreset === range);
  return match ? match.id : "last_30";
}

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState(false);

  // Local working-copy of the picked range so the user can experiment
  // without thrashing the URL on every click.  Committed only on
  // preset selection (immediately) or Apply (for custom).
  const [draft, setDraft] = useState<{ from: Date | null; to: Date | null }>(() => readDraftFromUrl(params));

  // Re-sync the draft if the URL changes externally (back/forward, deep link).
  useEffect(() => {
    setDraft(readDraftFromUrl(params));
  }, [params]);

  const activePreset = useMemo(
    () => detectActivePreset(new URLSearchParams(params?.toString())),
    [params]
  );

  const triggerLabel = useMemo(
    () => labelFromUrl(new URLSearchParams(params?.toString())),
    [params]
  );

  /* ── URL mutation helpers ──────────────────────────────────── */

  const commit = useCallback(
    (next: { preset: string; from?: string; to?: string }) => {
      const sp = new URLSearchParams(params?.toString());
      sp.set("range", next.preset);
      if (next.preset === "custom" && next.from && next.to) {
        sp.set("from", next.from);
        sp.set("to", next.to);
      } else {
        sp.delete("from");
        sp.delete("to");
      }
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router]
  );

  const applyPreset = useCallback(
    (p: PresetDef) => {
      if (p.serverPreset) {
        commit({ preset: p.serverPreset });
      } else if (p.resolve) {
        const { from, to } = p.resolve();
        commit({
          preset: "custom",
          from: from.toISOString(),
          to: to.toISOString(),
        });
      }
      setOpen(false);
    },
    [commit]
  );

  const applyCustom = useCallback(() => {
    if (!draft.from || !draft.to) return;
    commit({
      preset: "custom",
      from: startOfDay(draft.from).toISOString(),
      to: endOfDay(draft.to).toISOString(),
    });
    setOpen(false);
  }, [draft, commit]);

  /* ── Outside-click & Escape ────────────────────────────────── */

  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      const target = e.target as Node | null;
      if (target && rootRef.current.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* ── Body-scroll lock while the mobile sheet is open ───────── */

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div ref={rootRef} className="fa-daterange" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="fa-btn fa-daterange-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={14} />
        <span>{triggerLabel}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          {/* Overlay: invisible on desktop (click-catcher), dimmed
           * sheet backdrop on mobile.  CSS owns the visual difference. */}
          <button
            type="button"
            aria-hidden
            className="fa-daterange-overlay"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div role="dialog" aria-label="Date range" className="fa-daterange-pop">
            <div className="fa-daterange-sheet-handle" aria-hidden />

            <div className="fa-daterange-presets" role="listbox" aria-label="Date presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-active={p.id === activePreset ? "true" : "false"}
                  role="option"
                  aria-selected={p.id === activePreset}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="fa-daterange-cal">
              <Calendar value={draft} onChange={setDraft} maxDate={endOfDay(new Date())} />

              <div className="fa-daterange-footer">
                <div className="fa-meta">
                  {draft.from
                    ? draft.to && draft.to.getTime() !== draft.from.getTime()
                      ? `${format(draft.from, "MMM d, yyyy")} – ${format(draft.to, "MMM d, yyyy")}`
                      : format(draft.from, "MMM d, yyyy")
                    : "Pick start & end dates"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="fa-btn"
                    data-tone="ghost"
                    onClick={() => setOpen(false)}
                    aria-label="Cancel"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="fa-btn"
                    data-tone="primary"
                    onClick={applyCustom}
                    disabled={!draft.from || !draft.to}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function readDraftFromUrl(
  params: URLSearchParams | null | ReadonlyURLSearchParams
): { from: Date | null; to: Date | null } {
  const sp = new URLSearchParams(params?.toString());
  if (sp.get("range") === "custom") {
    const from = sp.get("from");
    const to = sp.get("to");
    return {
      from: from ? safeDate(from) : null,
      to: to ? safeDate(to) : null,
    };
  }
  return { from: null, to: null };
}

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Type alias so `readDraftFromUrl` accepts both Next's read-only and
// Web's mutable URLSearchParams without importing the type from next.
type ReadonlyURLSearchParams = {
  toString(): string;
  get(name: string): string | null;
};

// Suppress unused-import warning if we ever drop the helper.
void subDays;
void startOfYesterday;
void endOfYesterday;

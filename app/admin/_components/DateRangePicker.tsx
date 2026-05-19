"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
 *   • Popover on desktop, portaled to <body> with viewport-aware
 *     collision detection — flips above the trigger when there is no
 *     room below, and clamps horizontally so it never escapes the
 *     viewport.
 *   • Bottom-sheet on mobile (< 640px) anchored to the bottom of the
 *     viewport, with a drag handle and the same internal layout in a
 *     single column.  CSS owns the bottom-sheet position; the JS
 *     positioner skips inline coords on mobile.
 *   • Esc / click-outside / Apply / preset selection all close.
 *   • Auto-applies presets immediately (no extra click).
 *   • Custom range applies on Apply only — gives the user a chance to
 *     finish picking both endpoints.
 *
 * Why portal?
 * ───────────
 * The admin topbar uses `backdrop-filter`, which per CSS spec creates
 * a containing block for `position: fixed` descendants — without the
 * portal, the bottom-sheet would be clipped *inside* the topbar's
 * 64px-tall band on mobile.  Portaling to `document.body` lifts the
 * popover out of every ancestor's containing-block / overflow chain
 * so it can render anywhere on screen with predictable coordinates.
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

/** Computed coordinates for the desktop popover.  Mobile uses `null`
 *  so the CSS bottom-sheet rule owns positioning. */
type PopCoords = { top: number; left?: number; right?: number } | null;

const MOBILE_BREAKPOINT = 640;
const VIEWPORT_MARGIN = 16;

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState(false);

  // Avoid hydration mismatch — portals require `document` which
  // doesn't exist during SSR, so we only render the popover after
  // the first client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  /* ── Refs for trigger + portaled popover (used for click-outside,
   *    positioning, and scroll-aware re-layout). ──────────────── */

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  /* ── Outside-click & Escape ────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // "Inside" = either the trigger button (so toggling works) or
      // the portaled popover.  Anywhere else closes.
      if (triggerRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
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

  /* ── No body-scroll lock ─────────────────────────────────────
   *
   * The picker is a non-modal dropdown on every breakpoint.  Locking
   * page scroll while it's open prevents the user from scrolling the
   * dashboard underneath to reference figures while the calendar is
   * up — and creates a stutter when the dropdown re-positions itself
   * from a scroll event.  Click-outside / Escape still close it. */

  /* ── Collision-aware positioning ───────────────────────────── */

  const [coords, setCoords] = useState<PopCoords>(null);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    const compute = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

      // Mobile: anchored top dropdown — top from trigger, spanning the
      // viewport between left/right safe margins.  CSS `width: auto`
      // (forced via the < 640px media query) lets the box stretch.
      if (isMobile) {
        const top = Math.max(VIEWPORT_MARGIN, tr.bottom + 8);
        setCoords({ top, left: VIEWPORT_MARGIN, right: VIEWPORT_MARGIN });
        return;
      }

      // Desktop: collision-aware popover.
      // Width is capped to the popover's CSS max, then squeezed if the
      // viewport itself is narrower than that.
      const popW = Math.min(640, vw - VIEWPORT_MARGIN * 2);
      // Use measured height if available (after first paint); fall back
      // to a generous guess so the first frame still picks a plausible
      // side.  The next compute() pass after paint refines it.
      const popH = popRef.current?.offsetHeight ?? 460;

      // ── Vertical: prefer below; flip above only when below clips ──
      const spaceBelow = vh - tr.bottom - VIEWPORT_MARGIN;
      const spaceAbove = tr.top - VIEWPORT_MARGIN;

      let top: number;
      if (popH + 8 <= spaceBelow || spaceBelow >= spaceAbove) {
        // Below fits — or below has at least as much room as above.
        top = Math.min(tr.bottom + 8, vh - popH - VIEWPORT_MARGIN);
        if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
      } else {
        // Flip above.
        top = Math.max(VIEWPORT_MARGIN, tr.top - 8 - popH);
      }

      // ── Horizontal: anchor by the trigger's right edge.  If that
      //    would push the popover past the left viewport edge, switch
      //    to a left-anchor instead. ──
      const rightOffset = Math.max(VIEWPORT_MARGIN, vw - tr.right);
      const leftEdgeIfRightAnchored = vw - rightOffset - popW;

      let next: PopCoords;
      if (leftEdgeIfRightAnchored < VIEWPORT_MARGIN) {
        // Right-anchoring would clip the left side — left-anchor instead.
        let left = Math.max(VIEWPORT_MARGIN, tr.left);
        if (left + popW > vw - VIEWPORT_MARGIN) {
          left = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - popW);
        }
        next = { top, left };
      } else {
        next = { top, right: rightOffset };
      }
      setCoords(next);
    };

    // First measurement; refine again after the popover has actually
    // painted (so we have its real height for collision-flip logic).
    compute();
    const raf = requestAnimationFrame(compute);

    // Re-position on scroll (capture: any scrollable ancestor counts)
    // and resize, including the visual viewport changes that happen
    // when Chrome Android collapses its URL bar.
    window.addEventListener("scroll", compute, { capture: true, passive: true });
    window.addEventListener("resize", compute, { passive: true });
    window.visualViewport?.addEventListener("resize", compute);
    window.visualViewport?.addEventListener("scroll", compute);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", compute, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", compute);
      window.visualViewport?.removeEventListener("resize", compute);
      window.visualViewport?.removeEventListener("scroll", compute);
    };
  }, [open]);

  /* ── Render ────────────────────────────────────────────────── */

  // Inline style object — undefined keys are dropped (so when we choose
  // left-anchor, `right` is omitted and CSS doesn't see a stale value).
  const popStyle = coords
    ? {
        top: coords.top,
        ...(coords.right !== undefined ? { right: coords.right } : { right: "auto" as const }),
        ...(coords.left !== undefined ? { left: coords.left } : { left: "auto" as const }),
      }
    : undefined;

  return (
    <div className="fa-daterange" data-open={open ? "true" : "false"}>
      <button
        ref={triggerRef}
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

      {mounted && open
        ? createPortal(
            // `fa-admin` re-asserts the `--fa-*` token cascade inside
            // the portal subtree (the portal mounts to <body>, which
            // is OUTSIDE the .fa-admin tree where the variables are
            // defined).  Without this class, `rgb(var(--fa-surface))`
            // on the popover resolves to an invalid value and falls
            // back to transparent — which was the "invisible
            // popover" bug.  `.fa-daterange-portal` then neutralises
            // the layout side-effects `.fa-admin` would otherwise
            // impose (full-viewport gradient, min-height, etc.).
            <div className="fa-admin fa-daterange-portal" data-open="true">
              {/* Invisible click-catcher.  Always transparent — the
               *  picker is a non-modal dropdown, not a modal sheet,
               *  so the dashboard underneath must stay visible. */}
              <button
                type="button"
                aria-hidden
                className="fa-daterange-overlay"
                onClick={() => setOpen(false)}
                tabIndex={-1}
              />

              <div
                ref={popRef}
                role="dialog"
                aria-label="Date range"
                className="fa-daterange-pop"
                style={popStyle}
              >
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
            </div>,
            document.body
          )
        : null}
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

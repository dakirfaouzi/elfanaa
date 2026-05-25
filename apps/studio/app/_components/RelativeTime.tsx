"use client";

import { useEffect, useState } from "react";

/**
 * Relative-time renderer — "3 min ago", "yesterday", "in 2 hr".
 *
 * # SSR / hydration safety
 *
 * Computing "X seconds ago" depends on `Date.now()`, which differs
 * between SSR (a few hundred ms in the past) and the client's first
 * paint. Rendering the relative label on first render would therefore
 * cause a hydration mismatch — sometimes "5s ago" vs "6s ago", more
 * often a quietly-stale label.
 *
 * To avoid that, the component:
 *
 *   1. Renders an absolute ISO timestamp (locale-independent, fully
 *      deterministic between server and client) on its first paint.
 *   2. Sets `mounted` in a useEffect on the client, then re-renders
 *      with the relative label. The brief flash from absolute → "X
 *      min ago" is acceptable and matches the same pattern used in
 *      shadcn/ui and other mature React time components.
 *   3. Refreshes the relative label every `liveRefreshMs` so a long-
 *      mounted view (drafts list, builder save-status pill) updates
 *      without a page reload.
 *
 * # Hover affordance
 *
 * The full local-formatted timestamp is always available via the
 * `title` attribute (and as the inner text on first paint), so an
 * operator who needs the exact wall-clock time can hover.
 *
 * # Why a client component when most of the consumers are server-rendered
 *
 * Next.js streams the client bundle for any "use client" leaf. The
 * SSR HTML still ships with a useful default ("2026-05-25 12:33"),
 * and the relative upgrade happens during hydration. This is
 * preferable to either (a) doing the refresh purely in the parent
 * server component (no auto-refresh ever) or (b) computing relative
 * on the server and locking the operator into a snapshot-time view.
 */

export interface RelativeTimeProps {
  /** Timestamp to display relative to "now". Accepts ISO strings,
   *  epoch ms numbers, or Date instances. */
  value: string | Date | number;
  /** How often to recompute the relative label while mounted. 30s by
   *  default — sweet spot between freshness and React re-render cost
   *  on a busy list. Pass a smaller value for save-status pills (5s
   *  is responsive without being chatty). */
  liveRefreshMs?: number;
  /** Optional prefix (e.g. "Saved · "). Rendered inside the `<time>`. */
  prefix?: string;
  /** Optional suffix. */
  suffix?: string;
  /** Inline style passthrough — keeps consumer code free of wrapping
   *  divs when all they want is to tweak font-size/colour. */
  style?: React.CSSProperties;
  className?: string;
}

export function RelativeTime(props: RelativeTimeProps) {
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  const refreshMs = props.liveRefreshMs ?? 30_000;

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => force((n) => n + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const date = toDate(props.value);
  if (!Number.isFinite(date.getTime())) {
    // Defensive: avoid rendering "Invalid Date" to the operator.
    return <span className={props.className} style={props.style}>—</span>;
  }

  const absoluteIso = date.toISOString();
  const label = mounted ? formatRelative(date, Date.now()) : formatAbsoluteCompact(date);

  return (
    <time
      dateTime={absoluteIso}
      title={absoluteIso}
      className={props.className}
      style={props.style}
      suppressHydrationWarning
    >
      {props.prefix ?? ""}
      {label}
      {props.suffix ?? ""}
    </time>
  );
}

function toDate(value: string | Date | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return new Date(value);
}

/**
 * Locale-independent compact ISO ("YYYY-MM-DD HH:MM"). Used on first
 * paint so server and client render identical markup before the
 * client takes over with a relative label.
 */
function formatAbsoluteCompact(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

/**
 * Pure relative-time formatter. Exported under-name only to keep the
 * surface tight; tests can dynamic-import if needed.
 */
export function formatRelative(date: Date, now: number): string {
  const diffMs = now - date.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);

  const sec = Math.round(abs / 1000);
  if (sec < 5) return future ? "in a moment" : "just now";
  if (sec < 60) return future ? `in ${sec}s` : `${sec}s ago`;

  const min = Math.round(sec / 60);
  if (min < 60) return future ? `in ${min} min` : `${min} min ago`;

  const hr = Math.round(min / 60);
  if (hr < 24) return future ? `in ${hr} hr` : `${hr} hr ago`;

  const day = Math.round(hr / 24);
  if (day < 7) {
    return future
      ? `in ${day} day${day === 1 ? "" : "s"}`
      : `${day} day${day === 1 ? "" : "s"} ago`;
  }

  const week = Math.round(day / 7);
  if (week < 5) {
    return future
      ? `in ${week} week${week === 1 ? "" : "s"}`
      : `${week} week${week === 1 ? "" : "s"} ago`;
  }

  // Past five weeks: fall back to absolute date — relative loses
  // meaning at that distance and the operator wants an anchor.
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

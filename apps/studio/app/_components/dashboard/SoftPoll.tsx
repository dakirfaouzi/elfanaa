"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RelativeTime } from "../RelativeTime";

/**
 * Soft client-side refresher for the operator dashboard.
 *
 * # What it does
 *
 *   1. Every `intervalMs` (default 30s) calls `router.refresh()`,
 *      which re-runs the dashboard's server component and re-fetches
 *      the underlying data. The page hydrates with the new snapshot
 *      without a full navigation.
 *   2. Pauses while the tab is hidden (`document.visibilityState`)
 *      so a backgrounded dashboard doesn't pummel the DB.
 *   3. Surfaces a tiny "Updated Xs ago" indicator using the existing
 *      `<RelativeTime>` component so the operator knows the data
 *      isn't stuck.
 *
 * # Why client-side polling rather than SSE
 *
 * Per the C4 scope: NO SSE channel. A 30s soft poll is plenty for a
 * glance dashboard and adds zero new infrastructure. If/when the
 * operator team needs faster updates we'll layer SSE on top — until
 * then this is the lowest-blast-radius primitive that meets the brief.
 *
 * # Why a separate "Updated Xs ago" stamp instead of reusing the
 *   `lastRefreshedAt` returned from the server
 *
 * The server snapshot stamp is captured at server-render time. The
 * relative label is computed against the client's clock — which works
 * because `RelativeTime` handles SSR-safe hydration internally. So the
 * label automatically updates "Xs ago" every 30s without any extra
 * code in this component.
 */
export function SoftPoll(props: {
  /** Server-stamped wall-clock at the moment the page rendered.
   *  Drives the "Updated Xs ago" indicator. Passed as an ISO string
   *  so it's deterministic across server/client (matches RelativeTime's
   *  hydration contract). */
  renderedAt: string;
  /** Override the poll interval — exposed only so tests can stub a
   *  shorter window. Production uses the 30s default. */
  intervalMs?: number;
}) {
  const router = useRouter();
  const intervalMs = props.intervalMs ?? 30_000;
  // `useRef` guards against React 18 StrictMode double-invocation of
  // the effect cleanup — without it the effect rebinds the interval
  // twice on dev, doubling the refresh frequency.
  const cancelledRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    cancelledRef.current = false;

    function isHidden(): boolean {
      return typeof document !== "undefined" && document.visibilityState === "hidden";
    }

    function onVisibilityChange() {
      if (cancelledRef.current) return;
      if (isHidden()) {
        setPaused(true);
        return;
      }
      // Tab came back into focus — refresh immediately so the operator
      // doesn't have to stare at a stale snapshot for up to `intervalMs`.
      setPaused(false);
      router.refresh();
    }

    function tick() {
      if (cancelledRef.current) return;
      if (isHidden()) {
        setPaused(true);
        return;
      }
      router.refresh();
    }

    setPaused(isHidden());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "var(--text-faint)",
        letterSpacing: "0.04em",
      }}
      aria-live="polite"
    >
      <PulseDot paused={paused} />
      {paused ? (
        <span>Refresh paused</span>
      ) : (
        <RelativeTime
          value={props.renderedAt}
          liveRefreshMs={5_000}
          prefix="Updated "
          style={{ fontSize: 11, color: "var(--text-faint)" }}
        />
      )}
    </span>
  );
}

function PulseDot({ paused }: { paused: boolean }) {
  const colour = paused ? "var(--text-faint)" : "var(--success)";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: 999,
        background: colour,
        boxShadow: paused
          ? "none"
          : `0 0 0 3px color-mix(in srgb, ${colour} 22%, transparent)`,
      }}
    />
  );
}

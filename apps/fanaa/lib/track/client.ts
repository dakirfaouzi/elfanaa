/**
 * Tiny zero-dependency client tracker.
 *
 * Design constraints (in order):
 *   1. NEVER block render or interactivity.
 *   2. NEVER throw — if the dashboard is offline, the storefront keeps running.
 *   3. Use `sendBeacon` when the browser supports it so events survive
 *      tab close + back-button navigation.
 *   4. Auto-batch within a 1500ms window to keep request counts low.
 *
 * Public API:
 *   track(name, props?)      — fire-and-forget event
 *   trackPageView(path?)     — convenience wrapper
 *   identify(visitorId?)     — no-op stub for future ad-attribution work
 */

const ENDPOINT = "/api/track";
const BATCH_MS = 1500;

type EventPayload = {
  name: string;
  path?: string;
  productId?: string;
  productSlug?: string;
  surface?: string;
  value?: number;
  currency?: string;
  meta?: Record<string, unknown>;
  utm?: { source?: string; medium?: string; campaign?: string };
  referrer?: string;
  ts?: string;
};

let queue: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let bootstrapped = false;

function utmFromLocation(): EventPayload["utm"] {
  if (typeof window === "undefined") return undefined;
  const sp = new URLSearchParams(window.location.search);
  const out: EventPayload["utm"] = {};
  const s = sp.get("utm_source");
  const m = sp.get("utm_medium");
  const c = sp.get("utm_campaign");
  if (s) out.source = s;
  if (m) out.medium = m;
  if (c) out.campaign = c;
  return out.source || out.medium || out.campaign ? out : undefined;
}

function enrich(e: EventPayload): EventPayload {
  if (typeof window === "undefined") return e;
  return {
    ...e,
    path: e.path ?? window.location.pathname + window.location.search,
    referrer: e.referrer ?? document.referrer,
    utm: e.utm ?? utmFromLocation(),
    ts: e.ts ?? new Date().toISOString(),
  };
}

function flush(immediate = false) {
  if (!queue.length) return;
  const events = queue;
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const body = JSON.stringify({ events });
  try {
    if (immediate && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never throw */
  }
}

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => flush(false), BATCH_MS);
}

export function track(name: string, props: Omit<EventPayload, "name"> = {}) {
  if (typeof window === "undefined") return;
  try {
    queue.push(enrich({ name, ...props }));
    schedule();
  } catch {
    /* never throw */
  }
}

export function trackPageView(path?: string) {
  track("page_view", path ? { path } : {});
}

export function identify(_visitorId?: string) {
  // reserved for future ad-platform reconciliation
}

/** Auto-flush on page hide so events survive tab close. */
export function bootTracker() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  const onHide = () => flush(true);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("beforeunload", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

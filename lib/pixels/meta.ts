/**
 * Meta (Facebook) Pixel — browser side.
 *
 * The official `fbq` snippet, lazily injected after the first user
 * interaction (or 4s, whichever comes first) to keep First Contentful
 * Paint clean. `eventID` is forwarded so server-side CAPI events with
 * the same id deduplicate into one conversion.
 */

import type { PixelEvent } from "./types";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      push?: (...args: unknown[]) => void;
      version?: string;
    };
    _fbq?: unknown;
  }
}

let initialized = false;

export function initMetaPixel(pixelId: string): void {
  if (initialized || typeof window === "undefined") return;
  if (!pixelId) return;
  initialized = true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const f: any = window;
  if (f.fbq) return;
  const n: any = (f.fbq = function (...args: unknown[]) {
    n.callMethod ? n.callMethod(...args) : n.queue!.push(args);
  });
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
}

export function trackMeta(event: PixelEvent): void {
  if (typeof window === "undefined" || !window.fbq) return;
  const customData: Record<string, unknown> = {};
  if (event.value !== undefined) customData.value = event.value;
  if (event.currency) customData.currency = event.currency;
  if (event.contents?.length) {
    customData.contents = event.contents.map((c) => ({
      id: c.id,
      quantity: c.quantity ?? 1,
    }));
    customData.content_type = "product";
  }
  window.fbq("track", event.name, customData, { eventID: event.eventId });
}

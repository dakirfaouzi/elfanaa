/**
 * Snapchat Pixel — browser side.
 *
 * The official `snaptr` snippet. Snap event names use SCREAMING_SNAKE_CASE
 * (PURCHASE, ADD_CART). The third arg accepts a custom `event_id` for
 * server/browser dedup against the Conversions API.
 */

import type { PixelEvent } from "./types";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snaptr?: any;
  }
}

let initialized = false;

const NAME_MAP: Record<PixelEvent["name"], string> = {
  ViewContent: "VIEW_CONTENT",
  AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT",
  Purchase: "PURCHASE",
};

export function initSnapchatPixel(pixelId: string): void {
  if (initialized || typeof window === "undefined") return;
  if (!pixelId) return;
  initialized = true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  (function (e: any, t: any, n: any) {
    if (e.snaptr) return;
    const r: any = (e.snaptr = function (...args: any[]) {
      r.handleRequest ? r.handleRequest(...args) : r.queue.push(args);
    });
    r.queue = [];
    const s = "script";
    const a = t.createElement(s);
    a.async = true;
    a.src = n;
    const c = t.getElementsByTagName(s)[0];
    c?.parentNode?.insertBefore(a, c);
  })(w, document, "https://sc-static.net/scevent.min.js");
  /* eslint-enable @typescript-eslint/no-explicit-any */

  window.snaptr("init", pixelId);
  window.snaptr("track", "PAGE_VIEW");
}

export function trackSnapchat(event: PixelEvent): void {
  if (typeof window === "undefined" || !window.snaptr) return;
  const snapName = NAME_MAP[event.name];
  const props: Record<string, unknown> = {};
  if (event.value !== undefined) props.price = event.value;
  if (event.currency) props.currency = event.currency;
  if (event.contents?.length) {
    props.item_ids = event.contents.map((c) => c.id);
    props.number_items = event.contents.reduce(
      (acc, c) => acc + (c.quantity ?? 1),
      0
    );
  }
  // Snap accepts a third arg for `event_id` dedup.
  window.snaptr("track", snapName, props, { event_id: event.eventId });
}

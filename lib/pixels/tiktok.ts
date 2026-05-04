/**
 * TikTok Pixel — browser side.
 *
 * The official `ttq` snippet, lazy-loaded on first interaction. Event
 * names diverge from Meta (e.g. `CompletePayment`); we map at the
 * adapter boundary so `lib/pixels/index.ts` stays platform-agnostic.
 */

import type { PixelEvent } from "./types";

declare global {
  interface Window {
    // Untyped — TikTok's snippet is dynamic.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ttq?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TiktokAnalyticsObject?: any;
  }
}

let initialized = false;

const NAME_MAP: Record<PixelEvent["name"], string> = {
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "CompletePayment",
};

export function initTikTokPixel(pixelId: string): void {
  if (initialized || typeof window === "undefined") return;
  if (!pixelId) return;
  initialized = true;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  w.TiktokAnalyticsObject = "ttq";
  const ttq = (w.ttq = w.ttq || []);
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
  ];
  ttq.setAndDefer = function (t: any, e: any) {
    t[e] = function (...args: any[]) {
      t.push([e].concat(args));
    };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.instance = function (t: any) {
    const e = ttq._i[t] || [];
    for (const m of ttq.methods) ttq.setAndDefer(e, m);
    return e;
  };
  ttq.load = function (e: string, n?: any) {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[e] = [];
    ttq._i[e]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[e] = n || {};
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = `${url}?sdkid=${e}&lib=ttq`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(s, first);
  };
  ttq.load(pixelId);
  ttq.page();
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function trackTikTok(event: PixelEvent): void {
  if (typeof window === "undefined" || !window.ttq) return;
  const ttName = NAME_MAP[event.name];
  const props: Record<string, unknown> = {};
  if (event.value !== undefined) props.value = event.value;
  if (event.currency) props.currency = event.currency;
  if (event.contents?.length) {
    props.contents = event.contents.map((c) => ({
      content_id: c.id,
      content_name: c.name,
      quantity: c.quantity ?? 1,
      price: c.price,
    }));
  }
  window.ttq.track(ttName, props, { event_id: event.eventId });
}

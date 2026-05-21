/**
 * Thin analytics facade — the *single* place commerce events are emitted.
 *
 * Two layers ride underneath:
 *   1. **dataLayer** (GTM / GA4 enhanced ecommerce). Always populated;
 *      neutral shape that downstream tools can map however they like.
 *   2. **Pixel manager** (`lib/pixels`). For the four conversion-grade
 *      events (`view_item`, `add_to_cart`, `begin_checkout`, `place_order`)
 *      we mirror to Meta / TikTok / Snapchat with a shared `event_id`
 *      so server-side CAPI can deduplicate the pair.
 *
 * Components MUST NOT import `lib/pixels` directly. Going through this
 * facade means we can swap providers (Posthog, Segment, Rudderstack)
 * without touching the call sites.
 */

import type { Money, Product } from "./types";
import { newEventId, pixelTrack, type PixelEventName } from "./pixels";

type EventName =
  | "view_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "place_order"
  | "view_upsell"
  | "accept_upsell"
  | "decline_upsell"
  | "upsell_expired";

type EventPayload = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/* ── dataLayer mirror (GA4 / GTM) ──────────────────────────────────────── */

export function track(event: EventName, payload: EventPayload = {}): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload });
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, payload);
  }
}

/* ── Pixel mirror with browser/CAPI dedup ──────────────────────────────── */

const PIXEL_NAME_MAP: Partial<Record<EventName, PixelEventName>> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  place_order: "Purchase",
};

const EVENT_ID_PREFIX: Partial<Record<EventName, string>> = {
  view_item: "vc",
  add_to_cart: "atc",
  begin_checkout: "ic",
  place_order: "pur",
};

/**
 * Convenience helper for product-scoped events. Returns the minted
 * `event_id` so the caller can forward it to the backend (`/orders`)
 * for server-side dedup.
 */
export function trackCommerce(
  event: EventName,
  args: {
    product?: Product;
    products?: Product[];
    quantity?: number;
    value?: Money;
    /** When provided, reuse this id instead of minting a fresh one. */
    eventId?: string;
    /** Extra payload bag — passed through to `dataLayer`. */
    extra?: EventPayload;
  } = {}
): string | undefined {
  const productList = args.product
    ? [{ product: args.product, quantity: args.quantity ?? 1 }]
    : (args.products ?? []).map((p) => ({ product: p, quantity: 1 }));

  // Build dataLayer payload (GA4 ecommerce).
  const itemsPayload = productList.map(({ product, quantity }) => ({
    item_id: product.id,
    item_name: product.title.ar,
    quantity,
    price: product.price.amount / 100,
  }));
  track(event, {
    items: itemsPayload,
    currency: args.value?.currency ?? "SAR",
    value: args.value ? args.value.amount / 100 : undefined,
    ...(args.extra ?? {}),
  });

  const pixelName = PIXEL_NAME_MAP[event];
  if (!pixelName) return undefined;

  const eventId =
    args.eventId ?? newEventId(EVENT_ID_PREFIX[event] ?? "ev");
  pixelTrack({
    name: pixelName,
    eventId,
    currency: args.value?.currency ?? "SAR",
    value: args.value ? args.value.amount / 100 : undefined,
    contents: productList.map(({ product, quantity }) => ({
      id: product.id,
      name: product.title.ar,
      quantity,
      price: product.price.amount / 100,
    })),
  });

  return eventId;
}

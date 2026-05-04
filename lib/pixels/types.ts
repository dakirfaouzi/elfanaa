/**
 * Cross-platform pixel event surface.
 *
 * One event shape. Three platforms. Each adapter (`meta.ts`, `tiktok.ts`,
 * `snapchat.ts`) translates this into the platform's vocabulary so the
 * call sites stay platform-agnostic.
 */

export type PixelEventName =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export type PixelContent = {
  /** SKU / product id — must match what the server CAPI sends. */
  id: string;
  name?: string;
  quantity?: number;
  /** Major-unit price (e.g. 199.00). */
  price?: number;
};

export type PixelEvent = {
  name: PixelEventName;
  /** REQUIRED for browser + CAPI dedup. Mint via `newEventId(...)`. */
  eventId: string;
  /** ISO 4217 currency. */
  currency?: string;
  /** Major-unit total value of the event (e.g. cart subtotal). */
  value?: number;
  contents?: PixelContent[];
};

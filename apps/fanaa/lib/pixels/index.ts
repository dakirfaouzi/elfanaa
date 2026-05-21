/**
 * Unified pixel facade.
 *
 * Components don't talk to `fbq` / `ttq` / `snaptr` directly — they call
 * `pixelTrack({ name: 'AddToCart', ... })` and the facade fans out to
 * every initialised pixel. This keeps:
 *
 *   • Event names normalised (we say `Purchase`, the adapter maps it).
 *   • `event_id` consistent for browser+CAPI dedup.
 *   • Defer-on-first-interaction performance behaviour in one place.
 *
 * Initialisation is triggered by `<PixelProvider />` in
 * `components/providers/PixelProvider.tsx`. It waits for first user
 * interaction (`pointerdown` / `keydown` / `scroll`) OR a 4-second
 * fallback so FCP isn't blocked by 3rd-party scripts.
 */

import { initMetaPixel, trackMeta } from "./meta";
import { initSnapchatPixel, trackSnapchat } from "./snapchat";
import { initTikTokPixel, trackTikTok } from "./tiktok";
import type { PixelEvent } from "./types";

export type { PixelEvent, PixelEventName, PixelContent } from "./types";
export { newEventId, readAttributionCookies } from "./eventId";

type PixelIds = {
  meta?: string;
  tiktok?: string;
  snapchat?: string;
};

let booted = false;

/**
 * Read pixel IDs from the public env. We only ship IDs to the client —
 * the matching access tokens stay server-side in `backend/.env`.
 */
export function getPixelIds(): PixelIds {
  return {
    meta: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || undefined,
    snapchat: process.env.NEXT_PUBLIC_SNAPCHAT_PIXEL_ID || undefined,
  };
}

/**
 * Initialise every configured pixel. Idempotent — safe to call from
 * multiple effects without spawning duplicate trackers.
 */
export function bootPixels(ids: PixelIds = getPixelIds()): void {
  if (booted || typeof window === "undefined") return;
  booted = true;

  if (ids.meta) initMetaPixel(ids.meta);
  if (ids.tiktok) initTikTokPixel(ids.tiktok);
  if (ids.snapchat) initSnapchatPixel(ids.snapchat);
}

/**
 * Fire an event into every initialised pixel. Safe to call before pixels
 * boot — adapters queue internally until their script loads.
 */
export function pixelTrack(event: PixelEvent): void {
  if (typeof window === "undefined") return;
  trackMeta(event);
  trackTikTok(event);
  trackSnapchat(event);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[pixel]", event.name, event);
  }
}

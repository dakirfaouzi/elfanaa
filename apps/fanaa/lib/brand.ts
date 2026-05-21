import { siteConfig } from "@/data/site";

/**
 * Branded identifiers — derived from `siteConfig.namespace`.
 *
 * Every storage key, persist key, and outbound webhook header in the app
 * comes from here. This keeps the rebrand surface small (one slug) and
 * eliminates the silent-drift class of bug where, e.g., the dispatcher
 * sends `x-mystore-timestamp` while the verifier reads `x-elfanaa-timestamp`.
 *
 * Rules:
 *   • Never hard-code these strings outside this module.
 *   • Bumping `STORAGE_VERSION` invalidates ALL persisted storage and
 *     forces a cold-start — use it for breaking schema changes only.
 *   • The webhook headers are part of an external contract; consumers will
 *     break if you rename them after going live, so coordinate carefully.
 */

const NS = siteConfig.namespace;

/** Bump only on breaking schema changes to client-side storage. */
export const STORAGE_VERSION = "v1" as const;

/** Zustand `persist` middleware key for the cart store. */
export const STORAGE_KEY_CART = `${NS}.cart.${STORAGE_VERSION}`;

/** Cookie / `localStorage` key for the active locale. */
export const STORAGE_KEY_LOCALE = `${NS}.locale`;

/** `sessionStorage` prefix for thank-you-page order receipts. */
export const STORAGE_KEY_RECEIPT_PREFIX = `${NS}.receipt.${STORAGE_VERSION}.`;

/** Outbound HMAC-signed webhook headers. Mirrored by the inbound verifier. */
export const WEBHOOK_HEADER_TIMESTAMP = `x-${NS}-timestamp`;
export const WEBHOOK_HEADER_SIGNATURE = `x-${NS}-signature`;

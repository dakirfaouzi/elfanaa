/**
 * Pure archive/restore primitives for the Admin Catalog (Catalog PR C).
 *
 * These helpers carry NO I/O — no Prisma, no `server-only`, no Next cache —
 * so they can be unit-tested directly and reused by both the server write
 * path (`admin-writes.ts`) and the read-side inventory (`catalog-inventory.ts`).
 *
 * The semantics MUST stay in lock-step with the shared persistence repository
 * (`@platform/persistence` → `StorefrontCatalogProductRepository.archive/restore`,
 * landed in PR B). fanaa intentionally does NOT depend on `@platform/persistence`,
 * so it writes through its own Prisma client using these mirrored primitives.
 *
 * # The tombstone contract (why `priceCurrency = ""`)
 *
 * Archiving a CURATED product that has no DB row writes a TOMBSTONE: a minimal
 * row whose only job is to tell the hybrid loader "skip the code snapshot for
 * this slug". The tombstone uses `priceMinor=0` + `priceCurrency=""`; the empty
 * currency makes the loader's merge treat the price as ABSENT and fall back to
 * the snapshot if the product is ever restored — so a restored curated product
 * renders its real snapshot price, never "SAR 0".
 */

/** Lifecycle status derived from the two storefront flags. */
export type CatalogStatus = "live" | "unlisted" | "archived";

/**
 * Provenance value as stored on `storefront_catalog_product.source`. Only the
 * tombstone CREATE path needs it; an existing row's source is never rewritten.
 */
export type ArchiveSourceValue = "ai_generated" | "curated";

/** The archive marker written to both an existing row and a fresh tombstone. */
export type ArchiveMarker = {
  isLive: false;
  archivedAt: Date;
  archivedReason: string | null;
  archivedBy: string | null;
};

/** Data written by RESTORE — clears the marker and re-lists the product. */
export const RESTORE_DATA = {
  isLive: true as const,
  archivedAt: null,
  archivedReason: null,
  archivedBy: null,
};

/**
 * Map the storefront-facing client `source` ("ai" | "legacy") onto the DB
 * `source` enum. Used when an Archive request must CREATE a tombstone.
 */
export function archiveSourceFor(clientSource: "ai" | "legacy"): ArchiveSourceValue {
  return clientSource === "ai" ? "ai_generated" : "curated";
}

/** Build the archive marker. `reason`/`actor` are clamped/normalised to null. */
export function buildArchiveMarker(
  now: Date,
  opts?: { reason?: string | null; actor?: string | null },
): ArchiveMarker {
  return {
    isLive: false,
    archivedAt: now,
    archivedReason: normaliseReason(opts?.reason),
    archivedBy: opts?.actor && opts.actor.trim() ? opts.actor.trim() : null,
  };
}

/** Build the tombstone CREATE payload for a slug that has no prior DB row. */
export function buildTombstoneCreate(args: {
  storeId: string;
  slug: string;
  source: ArchiveSourceValue;
  marker: ArchiveMarker;
}) {
  return {
    storeId: args.storeId,
    slug: args.slug,
    source: args.source,
    priceMinor: 0,
    // Empty currency → loader merge treats price as "absent" → snapshot fallback.
    priceCurrency: "",
    ...args.marker,
  };
}

/**
 * Derive the lifecycle status from the raw flags. `archivedAt` wins over
 * `isLive` (an archived row is always `isLive=false`, but we treat the
 * archive marker as the source of truth either way).
 */
export function deriveCatalogStatus(row: {
  isLive: boolean;
  archivedAt: Date | string | null;
}): CatalogStatus {
  if (row.archivedAt) return "archived";
  return row.isLive ? "live" : "unlisted";
}

/** Trim, drop-if-empty, and cap an operator-supplied archive reason. */
export function normaliseReason(reason?: string | null): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  return trimmed ? trimmed.slice(0, 280) : null;
}

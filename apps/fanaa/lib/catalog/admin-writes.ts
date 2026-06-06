import "server-only";

import { prisma } from "@/lib/admin/db";
import {
  type ArchiveSourceValue,
  buildArchiveMarker,
  buildTombstoneCreate,
  RESTORE_DATA,
} from "./admin-archive";

/**
 * Admin Catalog write path (Catalog PR C).
 *
 * fanaa does NOT depend on `@platform/persistence`, so archive/restore are
 * implemented here against fanaa's OWN Prisma client (`lib/admin/db.ts`) with
 * semantics mirroring the shared repository's `archive`/`restore` (PR B). The
 * pure payload primitives live in `admin-archive.ts` and are unit-tested.
 *
 * Scope guardrails (PR C):
 *   • Archive / Restore ONLY. No hard delete (that is PR D / Danger Zone).
 *   • Keyed by `(storeId, slug)` — the table's unique index makes the upsert
 *     race-safe.
 *   • Commerce fields on an existing row are never rewritten, so a later
 *     restore brings an AI product back with its real price.
 */

const STORE_ID = "fanaa";

/**
 * Archive a product. Upserts so it also works for a curated product with no
 * prior row — that case writes a tombstone the hybrid loader uses to hide the
 * code snapshot. Returns the affected row's slug + the archive timestamp.
 */
export async function archiveProduct(args: {
  slug: string;
  /** Used ONLY when creating a tombstone (no prior row). Defaults to curated. */
  source?: ArchiveSourceValue;
  reason?: string | null;
  actor?: string | null;
}): Promise<{ slug: string; archivedAt: string }> {
  const marker = buildArchiveMarker(new Date(), {
    reason: args.reason,
    actor: args.actor,
  });
  const row = await prisma.storefrontCatalogProduct.upsert({
    where: { storeId_slug: { storeId: STORE_ID, slug: args.slug } },
    create: buildTombstoneCreate({
      storeId: STORE_ID,
      slug: args.slug,
      source: args.source ?? "curated",
      marker,
    }),
    update: marker,
  });
  // Read the archive timestamp from the marker (not the row): fanaa's locally
  // generated Prisma client may predate PR B's `archivedAt` column until
  // `prisma generate` runs — the same reason `catalog-inventory` casts rows.
  return { slug: row.slug, archivedAt: marker.archivedAt.toISOString() };
}

/**
 * Restore an archived product. Clears the archive marker and re-lists it.
 * Throws Prisma `P2025` when no row exists (you can only restore something
 * that was archived) — the route maps that to a 404.
 */
export async function restoreProduct(args: {
  slug: string;
}): Promise<{ slug: string }> {
  const row = await prisma.storefrontCatalogProduct.update({
    where: { storeId_slug: { storeId: STORE_ID, slug: args.slug } },
    data: { ...RESTORE_DATA },
  });
  return { slug: row.slug };
}

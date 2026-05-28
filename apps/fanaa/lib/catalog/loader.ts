import "server-only";

import { cache } from "react";
import type { Product } from "@/lib/types";
import {
  products as snapshotProducts,
  getBestSellers as snapshotBestSellers,
  bestSellerIds,
} from "@/data/products";
import { isAdminDbConfigured, prisma } from "@/lib/admin/db";
import type { CatalogRow } from "./types";
import {
  assembleCatalogProducts,
  mergeCatalogProduct,
  synthesiseProductFromRow,
} from "./merge";

/**
 * Storefront catalog — live (DB-backed) loader.
 *
 * # Hybrid model (M12 / Step 2)
 *
 * Server-rendered, display-only surfaces read from this module so
 * operator-edited commerce metadata (price, badges, rating, stock,
 * upsells, landingPath) appears without a code deploy. Client islands
 * and pricing-critical server code keep using `./snapshot.ts` — see
 * that file's docstring for the contract.
 *
 * # Read path
 *
 *   1. Try Prisma: fetch every `isLive` row for `storeId="fanaa"`.
 *   2. Index rows by slug.
 *   3. For each snapshot product, overlay the matching row (if any)
 *      via `mergeCatalogProduct`.
 *   4. For each DB row WITHOUT a matching snapshot entry, synthesise
 *      a degraded Product so the shop still lists it (e.g. an
 *      `ai_generated` row published from Studio without curated CRO).
 *   5. Return the union, ordered: snapshot order first (predictable
 *      homepage layout), then any DB-only rows by `updatedAt DESC`.
 *
 * # Fallback path
 *
 * If `ADMIN_DATABASE_URL` isn't configured, or the DB query fails for
 * any reason, the loader logs a structured warning and returns the
 * snapshot unchanged. The storefront stays live — the worst-case
 * symptom is "operator-edited commerce data isn't reflected yet".
 * This is the same fallback the docstring on
 * `StorefrontCatalogProductRepository.findBySlug` promises consumers.
 *
 * # Caching
 *
 *   • `React.cache()` dedupes the underlying list query across every
 *     component within a single request (header + page body + footer
 *     all calling the loader = 1 DB hit).
 *   • Per-page `export const revalidate = 60` (set on each consumer
 *     page) controls cross-request ISR. 60s is the Tier-A default:
 *     fast enough that operators see edits land within a minute,
 *     slow enough that under traffic the DB sees roughly 1 query per
 *     minute per page instead of one per request.
 *   • Individual lookups (`loadCatalogProductBySlug`,
 *     `loadCatalogProductsByIds`) derive from the cached list so they
 *     never trigger a second query.
 *
 * # Why a single `listLive` instead of N findBySlug calls
 *
 * The biggest consumer (the shop / collections pages) needs the full
 * catalog anyway. PDP needs one product, but the snapshot has 4 rows
 * total — fetching all of them is cheaper than a separate query AND
 * unlocks free dedup for any nested component that needs related
 * products / upsells. We re-evaluate once the catalog grows past
 * ~100 rows.
 */

const STORE_ID = "fanaa";

/* -------------------------------------------------------------------------- */
/*                            Cached list query                                */
/* -------------------------------------------------------------------------- */

/**
 * Internal: returns every live catalog row for `storeId="fanaa"`,
 * indexed by slug. Memoised per-request via `React.cache()`.
 *
 * Resolves to an empty map (NOT a throw) when the DB is unconfigured
 * or unreachable. Callers always merge against this map and fall back
 * to the snapshot when a slug isn't present, so a quiet empty map is
 * indistinguishable from "no DB row exists for this slug yet" — both
 * paths render the snapshot.
 */
const loadCatalogRowsBySlug = cache(
  async (): Promise<Map<string, CatalogRow>> => {
    if (!isAdminDbConfigured) {
      // Quiet expected case: any environment that runs without
      // ADMIN_DATABASE_URL (e.g. a fresh local dev `next dev` before
      // the operator wires Postgres). The storefront degrades to
      // snapshot-only and the rest of the dashboards already log
      // their own config error.
      return new Map();
    }

    try {
      const rows = (await prisma.storefrontCatalogProduct.findMany({
        where: { storeId: STORE_ID, isLive: true },
        orderBy: { updatedAt: "desc" },
      })) as unknown as CatalogRow[];

      const bySlug = new Map<string, CatalogRow>();
      for (const row of rows) bySlug.set(row.slug, row);
      return bySlug;
    } catch (err) {
      // Network blip / DB restart / migration in progress. Storefront
      // stays online with snapshot data; the next ISR window retries.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "[catalog/loader] DB read failed; falling back to snapshot",
        { op: "listLive", storeId: STORE_ID, error: message },
      );
      return new Map();
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                              Public loaders                                 */
/* -------------------------------------------------------------------------- */

/**
 * Full live catalog — every snapshot product overlaid with its DB
 * row (when present), plus any DB-only rows synthesised at the end.
 *
 * Snapshot order is preserved so homepage / shop layouts stay stable
 * (the snapshot encodes deliberate merchandising — alphabetical or
 * `updatedAt` sorts would scramble it).
 */
export async function loadAllCatalogProducts(): Promise<Product[]> {
  const rowsBySlug = await loadCatalogRowsBySlug();
  return assembleCatalogProducts(snapshotProducts, rowsBySlug);
}

/**
 * Single live product by slug. Returns `null` when the slug is
 * absent from BOTH the DB and the snapshot — the PDP renders 404
 * in that case (matches the sync `getProductBySlug` contract).
 */
export async function loadCatalogProductBySlug(
  slug: string,
): Promise<Product | null> {
  const rowsBySlug = await loadCatalogRowsBySlug();
  const snapshot = snapshotProducts.find((p) => p.slug === slug) ?? null;
  const dbRow = rowsBySlug.get(slug) ?? null;

  if (snapshot) return mergeCatalogProduct(snapshot, dbRow);
  if (dbRow) return synthesiseProductFromRow(dbRow);
  return null;
}

/**
 * Live homepage best-sellers — preserves the curated ordering from
 * `bestSellerIds` so editorial control over the homepage hero stays
 * in code (DB only controls per-row commerce data, not which rows
 * land on the homepage).
 */
export async function loadBestSellers(): Promise<Product[]> {
  const rowsBySlug = await loadCatalogRowsBySlug();
  const out: Product[] = [];
  for (const id of bestSellerIds) {
    const snapshot = snapshotProducts.find((p) => p.id === id);
    if (!snapshot) continue;
    const dbRow = rowsBySlug.get(snapshot.slug) ?? null;
    out.push(mergeCatalogProduct(snapshot, dbRow));
  }
  return out;
}

/**
 * Resolve a list of business product ids (e.g. a collection's
 * `productIds: ["p_001", "p_002"]`) into live Products. Missing ids
 * are silently dropped — matches the sync `getProductsByIds` contract.
 *
 * Order follows the input array; callers that need a stable result
 * (homepage hero, collection layout) should pass ids in display order.
 */
export async function loadCatalogProductsByIds(
  ids: ReadonlyArray<string>,
): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rowsBySlug = await loadCatalogRowsBySlug();
  const out: Product[] = [];
  for (const id of ids) {
    const snapshot = snapshotProducts.find((p) => p.id === id);
    if (!snapshot) continue;
    const dbRow = rowsBySlug.get(snapshot.slug) ?? null;
    out.push(mergeCatalogProduct(snapshot, dbRow));
  }
  return out;
}

/**
 * Related-product picker. Mirrors the sync `getRelatedProducts(id, limit)`
 * surface so the PDP swap is a one-liner. Built on top of the cached
 * full catalog so it doesn't trigger an extra DB query.
 */
export async function loadRelatedCatalogProducts(
  productId: string,
  limit = 4,
): Promise<Product[]> {
  const all = await loadAllCatalogProducts();
  const current = all.find((p) => p.id === productId);
  if (!current) return [];
  return all.filter((p) => p.id !== productId).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*                            Snapshot-only escape hatch                       */
/* -------------------------------------------------------------------------- */

/**
 * Re-exports the build-time best-sellers (no DB hit). Useful for
 * server code paths that want the snapshot deliberately — currently
 * unused, kept exported for symmetry with `./snapshot.ts` so callers
 * who need both APIs only import from one module.
 */
export function bestSellersFromSnapshot(): Product[] {
  return snapshotBestSellers();
}

// Catalog assembly lives in `./merge.ts` (`assembleCatalogProducts`)
// so it can be unit-tested without dragging `server-only` /
// `react/cache` into the test runtime. The loader's job ends at
// "fetch + cache + fallback".

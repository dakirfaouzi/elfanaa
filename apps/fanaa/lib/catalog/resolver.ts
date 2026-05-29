import "server-only";

import type { Product } from "@/lib/types";
import { getProductById, getProductBySlug } from "@/data/products";
import { loadAllCatalogProducts } from "./loader";

/**
 * Snapshot-first → hybrid-loader-fallback product resolver.
 *
 * # Why this exists (M12 / Step 2 / Phase 2.5 — "bridge the catalog split")
 *
 * The Phase 2.1 hybrid loader (`./loader.ts`) gave server display
 * pages (PDP, /shop, /collections, /concerns, /for/[gender]) access
 * to AI-generated products published from Studio. The COMMERCE path
 * — `useCart.add`, `useResolvedCartLines`, `useCartSubtotal`,
 * `/api/orders` re-pricer, `/api/orders/[id]/upsell` re-pricer,
 * `resolveCartCrossSells` — was deliberately left on the snapshot
 * (`@/data/products::getProductById`). The split is documented in
 * `lib/catalog/snapshot.ts`: snapshot semantics protect the order
 * re-pricer from a race window where an operator publishes a new
 * price mid-checkout and the server re-prices at the NEW price the
 * customer never agreed to.
 *
 * That argument holds for SNAPSHOT products. It does NOT hold for
 * AI-generated products: they have no snapshot row at all, so the
 * DB is the only valid price source. With snapshot-only resolution
 * an AI-gen product:
 *   • Is silently rejected by `useCart.add` (id miss → `return`)
 *   • Is filtered out of `useResolvedCartLines` (cart drawer empty)
 *   • Causes `/api/orders` to return 422 (`product_unknown`)
 * Every operator-published AI product was therefore unsellable.
 *
 * This resolver fixes that without breaking the race-safety
 * guarantee for snapshot products:
 *
 *   1. Try the snapshot first. If a row exists, return it. Behaviour
 *      is BYTE-IDENTICAL to `getProductById` for every existing
 *      snapshot caller — same race protection, same O(1) array scan,
 *      no DB query.
 *   2. Only when the snapshot misses do we fall back to the hybrid
 *      loader. `loadAllCatalogProducts` is wrapped in `React.cache`,
 *      so it dedupes per-request (the order POST does a single DB
 *      query no matter how many cart lines it processes).
 *
 * # The race window we accept for AI-gen products
 *
 * If an operator publishes a NEW price for an AI-gen product
 * between the customer's PDP load and their order submit, the
 * server will re-price at the NEW price. This is the cost of having
 * the DB as the only valid source for AI-gen products — the
 * alternative is to refuse to sell them, which is exactly the bug
 * we're fixing. Snapshot products keep their race-free behaviour.
 *
 * Mitigations available if the race becomes a real problem:
 *   • Embed the displayed price in the cart line (`CartLine.productSnapshot`
 *     already does this client-side — we'd only need to honour it
 *     server-side too).
 *   • Add a `published_at` check that refuses orders for products
 *     republished within the last N seconds.
 *   • Show a "price changed" interstitial before final submit.
 *
 * # Why server-only
 *
 * The hybrid loader uses Prisma which is server-only. This resolver
 * is consumed by `/api/orders` and `/api/orders/[id]/upsell` route
 * handlers — both server routes. Client cart code does NOT use this
 * resolver: it uses the embedded `CartLine.productSnapshot` field
 * the PDP wrote at add-time. Keeps the client bundle free of any
 * server-only imports.
 */

/**
 * Resolve a product by its business id (e.g. `p_001` or
 * `run_mppn2yd3_tkres2c7`).
 *
 * Returns `null` only when BOTH the snapshot AND the hybrid loader
 * miss — i.e. true catalog drift (operator deleted the product, or
 * the id never existed). Callers should treat `null` as "reject the
 * order line" (same semantics `getProductById === undefined` had
 * before — the difference is that AI-gen products now resolve
 * instead of being silently dropped).
 */
export async function resolveCatalogProductById(
  id: string,
): Promise<Product | null> {
  const snap = getProductById(id);
  if (snap) return snap;

  const all = await loadAllCatalogProducts();
  return all.find((p) => p.id === id) ?? null;
}

/**
 * Same as `resolveCatalogProductById` but keyed on slug. Provided
 * for symmetry — the hybrid loader already exposes
 * `loadCatalogProductBySlug` which has the same snapshot-first
 * fallback shape. This wrapper exists so server callers can pick
 * whichever lookup is natural for their call-site without two
 * different mental models.
 *
 * Prefer this over the bare `loadCatalogProductBySlug` when the
 * caller's intent is "resolve a product, treat snapshot drift the
 * same way" — it makes the intent explicit at the call-site.
 */
export async function resolveCatalogProductBySlug(
  slug: string,
): Promise<Product | null> {
  const snap = getProductBySlug(slug);
  if (snap) return snap;

  const all = await loadAllCatalogProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

/**
 * Batch variant — resolves N ids in one pass with at most ONE
 * hybrid-loader hit (deduped via `React.cache` even if the same id
 * appears multiple times).
 *
 * Used by `/api/orders/route.ts` which processes every cart line in
 * a single request. Without batching, each AI-gen line would
 * trigger its own snapshot miss → loader call; with `React.cache`
 * the calls dedupe to one, but the API surface is cleaner if the
 * caller doesn't have to think about that.
 *
 * Missing ids preserve their position in the input array as `null`
 * so the caller can correlate to the original `cart.lines[i]` and
 * report it as `unknown_product`.
 */
export async function resolveCatalogProductsByIds(
  ids: ReadonlyArray<string>,
): Promise<Array<Product | null>> {
  if (ids.length === 0) return [];

  // Fast path: every id resolves from the snapshot — no DB hit.
  const snapHits = ids.map((id) => getProductById(id) ?? null);
  if (snapHits.every((p) => p !== null)) return snapHits;

  // At least one snapshot miss — fetch the live catalog once and
  // fill the gaps. The list query is already memoised by
  // `React.cache` so concurrent callers within the same request
  // share the same Promise.
  const all = await loadAllCatalogProducts();
  const byId = new Map<string, Product>();
  for (const p of all) byId.set(p.id, p);

  return ids.map((id, i) => snapHits[i] ?? byId.get(id) ?? null);
}

/**
 * Storefront catalog — build-time snapshot.
 *
 * # Role in the hybrid loader (M12 / Step 2)
 *
 * fanaa runs a two-source catalog:
 *
 *   1. **Snapshot** (this module) — the file you're reading.
 *      Re-exports `apps/fanaa/data/products.ts` so every consumer
 *      that needs catalog data WITHOUT a DB round-trip lands on the
 *      same import path:
 *
 *        import { getProductById } from "@/lib/catalog/snapshot";
 *
 *      Used by client islands (cart drawer, thank-you recs, pricing
 *      math, cross-sell strategy) and by any server code path where
 *      live DB data would create more risk than value (the POST
 *      /api/orders re-pricer is the canonical example — the price
 *      MUST match what the client just saw, not whatever the DB
 *      contains after a Studio publish that happened mid-checkout).
 *
 *   2. **Live loader** (`./loader.ts`) — server-only async surface
 *      that hits `storefront_catalog_product` via Prisma and merges
 *      DB commerce metadata onto these snapshot rows.
 *      Used by display-only server pages: PDP, shop, collections,
 *      concerns, gender pages, homepage best-sellers.
 *
 * # Why a separate module instead of importing `data/products` directly
 *
 *   • One import path for "the snapshot" makes the audit trivial:
 *     `rg "lib/catalog/snapshot"` shows every consumer in one query.
 *   • Future-proof. If the snapshot ever ships as a generated JSON
 *     file (Phase 2.5+) the swap happens here and every consumer
 *     stays unchanged.
 *   • Encodes the architectural contract that `data/products.ts` is
 *     the *source* of truth for CRO content; commerce overrides
 *     belong in the loader.
 *
 * # What NOT to import from here
 *
 *   • If you're writing a server component that should reflect
 *     operator-edited commerce data (price changes, badge toggles,
 *     stock counters), import from `./loader.ts` instead.
 *   • If you're writing a script or test that needs DB-side fields
 *     (e.g. `isLive`, `source`, `publishedProductId`), the snapshot
 *     does not carry them — go through the loader or the persistence
 *     repository.
 */

export {
  products,
  getProductById,
  getProductBySlug,
  getProductsByIds,
  getRelatedProducts,
  getBestSellers,
  bestSellerIds,
} from "@/data/products";

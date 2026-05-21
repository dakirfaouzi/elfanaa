import type { UpsellMatchCatalogPort } from "@platform/ai-engine";

/**
 * UpsellMatchCatalogPort stub.
 *
 * The M5 upsell-match stage requires a catalog port (vector search +
 * best-sellers fallback). Real catalog backing is M10 work (pgvector
 * over a `UniversalProduct` table populated by the M7 publisher).
 *
 * In M6 the worker passes one of these stubs:
 *
 *   • `emptyCatalog`            — always returns empty (no upsells).
 *                                  Triggers `source: "empty"` in stage 11.
 *   • `fixedCatalog(ids)`       — returns the given IDs for both vector
 *                                  search and best-sellers. Used by
 *                                  tests and the dispatch-mock --dry-run
 *                                  to make stage 11 deterministic.
 *
 * Both stubs are pure synchronous-but-async-shaped functions — they
 * exist only to give upsell-match SOMETHING to await.
 */
export const emptyCatalog: UpsellMatchCatalogPort = {
  async searchByEmbedding() {
    return [];
  },
  async topBestSellers() {
    return [];
  },
};

/**
 * Returns a catalog port that yields `productIds` for both queries.
 *
 *   • `searchByEmbedding` returns them with a fake descending score.
 *   • `topBestSellers`   returns them in order.
 *
 * Use for deterministic tests where upsell-match must succeed without
 * a real DB.
 */
export function fixedCatalog(
  productIds: readonly string[],
): UpsellMatchCatalogPort {
  return {
    async searchByEmbedding({ limit }) {
      return productIds
        .slice(0, limit)
        .map((id, idx) => ({ id, score: 1 - idx * 0.05 }));
    },
    async topBestSellers({ limit }) {
      return productIds.slice(0, limit).map((id) => ({ id }));
    },
  };
}

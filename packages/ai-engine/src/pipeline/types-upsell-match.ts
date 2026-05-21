import type { StrategyOutput } from "./types-strategy";
import type { CopyOutput } from "./types-copy";

/**
 * Stage 11 (Upsell match) input + output types.
 *
 * Returns N candidate UniversalProduct IDs ranked by similarity to the
 * current draft. PLATFORM.md §11 stage 11 failure mode: "Fallback to
 * store best-sellers" — implemented by the stage when no
 * EmbeddingProvider is configured or when the catalog is empty.
 *
 * # Why a port object?
 *
 * The stage doesn't query a DB directly — it accepts a port (`catalog`)
 * that the M6 worker fills with a pgvector-backed implementation, and
 * tests fill with an in-memory fixture. Keeping the port narrow makes
 * the M5 stage 100% pure and 100% testable without a database.
 */
export interface UpsellMatchInput {
  strategy: StrategyOutput;
  copy: CopyOutput;
  /**
   * Port for the catalog backing store. Returns candidate products as
   * `{ id, embedding }` rows for vector search OR `{ id, sales }` rows
   * for the best-sellers fallback. Both can return empty arrays; the
   * stage handles that.
   */
  catalog: UpsellMatchCatalogPort;
  /** Maximum number of suggestions to return. Default 4. */
  limit?: number;
}

export interface UpsellMatchCatalogPort {
  /** Vector search — only called when an EmbeddingProvider is available. */
  searchByEmbedding(opts: {
    embedding: number[];
    limit: number;
  }): Promise<Array<{ id: string; score: number }>>;
  /** Best-sellers fallback. */
  topBestSellers(opts: { limit: number }): Promise<Array<{ id: string }>>;
}

export interface UpsellMatchOutput {
  suggestedProductIds: string[];
  /** Tells the publisher how to weight these suggestions. */
  source: "vector" | "best_sellers" | "empty";
  durationMs: number;
}

/**
 * Catalog types — fanaa-local mirror of the persistence-layer row shape.
 *
 * # Why mirror instead of import from `@platform/persistence`
 *
 * `packages/persistence/src/contracts.ts` already establishes the
 * pattern of re-typing Prisma rows locally so each consumer is
 * independent of Prisma codegen (`prisma generate` doesn't have to
 * have run for `tsc` to pass). We do the same thing here:
 *
 *   • Keeps fanaa's workspace install graph unchanged (no new
 *     `@platform/persistence` dependency just for one type).
 *   • Lets fanaa's typecheck pass even when `prisma generate` hasn't
 *     produced the `@prisma/client` types yet (the same fallback the
 *     Docker `postinstall || echo` block relies on).
 *   • The shape is small and stable — fields here MUST stay in lock-step
 *     with `StorefrontCatalogProductRow` in
 *     `packages/persistence/src/contracts.ts`. The seed CLI is the
 *     contract test: if this mirror drifts, the curated seed payload
 *     won't deserialise and the auto-seed will surface a typed error
 *     at boot.
 *
 * # When to revisit
 *
 * Once `@platform/storefront-catalog` (or equivalent) exists as a
 * shared package that fanaa + studio both consume, swap this mirror
 * for a direct import. Until then, the mirror is the cheapest way to
 * keep persistence + storefront decoupled.
 */

/** Discriminator that explains how a catalog row arrived at the table. */
export type CatalogRowSource = "curated" | "ai_generated";

/**
 * Mirror of `StorefrontCatalogProductRow` from
 * `packages/persistence/src/contracts.ts`.
 *
 * Field-by-field equivalence is enforced by:
 *   1. The Prisma schema (single source of truth for column types).
 *   2. The persistence-layer mirror (validated by its own typecheck).
 *   3. This local mirror (used by the loader + merger).
 *
 * If any of the three drift, the next `prisma generate` followed by
 * `pnpm typecheck` will fail loudly somewhere along the chain.
 */
export interface CatalogRow {
  id: string;
  storeId: string;
  slug: string;
  source: CatalogRowSource;
  publishedProductId: string | null;
  sku: string | null;
  priceMinor: number;
  priceCurrency: string;
  /** Postgres `Json` column. Validated by `merge.ts::coerceOfferTiers`. */
  offerTiers: unknown;
  collection: string | null;
  productType: string | null;
  target: string | null;
  /** Postgres `text[]`. Empty array means "no problems", not "unset". */
  problems: string[];
  /** Postgres `Json` column. Validated by `merge.ts::coerceBadges`. */
  badges: unknown;
  /** Postgres `Json` column. Validated by `merge.ts::coerceRating`. */
  rating: unknown;
  stockLeft: number | null;
  recentBuyers: number | null;
  upsellIds: string[];
  landingPath: string | null;
  isLive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

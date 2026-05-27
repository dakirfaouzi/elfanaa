/**
 * Catalog merge — pure helper that overlays a `storefront_catalog_product`
 * row onto a curated `Product` from the build-time snapshot.
 *
 * # Why a separate file
 *
 * The merge is the single place where two source-of-truth disagreements
 * are resolved. Keeping it pure (no Prisma, no React, no I/O) means:
 *   • The loader can stay focused on caching + fallback decisions.
 *   • A future test runner in fanaa can cover this file directly.
 *   • The same merge logic can be reused at build time, request time,
 *     and during the Studio publish flow without import shenanigans.
 *
 * # Merge contract (M12 / Step 2)
 *
 *   • CRO content always wins from the snapshot:
 *       title, description, headline, subheadline, images,
 *       lifestyleImage, ingredients, benefits, reviews, faq.
 *     These fields don't exist on the DB row — they're the editorial
 *     surface that belongs in code.
 *
 *   • Commerce metadata wins from the DB when present, otherwise
 *     falls back to the snapshot:
 *       sku, price, offerTiers, badges, rating, collection,
 *       productType, target, problems, upsellIds, stockLeft,
 *       recentBuyers, landingPath.
 *     These are the fields the Studio "Catalog metadata" panel (Phase
 *     2.3) lets operators edit without a code deploy.
 *
 *   • `id` and `slug` are immutable:
 *       - `id` is always the snapshot's business id (`p_001`...). The
 *         DB doesn't store it — DB rows are keyed by `(storeId, slug)`.
 *       - `slug` must match between snapshot and DB row. If a caller
 *         passes a mismatched pair, we trust the snapshot's slug and
 *         leave a console warning so the seed drift surfaces in logs
 *         rather than silently corrupting URLs.
 *
 * # `null` vs `undefined` on the DB row
 *
 * Prisma returns nullable scalars as `null`. We treat `null` as "not
 * set in DB" and fall back to the snapshot value. This is intentional
 * symmetry with `StorefrontCatalogProductRepository.upsert`, where
 * passing `null` *clears* the field. An empty array (e.g. `problems: []`)
 * is treated as "intentionally empty" and overrides the snapshot.
 */

import type { CatalogRow } from "./types";
import type {
  LocalizedString,
  Money,
  OfferTier,
  Product,
  ProductProblem,
  ProductTarget,
  ProductType,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*                                Public API                                   */
/* -------------------------------------------------------------------------- */

/**
 * Overlay a DB catalog row onto a curated snapshot product.
 *
 * Returns a *new* Product — the inputs are never mutated. Safe to call
 * inside a server component or a memoised loader without leaking state
 * across requests.
 *
 * When `dbRow` is `null` (no row for this slug), returns the snapshot
 * unchanged. This is the production-time hot path during the initial
 * window after a Studio publish but before the catalog row lands.
 */
export function mergeCatalogProduct(
  snapshot: Product,
  dbRow: CatalogRow | null,
): Product {
  if (!dbRow) return snapshot;

  // Defensive: slug drift indicates seed/code disagreement. The snapshot
  // wins — URLs and `generateStaticParams` are derived from it — but we
  // log so the next deploy investigation has a breadcrumb.
  if (dbRow.slug !== snapshot.slug) {
    console.warn(
      "[catalog/merge] slug mismatch; snapshot wins",
      { snapshotSlug: snapshot.slug, dbSlug: dbRow.slug, dbId: dbRow.id },
    );
  }

  const merged: Product = {
    // ── Identity & CRO (always snapshot) ────────────────────────────
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    description: snapshot.description,
    images: snapshot.images,

    // ── Commerce metadata (DB overlay with snapshot fallback) ───────
    sku: pickString(dbRow.sku, snapshot.sku),
    price: pickPrice(dbRow.priceMinor, dbRow.priceCurrency, snapshot.price),
    offerTiers: pickOfferTiers(dbRow.offerTiers, snapshot.offerTiers),
    badges: pickBadges(dbRow.badges, snapshot.badges),
    rating: pickRating(dbRow.rating, snapshot.rating),
    collection: pickString(dbRow.collection, snapshot.collection),
    productType: pickEnum<ProductType>(dbRow.productType, snapshot.productType),
    target: pickEnum<ProductTarget>(dbRow.target, snapshot.target),
    problems: pickProblems(dbRow.problems, snapshot.problems),
    upsellIds: pickStringArray(dbRow.upsellIds, snapshot.upsellIds),
    stockLeft: pickNumber(dbRow.stockLeft, snapshot.stockLeft),
    recentBuyers: pickNumber(dbRow.recentBuyers, snapshot.recentBuyers),
    landingPath: pickString(dbRow.landingPath, snapshot.landingPath),
  };

  // Carry every optional CRO field through verbatim. Splatting the
  // snapshot first and overwriting the commerce fields would be more
  // concise, but explicit assignment keeps "what the DB controls" and
  // "what stays in code" auditable at a glance.
  if (snapshot.compareAtPrice !== undefined) merged.compareAtPrice = snapshot.compareAtPrice;
  if (snapshot.variants !== undefined) merged.variants = snapshot.variants;
  if (snapshot.headline !== undefined) merged.headline = snapshot.headline;
  if (snapshot.subheadline !== undefined) merged.subheadline = snapshot.subheadline;
  if (snapshot.lifestyleImage !== undefined) merged.lifestyleImage = snapshot.lifestyleImage;
  if (snapshot.benefits !== undefined) merged.benefits = snapshot.benefits;
  if (snapshot.faq !== undefined) merged.faq = snapshot.faq;
  if (snapshot.reviews !== undefined) merged.reviews = snapshot.reviews;
  if (snapshot.ingredients !== undefined) merged.ingredients = snapshot.ingredients;

  return merged;
}

/**
 * Build a fully synthetic Product for a DB-only catalog row (no
 * snapshot entry — i.e. an AI-generated product published from
 * Studio that doesn't have hand-written CRO content yet).
 *
 * # When is this called?
 *
 * Phase 2.2 ships with four curated rows whose slugs always match
 * `data/products.ts`. The fallback below is rare today, but it
 * matters for Phase 2.3+:
 *   • When the Studio publish flow drops a new `ai_generated` row
 *     with no matching snapshot entry, the shop page should still
 *     list the product. The result is a degraded card (no headline,
 *     no benefits, no reviews) but it's discoverable + buyable.
 *
 * # Identity
 *
 * The synthesised product uses the slug as its business id. Cart
 * lookups (`getProductById`) will miss until the snapshot is
 * regenerated, but `addToCart` always goes through the PDP, where
 * `loadCatalogProductBySlug` returns this synthetic shape too, so
 * the cart line is keyed consistently.
 */
export function synthesiseProductFromRow(
  row: CatalogRow,
): Product {
  const fallbackTitle: LocalizedString = {
    ar: row.slug,
    en: row.slug,
  };

  const product: Product = {
    id: row.slug,
    slug: row.slug,
    title: fallbackTitle,
    description: { ar: "", en: "" },
    images: [],
    price: {
      amount: row.priceMinor,
      currency: row.priceCurrency,
    },
    offerTiers: coerceOfferTiers(row.offerTiers) ?? undefined,
    sku: row.sku ?? undefined,
    badges: coerceBadges(row.badges) ?? undefined,
    rating: coerceRating(row.rating) ?? undefined,
    collection: row.collection ?? undefined,
    productType: (row.productType as ProductType | null) ?? undefined,
    target: (row.target as ProductTarget | null) ?? undefined,
    problems: row.problems.length > 0 ? (row.problems as ProductProblem[]) : undefined,
    upsellIds: row.upsellIds.length > 0 ? row.upsellIds : undefined,
    stockLeft: row.stockLeft ?? undefined,
    recentBuyers: row.recentBuyers ?? undefined,
    landingPath: row.landingPath ?? undefined,
  };

  return product;
}

/* -------------------------------------------------------------------------- */
/*                          Field-level pickers                                */
/* -------------------------------------------------------------------------- */
//
// One picker per field family. Each one keeps the "DB present → DB
// wins; DB null → snapshot wins" contract in a single place so the
// merge function stays declarative. Every picker is total and never
// throws — corrupt JSON in a DB column falls back silently to the
// snapshot value and the loader surfaces the warning.

function pickString<T extends string>(
  fromDb: T | string | null | undefined,
  fromSnapshot: T | string | undefined,
): T | undefined {
  if (fromDb !== null && fromDb !== undefined && fromDb !== "") {
    return fromDb as T;
  }
  return fromSnapshot as T | undefined;
}

function pickNumber(
  fromDb: number | null | undefined,
  fromSnapshot: number | undefined,
): number | undefined {
  if (typeof fromDb === "number" && Number.isFinite(fromDb)) return fromDb;
  return fromSnapshot;
}

function pickEnum<T extends string>(
  fromDb: string | null | undefined,
  fromSnapshot: T | undefined,
): T | undefined {
  if (fromDb !== null && fromDb !== undefined && fromDb !== "") {
    return fromDb as T;
  }
  return fromSnapshot;
}

function pickPrice(
  priceMinor: number | null | undefined,
  priceCurrency: string | null | undefined,
  snapshot: Money,
): Money {
  if (
    typeof priceMinor === "number" &&
    Number.isFinite(priceMinor) &&
    typeof priceCurrency === "string" &&
    priceCurrency.trim().length > 0
  ) {
    return { amount: priceMinor, currency: priceCurrency };
  }
  return snapshot;
}

function pickOfferTiers(
  fromDb: unknown,
  fromSnapshot: OfferTier[] | undefined,
): OfferTier[] | undefined {
  const coerced = coerceOfferTiers(fromDb);
  if (coerced && coerced.length > 0) return coerced;
  return fromSnapshot;
}

function pickBadges(
  fromDb: unknown,
  fromSnapshot: LocalizedString[] | undefined,
): LocalizedString[] | undefined {
  const coerced = coerceBadges(fromDb);
  if (coerced && coerced.length > 0) return coerced;
  return fromSnapshot;
}

function pickRating(
  fromDb: unknown,
  fromSnapshot: { value: number; count: number } | undefined,
): { value: number; count: number } | undefined {
  const coerced = coerceRating(fromDb);
  if (coerced) return coerced;
  return fromSnapshot;
}

function pickProblems(
  fromDb: string[] | null | undefined,
  fromSnapshot: ProductProblem[] | undefined,
): ProductProblem[] | undefined {
  if (Array.isArray(fromDb) && fromDb.length > 0) {
    return fromDb as ProductProblem[];
  }
  return fromSnapshot;
}

function pickStringArray(
  fromDb: string[] | null | undefined,
  fromSnapshot: string[] | undefined,
): string[] | undefined {
  if (Array.isArray(fromDb) && fromDb.length > 0) {
    return fromDb;
  }
  return fromSnapshot;
}

/* -------------------------------------------------------------------------- */
/*                          JSON-column coercion                               */
/* -------------------------------------------------------------------------- */
//
// `offerTiers`, `badges`, and `rating` ship as Postgres `Json` columns
// — Prisma returns them as `unknown`. Each coercer validates the shape
// it cares about and returns `null` on anything weird. Defensive but
// silent: bad data in DB never breaks the storefront, it just means
// the snapshot value is used instead.

function coerceOfferTiers(value: unknown): OfferTier[] | null {
  if (!Array.isArray(value)) return null;
  const out: OfferTier[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as { quantity?: unknown; total?: unknown };
    const quantity = typeof e.quantity === "number" ? e.quantity : null;
    const total = coerceMoney(e.total);
    if (quantity === null || total === null) return null;
    out.push({ quantity, total });
  }
  return out;
}

function coerceBadges(value: unknown): LocalizedString[] | null {
  if (!Array.isArray(value)) return null;
  const out: LocalizedString[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as { ar?: unknown; en?: unknown };
    if (typeof e.ar !== "string" || typeof e.en !== "string") return null;
    out.push({ ar: e.ar, en: e.en });
  }
  return out;
}

function coerceRating(value: unknown): { value: number; count: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { value?: unknown; count?: unknown };
  const ratingValue = typeof v.value === "number" ? v.value : null;
  const ratingCount = typeof v.count === "number" ? v.count : null;
  if (ratingValue === null || ratingCount === null) return null;
  return { value: ratingValue, count: ratingCount };
}

function coerceMoney(value: unknown): Money | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { amount?: unknown; currency?: unknown };
  if (typeof v.amount !== "number" || typeof v.currency !== "string") return null;
  return { amount: v.amount, currency: v.currency };
}

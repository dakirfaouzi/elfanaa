/**
 * Catalog merge — pure helpers that resolve the two-source-of-truth
 * model behind the fanaa storefront catalog (M12 / Step 2).
 *
 * # Why a separate file
 *
 * The merge is the single place where snapshot ↔ DB disagreements are
 * resolved. Keeping it pure (no Prisma, no React, no I/O) means:
 *   • The loader can stay focused on caching + fallback decisions.
 *   • Apps/fanaa vitest covers every branch in this file directly.
 *   • The same merge logic can be reused at build time, request time,
 *     and during the Studio publish flow without import shenanigans.
 *
 * # Merge contract (Phase 2.2 → 2.4)
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
 *
 * # DB-only products (Phase 2.4 hardening)
 *
 * `synthesiseProductFromRow` runs for AI-generated rows with no
 * matching snapshot entry. The upstream Studio panel validates every
 * field via `CatalogMetadataSchema`, but the storefront still
 * defensively validates closed enums (`productType`, `target`,
 * `problems`) here — a hand-crafted SQL insert or a future schema
 * drift won't smuggle unknown values into the type system. Unknown
 * enum values are silently dropped (logged once via `console.warn`)
 * and the field falls through to `undefined`. Invalid pricing
 * (non-finite, negative) is clamped to `0` with the currency falling
 * back to `"SAR"` (the fanaa primary market). Both cases produce a
 * renderable Product — the worst-case symptom is "operator must
 * republish to fix the row" rather than a 500 on the shop page.
 *
 * # Images contract (Phase 2.4.1 fix)
 *
 * `storefront_catalog_product` does not (yet) carry product image
 * data — that surface still lives in the snapshot's curated
 * photography. AI-generated rows therefore arrive at the storefront
 * with no images of their own. Phase 2.2's synthesise function
 * shipped `images: []`, which crashed every UI surface that read
 * `product.images[0].src` (ProductCard, cart drawer, PDP gallery,
 * sticky add-to-cart bar, post-purchase upsell, thank-you cross-sells
 * + recommendations). The merger now seeds
 * `PLACEHOLDER_PRODUCT_IMAGE` into the synthesised Product so
 * `images.length >= 1` is true for every value reaching the
 * storefront. The UI layer also wraps its access via
 * `lib/product-image.ts::getPrimaryImage(product)` for defense in
 * depth — both layers share the same placeholder so the visual
 * experience is identical regardless of where the fallback fires.
 */

import type { CatalogRow } from "./types";
import type {
  LocalizedString,
  Money,
  OfferTier,
  Product,
  ProductImage,
  ProductProblem,
  ProductTarget,
  ProductType,
} from "@/lib/types";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";

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
 * `data/products.ts`. This path activates the moment the operator
 * publishes a NEW product from Studio (Phase 2.3+):
 *   • The shop / collection / concern pages list it (degraded card
 *     — no headline, no benefits, no reviews — but discoverable +
 *     buyable).
 *   • `/p/<slug>` PDP renders the universal storefront fallback,
 *     using the price + offer tiers + badges from the DB row.
 *
 * # Identity
 *
 * The synthesised product uses the slug as its business id. Cart
 * lookups (`getProductById`) will miss until the snapshot is
 * regenerated, but `addToCart` always goes through the PDP, where
 * `loadCatalogProductBySlug` returns this synthetic shape too, so
 * the cart line is keyed consistently.
 *
 * # Defensive validation (Phase 2.4)
 *
 * Closed-union enums (`productType`, `target`, `problems`) are
 * validated against the storefront's filter system. Unknown values
 * are dropped — the row remains visible but the filter sidebar
 * stays consistent. Pricing is sanitised so a malformed row never
 * crashes the PDP renderer (see `sanitisePrice` below).
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
    // Hero image: the catalog row now carries a durable `heroImageUrl`
    // (CDN), re-hosted from the AI pipeline's ephemeral vendor URL at
    // publish time (M12 / Step 2 image fix). When present + servable we
    // use it as the AI product's hero across every storefront surface
    // (ProductCard, cart, PDP gallery, sticky bar, upsells). When it's
    // absent (curated rows, legacy rows, or a row published before a
    // CDN base URL was configured) we fall back to the placeholder so
    // the synthesised Product is always renderable — every surface
    // reads `images[0]` and would crash on an empty array.
    images: [synthesiseHeroImage(row)],
    price: sanitisePrice(row.priceMinor, row.priceCurrency, row.slug),
    offerTiers: nonEmptyOrUndefined(coerceOfferTiers(row.offerTiers)),
    sku: row.sku ?? undefined,
    badges: nonEmptyOrUndefined(coerceBadges(row.badges)),
    rating: coerceRating(row.rating) ?? undefined,
    collection: row.collection ?? undefined,
    productType: validateProductType(row.productType, row.slug),
    target: validateProductTarget(row.target, row.slug),
    problems: validateProblems(row.problems, row.slug),
    upsellIds: row.upsellIds.length > 0 ? row.upsellIds : undefined,
    stockLeft: row.stockLeft ?? undefined,
    recentBuyers: row.recentBuyers ?? undefined,
    landingPath: row.landingPath ?? undefined,
  };

  return product;
}

/**
 * Assemble the full live catalog: snapshot rows (with DB overlay)
 * first, DB-only rows synthesised at the end.
 *
 * # Why this is a separate pure function
 *
 * Extracting the assembly out of `loader.ts` keeps the loader free
 * of testable logic — the loader is just "fetch + cache + fallback".
 * This function takes the snapshot and the row map as parameters
 * (rather than reaching into the snapshot module directly), which
 * makes unit tests trivial and lets the same logic run identically
 * at build time, request time, and in tests.
 *
 * # Ordering contract
 *
 *   1. Snapshot products in their declared order. The snapshot
 *      encodes deliberate merchandising (hero placement, related-
 *      product affinity) — sorting by `updatedAt` or alphabetical
 *      would scramble it.
 *   2. DB-only products in the iteration order of `rowsBySlug`. The
 *      loader passes a Map seeded from `updatedAt DESC`, so newer
 *      AI-generated products land near the snapshot's tail rather
 *      than buried at the bottom.
 *
 * # Why snapshot products win on slug collision
 *
 * If a DB row's slug matches a snapshot entry, the DB row is
 * applied as an overlay via `mergeCatalogProduct`. It is NEVER
 * duplicated as a synthesised entry — the `snapshotSlugs` set
 * filters it out of the DB-only loop.
 */
export function assembleCatalogProducts(
  snapshot: ReadonlyArray<Product>,
  rowsBySlug: ReadonlyMap<string, CatalogRow>,
): Product[] {
  const snapshotSlugs = new Set<string>();
  const out: Product[] = [];

  for (const product of snapshot) {
    snapshotSlugs.add(product.slug);
    const dbRow = rowsBySlug.get(product.slug) ?? null;
    out.push(mergeCatalogProduct(product, dbRow));
  }

  for (const [slug, row] of rowsBySlug) {
    if (snapshotSlugs.has(slug)) continue;
    out.push(synthesiseProductFromRow(row));
  }

  return out;
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

/* -------------------------------------------------------------------------- */
/*                          Closed-union validation                            */
/* -------------------------------------------------------------------------- */
//
// The storefront's filter system is built around closed string
// unions (`ProductType`, `ProductTarget`, `ProductProblem`). The
// Studio panel validates against the same vocabulary via Zod, so
// well-behaved publish flows can't smuggle unknown values past the
// upsert. These validators are defense in depth against:
//   • Hand-crafted SQL inserts during a one-off migration.
//   • Future vocabulary drift between Studio + storefront (a value
//     added to one side but not the other).
//   • A schema migration that widens the column type.
// Unknown values are dropped silently (a single `console.warn` keeps
// the breadcrumb in the runtime logs) and the field stays
// `undefined`. The product itself stays renderable.

const PRODUCT_TYPES: ReadonlySet<ProductType> = new Set<ProductType>([
  "serum", "cream", "mask", "oil",
  "capsules", "spray", "device", "bundle",
]);

const PRODUCT_TARGETS: ReadonlySet<ProductTarget> = new Set<ProductTarget>([
  "women", "men", "unisex",
]);

const PRODUCT_PROBLEMS: ReadonlySet<ProductProblem> = new Set<ProductProblem>([
  "dark-spots", "dryness", "uneven-tone", "barrier-damage",
  "sensitive-skin", "oily-skin", "pores",
  "hair-damage", "hair-dryness", "breakage", "color-treated", "hair-loss",
  "complete-care",
]);

function validateProductType(
  value: string | null,
  slug: string,
): ProductType | undefined {
  if (value === null || value === "") return undefined;
  if (PRODUCT_TYPES.has(value as ProductType)) return value as ProductType;
  console.warn(
    "[catalog/merge] unknown productType dropped from synthesised product",
    { slug, value },
  );
  return undefined;
}

function validateProductTarget(
  value: string | null,
  slug: string,
): ProductTarget | undefined {
  if (value === null || value === "") return undefined;
  if (PRODUCT_TARGETS.has(value as ProductTarget)) return value as ProductTarget;
  console.warn(
    "[catalog/merge] unknown target dropped from synthesised product",
    { slug, value },
  );
  return undefined;
}

function validateProblems(
  values: ReadonlyArray<string>,
  slug: string,
): ProductProblem[] | undefined {
  if (values.length === 0) return undefined;
  const valid: ProductProblem[] = [];
  const dropped: string[] = [];
  for (const value of values) {
    if (PRODUCT_PROBLEMS.has(value as ProductProblem)) {
      valid.push(value as ProductProblem);
    } else {
      dropped.push(value);
    }
  }
  if (dropped.length > 0) {
    console.warn(
      "[catalog/merge] unknown problem values dropped from synthesised product",
      { slug, dropped },
    );
  }
  return valid.length > 0 ? valid : undefined;
}

/* -------------------------------------------------------------------------- */
/*                            Price sanitisation                               */
/* -------------------------------------------------------------------------- */
//
// `priceMinor` is a Postgres `Int4` non-null column and the Studio
// panel enforces `>= 0` via Zod, so well-behaved rows always arrive
// with a finite non-negative number. We still guard against:
//   • Numeric overflow on JSON re-serialisation (Number ↔ BigInt).
//   • Negative values from a hand-crafted SQL insert.
//   • Empty `priceCurrency` from a partial migration.
// The fallback currency "SAR" matches fanaa's primary market — any
// store cloning this loader should override the fallback in their
// own merge module.

const FALLBACK_CURRENCY = "SAR";

/**
 * Treat coerced-but-empty arrays as "unset" for the synthesised
 * Product. The merge path already does this via `pickOfferTiers` /
 * `pickBadges` (empty array → snapshot fallback). The synthesise path
 * has no snapshot fallback, but downstream consumers (`OfferSelector`,
 * `PdpBadges`) treat `undefined` and `[]` identically — collapsing
 * them keeps the Product shape canonical for caches and snapshots.
 */
function nonEmptyOrUndefined<T>(value: T[] | null): T[] | undefined {
  if (value === null) return undefined;
  if (value.length === 0) return undefined;
  return value;
}

/* -------------------------------------------------------------------------- */
/*                              Hero image                                     */
/* -------------------------------------------------------------------------- */
//
// AI-generated rows now carry a durable `heroImageUrl` (a CDN URL
// re-hosted at publish time). We accept it ONLY when it's a value the
// storefront can actually render — an absolute http(s) URL or an inline
// data URL. Bare R2 keys (`studio/<draftId>/...`) can occur when the
// store has R2 configured but no public CDN base URL yet; fanaa has no
// asset proxy, so those would 404. Rather than render a broken image we
// fall back to the placeholder, matching the pre-image-fix behaviour.

function synthesiseHeroImage(row: CatalogRow): ProductImage {
  const src = typeof row.heroImageUrl === "string" ? row.heroImageUrl.trim() : "";
  if (src && (/^https?:\/\//i.test(src) || src.startsWith("data:"))) {
    return {
      src,
      alt: { ar: "صورة المنتج", en: "Product image" },
    } satisfies ProductImage;
  }
  return PLACEHOLDER_PRODUCT_IMAGE satisfies ProductImage;
}

function sanitisePrice(
  amount: number,
  currency: string,
  slug: string,
): Money {
  let safeAmount = amount;
  if (!Number.isFinite(amount) || amount < 0) {
    console.warn(
      "[catalog/merge] invalid priceMinor clamped to 0 on synthesised product",
      { slug, amount },
    );
    safeAmount = 0;
  }

  let safeCurrency = currency;
  if (typeof currency !== "string" || currency.trim() === "") {
    console.warn(
      "[catalog/merge] missing priceCurrency replaced with SAR on synthesised product",
      { slug, currency },
    );
    safeCurrency = FALLBACK_CURRENCY;
  }

  return { amount: safeAmount, currency: safeCurrency };
}

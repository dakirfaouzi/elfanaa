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
    postPurchaseUpsellId: pickString(
      dbRow.postPurchaseUpsellId,
      snapshot.postPurchaseUpsellId,
    ),
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
  if (snapshot.lifestyleImages !== undefined) merged.lifestyleImages = snapshot.lifestyleImages;
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
    postPurchaseUpsellId: row.postPurchaseUpsellId ?? undefined,
    stockLeft: row.stockLeft ?? undefined,
    recentBuyers: row.recentBuyers ?? undefined,
    landingPath: row.landingPath ?? undefined,
  };

  // Step 4 — hydrate the rich CRO surface from the publish-time projection so
  // AI-generated products render a full page without a hand-authored snapshot.
  //
  // CANONICAL IMAGE RESOLUTION (Phase 4.5.1): resolve EVERY nested image ref in
  // cro_content through the one resolver BEFORE coercion, so lifestyleImage,
  // gallery images, review avatars, and any future Phase 4.6 section image are
  // normalised identically to the hero. Before this, only the hero column was
  // resolved (synthesiseHeroImage) — every other cro image kept its bare R2 key
  // / vendor URL and rendered "image pending". Section-agnostic + future-proof:
  // a new image-bearing section needs zero extra wiring here.
  const cro = coerceCroContent(resolveRawImageRefs(row.croContent));
  if (cro) {
    if (cro.title) product.title = cro.title;
    if (cro.description) product.description = cro.description;
    if (cro.headline) product.headline = cro.headline;
    if (cro.subheadline) product.subheadline = cro.subheadline;
    if (cro.foundersNote) product.foundersNote = cro.foundersNote;
    // The hero image URL on the row wins as images[0]; append projected
    // gallery images (skip the first, which mirrors the hero).
    if (cro.images && cro.images.length > 1) {
      product.images = [product.images[0], ...cro.images.slice(1)];
    }
    if (cro.lifestyleImages) product.lifestyleImages = cro.lifestyleImages;
    if (cro.lifestyleImage) product.lifestyleImage = cro.lifestyleImage;
    if (cro.benefits) product.benefits = cro.benefits;
    if (cro.reviews) product.reviews = cro.reviews;
    if (cro.faq) product.faq = cro.faq;
    if (cro.ingredients) product.ingredients = cro.ingredients;
    if (cro.sectionContent) product.sectionContent = cro.sectionContent;
    if (cro.sectionOrder) product.sectionOrder = cro.sectionOrder;
  }

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
/*                    Step 4 — CRO content projection (cro_content)            */
/* -------------------------------------------------------------------------- */
//
// `storefront_catalog_product.cro_content` is a JSON projection of the AI
// pipeline's UniversalProduct CRO surface (see @platform/catalog-schema's
// CroContent). fanaa stays self-contained (no catalog-schema dependency), so
// we validate the blob here with the same defensive "drop malformed, never
// throw" philosophy as the other coercers. A malformed projection yields a
// commerce-only product rather than a 500.

function loc(value: unknown): LocalizedString | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { ar?: unknown; en?: unknown };
  if (typeof v.ar !== "string" || typeof v.en !== "string") return null;
  return { ar: v.ar, en: v.en };
}

function locArray(value: unknown): LocalizedString[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: LocalizedString[] = [];
  for (const entry of value) {
    const l = loc(entry);
    if (l) out.push(l);
  }
  return out.length > 0 ? out : undefined;
}

function coerceProductImage(value: unknown): ProductImage | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { src?: unknown; alt?: unknown; intent?: unknown };
  if (typeof v.src !== "string" || v.src.trim().length === 0) return null;
  const alt = loc(v.alt) ?? { ar: "", en: "" };
  const img: ProductImage = { src: v.src, alt };
  // Phase 4.6.3 — carry the semantic intent so section-aware assignment works.
  if (typeof v.intent === "string" && v.intent.trim().length > 0) {
    img.intent = v.intent;
  }
  return img;
}

/**
 * The validated CRO overlay applied onto a synthesised Product. Every field is
 * optional; only well-formed fields survive.
 */
export interface CroOverlay {
  title?: LocalizedString;
  description?: LocalizedString;
  headline?: LocalizedString;
  subheadline?: LocalizedString;
  foundersNote?: LocalizedString;
  images?: ProductImage[];
  lifestyleImages?: ProductImage[];
  lifestyleImage?: ProductImage;
  benefits?: Product["benefits"];
  reviews?: Product["reviews"];
  faq?: Product["faq"];
  ingredients?: Product["ingredients"];
  sectionContent?: Product["sectionContent"];
  sectionOrder?: string[];
}

export function coerceCroContent(value: unknown): CroOverlay | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: CroOverlay = {};

  const title = loc(v.title);
  if (title) out.title = title;
  const description = loc(v.description);
  if (description) out.description = description;
  const headline = loc(v.headline);
  if (headline) out.headline = headline;
  const subheadline = loc(v.subheadline);
  if (subheadline) out.subheadline = subheadline;
  const foundersNote = loc(v.foundersNote);
  if (foundersNote) out.foundersNote = foundersNote;

  if (Array.isArray(v.images)) {
    const imgs = v.images
      .map(coerceProductImage)
      .filter((i): i is ProductImage => i !== null);
    if (imgs.length > 0) out.images = imgs;
  }
  if (Array.isArray(v.lifestyleImages)) {
    const scenes = v.lifestyleImages
      .map(coerceProductImage)
      .filter((i): i is ProductImage => i !== null);
    if (scenes.length > 0) out.lifestyleImages = scenes;
  }
  const lifestyle =
    coerceProductImage(v.lifestyleImage) ?? out.lifestyleImages?.[0] ?? null;
  if (lifestyle) out.lifestyleImage = lifestyle;

  const benefits = coerceBenefits(v.benefits);
  if (benefits) out.benefits = benefits;
  const reviews = coerceReviews(v.reviews);
  if (reviews) out.reviews = reviews;
  const faq = coerceFaq(v.faq);
  if (faq) out.faq = faq;
  const ingredients = coerceIngredients(v.ingredients);
  if (ingredients) out.ingredients = ingredients;

  const sectionContent = coerceSectionContent(v.sectionContent);
  if (sectionContent) out.sectionContent = sectionContent;

  if (Array.isArray(v.sectionOrder)) {
    const order = v.sectionOrder.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    if (order.length > 0) out.sectionOrder = order;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function coerceBenefits(value: unknown): Product["benefits"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: NonNullable<Product["benefits"]> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { icon?: unknown; title?: unknown; body?: unknown };
    const title = loc(e.title);
    const body = loc(e.body);
    if (!title || !body) continue;
    out.push({
      icon: typeof e.icon === "string" && e.icon ? e.icon : "Sparkles",
      title,
      body,
    });
  }
  return out.length > 0 ? out : undefined;
}

function coerceReviews(value: unknown): Product["reviews"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: NonNullable<Product["reviews"]> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as {
      name?: unknown;
      city?: unknown;
      rating?: unknown;
      body?: unknown;
      date?: unknown;
      verified?: unknown;
    };
    const name = loc(e.name);
    const city = loc(e.city);
    const body = loc(e.body);
    if (!name || !city || !body) continue;
    out.push({
      name,
      city,
      rating: typeof e.rating === "number" ? e.rating : 5,
      body,
      date: typeof e.date === "string" ? e.date : "",
      ...(typeof e.verified === "boolean" ? { verified: e.verified } : {}),
    });
  }
  return out.length > 0 ? out : undefined;
}

function coerceFaq(value: unknown): Product["faq"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: NonNullable<Product["faq"]> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { q?: unknown; a?: unknown };
    const q = loc(e.q);
    const a = loc(e.a);
    if (!q || !a) continue;
    out.push({ q, a });
  }
  return out.length > 0 ? out : undefined;
}

function coerceIngredients(value: unknown): Product["ingredients"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: NonNullable<Product["ingredients"]> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { name?: unknown; role?: unknown };
    const name = loc(e.name);
    const role = loc(e.role);
    if (!name || !role) continue;
    out.push({ name, role });
  }
  return out.length > 0 ? out : undefined;
}

function coerceSectionContent(
  value: unknown,
): Product["sectionContent"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const out: NonNullable<Product["sectionContent"]> = {};

  if (v.howItWorks && typeof v.howItWorks === "object") {
    const h = v.howItWorks as { summary?: unknown; steps?: unknown };
    const summary = loc(h.summary);
    const steps = Array.isArray(h.steps)
      ? h.steps
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const e = s as { title?: unknown; body?: unknown };
            const title = loc(e.title);
            const body = loc(e.body);
            return title && body ? { title, body } : null;
          })
          .filter((s): s is { title: LocalizedString; body: LocalizedString } => s !== null)
      : [];
    if (summary && steps.length > 0) out.howItWorks = { summary, steps };
  }

  if (v.results && typeof v.results === "object") {
    const r = v.results as { intro?: unknown; timeline?: unknown };
    const timeline = Array.isArray(r.timeline)
      ? r.timeline
          .map((t) => {
            if (!t || typeof t !== "object") return null;
            const e = t as { when?: unknown; outcome?: unknown };
            const when = loc(e.when);
            const outcome = loc(e.outcome);
            return when && outcome ? { when, outcome } : null;
          })
          .filter((t): t is { when: LocalizedString; outcome: LocalizedString } => t !== null)
      : [];
    if (timeline.length > 0) {
      const intro = loc(r.intro);
      out.results = { ...(intro ? { intro } : {}), timeline };
    }
  }

  if (v.guarantee && typeof v.guarantee === "object") {
    const g = v.guarantee as { title?: unknown; body?: unknown };
    const title = loc(g.title);
    const body = loc(g.body);
    if (title && body) out.guarantee = { title, body };
  }

  if (v.comparison && typeof v.comparison === "object") {
    const c = v.comparison as { intro?: unknown; ours?: unknown; usual?: unknown };
    const ours = locArray(c.ours);
    const usual = locArray(c.usual);
    if (ours && usual) {
      const intro = loc(c.intro);
      out.comparison = { ...(intro ? { intro } : {}), ours, usual };
    }
  }

  if (v.objections && typeof v.objections === "object") {
    const o = v.objections as { items?: unknown };
    const items = Array.isArray(o.items)
      ? o.items
          .map((it) => {
            if (!it || typeof it !== "object") return null;
            const e = it as { objection?: unknown; response?: unknown };
            const objection = loc(e.objection);
            const response = loc(e.response);
            return objection && response ? { objection, response } : null;
          })
          .filter((it): it is { objection: LocalizedString; response: LocalizedString } => it !== null)
      : [];
    if (items.length > 0) out.objections = { items };
  }

  return Object.keys(out).length > 0 ? out : undefined;
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
// AI-generated rows carry `heroImageUrl`, which in practice is almost
// always a bare R2 object key (`studio-intake/<store>/…png`) — intake
// uploads and re-hosted images are stored as keys in the draft document
// and no upstream stage rewrites them to absolute URLs. We resolve
// those keys to the public CDN URL here (see `resolveCatalogImageRef`),
// so the storefront renders the real image instead of the placeholder.
// Absolute http(s)/data URLs pass through untouched; only truly
// unusable refs (unknown schemes, empty) fall back to the placeholder.

function synthesiseHeroImage(row: CatalogRow): ProductImage {
  const resolved =
    typeof row.heroImageUrl === "string"
      ? resolveCatalogImageRef(row.heroImageUrl)
      : null;
  if (resolved) {
    return {
      src: resolved,
      alt: { ar: "صورة المنتج", en: "Product image" },
    } satisfies ProductImage;
  }
  return PLACEHOLDER_PRODUCT_IMAGE satisfies ProductImage;
}

/**
 * Public CDN base used to resolve bare R2 object keys into URLs the
 * storefront can actually fetch. `R2_PUBLIC_BASE_URL_FANAA` is the
 * canonical source (same value the Studio uploader uses); we fall back
 * to the production custom domain — already whitelisted in
 * `next.config.mjs` remotePatterns — so resolution works even before
 * the env var is added to the web service. It is a PUBLIC URL, not a
 * credential, so it is safe to default here.
 */
const CATALOG_IMAGE_CDN_BASE = resolveCatalogImageCdnBase();

/**
 * Resolve the public CDN base. `R2_PUBLIC_BASE_URL_FANAA` is the
 * canonical source, BUT we guard against the common operator mistake of
 * pointing it at the PRIVATE S3 API endpoint
 * (`<account>.r2.cloudflarestorage.com/<bucket>`). That endpoint
 * requires SigV4 auth and is not browser-fetchable, so if it's set we
 * ignore it and fall back to the public custom domain (also the
 * remotePatterns-whitelisted host).
 */
function resolveCatalogImageCdnBase(): string {
  const env = process.env.R2_PUBLIC_BASE_URL_FANAA?.trim();
  if (env && !/r2\.cloudflarestorage\.com/i.test(env)) {
    return env.replace(/\/+$/, "");
  }
  return "https://cdn.elfanaa.com";
}

/**
 * Turn whatever is stored in `hero_image_url` into a value
 * `next/image` can render, or `null` when it's unusable.
 *
 * NOTE (Step 4 Phase 4.5): the canonical spec for this resolution lives in
 * `@platform/storage/public-url` (`resolveStorageRef`), which the Studio
 * publish hero gate uses. fanaa is intentionally decoupled from the workspace
 * schema/storage packages (it mirrors types locally for a standalone Docker
 * bundle — see lib/types.ts), so this is a behaviour-identical MIRROR, pinned
 * by both `apps/fanaa/__tests__/catalog-merge.test.ts` and
 * `packages/storage/src/__tests__/public-url.test.ts`. Keep the two in sync.
 *
 * The publish pipeline can store any of these shapes:
 *   • absolute `http(s)://…`        → use as-is (already a CDN/vendor URL)
 *   • inline `data:…`               → use as-is (placeholder/data URI)
 *   • `r2://<bucket>/<key>`         → strip scheme+bucket → CDN base + key
 *   • bare key `studio-intake/…png` → CDN base + key
 *
 * Bare keys are the common case: intake uploads and re-hosted images
 * are stored as R2 object keys in the draft document, and no upstream
 * stage rewrites them to absolute URLs. Resolving here means every
 * already-published row renders without a re-publish.
 */
/**
 * Recursively resolve EVERY image ref nested anywhere in a raw cro_content
 * JSON value through {@link resolveCatalogImageRef} (Phase 4.5.1).
 *
 * "Section-agnostic" means: we don't enumerate fields. Any object that carries
 * a string `src` — `images[]`, `lifestyleImage`, review `avatar`s, and every
 * future Phase 4.6 section image (mechanism / transformation / comparison /
 * ingredient / proof …) — has its `src` normalised to a fetchable CDN URL with
 * NO per-section code. An unresolvable ref keeps its original value so the
 * downstream `SafeProductImage` still swaps to the placeholder (never a black
 * tile). `src` is the ONLY image-bearing key in the cro_content contract, so
 * the walk can't touch non-image data.
 */
function resolveRawImageRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveRawImageRefs);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "src" && typeof v === "string") {
        out[key] = resolveCatalogImageRef(v) ?? v;
      } else {
        out[key] = resolveRawImageRefs(v);
      }
    }
    return out;
  }
  return value;
}

export function resolveCatalogImageRef(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("data:")) return value;
  if (/^https?:\/\//i.test(value)) {
    // A private R2 S3-endpoint URL (set when R2_PUBLIC_BASE_URL_FANAA was
    // misconfigured at publish time) is not browser-fetchable — rewrite
    // it to the public CDN. Any other absolute URL passes through.
    return rewriteR2EndpointUrl(value) ?? value;
  }
  if (value.startsWith("r2://")) {
    const withoutScheme = value.slice("r2://".length);
    const firstSlash = withoutScheme.indexOf("/");
    const key = firstSlash >= 0 ? withoutScheme.slice(firstSlash + 1) : "";
    return key ? `${CATALOG_IMAGE_CDN_BASE}/${key.replace(/^\/+/, "")}` : null;
  }
  // Any other URI scheme we don't understand (blob:, file:, ftp:, …) is
  // unusable. A scheme is letters/digits/+-./ followed by a colon before
  // the first slash; bare R2 keys (`studio-intake/fanaa/x.png`) never match.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  // Bare R2 object key.
  return `${CATALOG_IMAGE_CDN_BASE}/${value.replace(/^\/+/, "")}`;
}

/**
 * Rewrite a private R2 S3-endpoint URL to the public CDN URL, or return
 * `null` for any other host (the caller then passes the URL through).
 *
 * Input:  https://<account>.r2.cloudflarestorage.com/<bucket>/<key...>
 * Output: <CDN_BASE>/<key...>   (the bucket segment is dropped because
 *         the custom domain is bound to the bucket root)
 */
function rewriteR2EndpointUrl(absoluteUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return null;
  }
  if (!/\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname)) return null;
  const segments = parsed.pathname.replace(/^\/+/, "").split("/");
  if (segments.length < 2) return null; // need <bucket>/<key>
  const key = segments.slice(1).join("/");
  return key ? `${CATALOG_IMAGE_CDN_BASE}/${key}` : null;
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

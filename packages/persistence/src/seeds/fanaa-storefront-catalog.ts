/**
 * Fanaa curated storefront catalog seed (M12 / Step 2 — Phase 2.2).
 *
 * # What this seed does
 *
 * Upserts the four hand-tuned fanaa products from
 * `apps/fanaa/data/products.ts` into the `storefront_catalog_product`
 * table. The seed populates the **commerce metadata** half only —
 * price, SKU, collection, problems, badges, rating, upsells, landing
 * path. The CRO content half (benefits / faq / reviews / ingredients)
 * remains the source-of-truth inside `apps/fanaa/data/products.ts`
 * per the M12 Step-2 Decision 3(a).
 *
 * # When this seed runs
 *
 *   • **Local dev**: once, after `prisma migrate dev` lands the
 *     0004_storefront_catalog_product migration on a fresh database.
 *   • **Production**: ONCE, by an operator from their dev machine
 *     with `ADMIN_DATABASE_URL` pointed at the production database.
 *     Re-running is safe — the upsert key is `(storeId, slug)`.
 *
 * # Idempotency
 *
 * Every write goes through `upsert`. Running this seed twice is
 * indistinguishable from running it once. Editing a row in this file
 * and re-running propagates the edit to the DB; nothing else
 * changes. The store row is bootstrapped via `StudioStoreRepository`
 * for the same reason — fresh databases need the row to satisfy the
 * `storefront_catalog_product.store_id` FK.
 *
 * # Transaction
 *
 * All writes run inside a single `prisma.$transaction`. If ANY upsert
 * fails the entire seed rolls back, so a partial seed can never
 * leave the catalog in a half-populated state.
 *
 * # Why upsellIds carry slugs, not product IDs
 *
 * `products.ts` uses product IDs (`p_001` etc.) inside `upsellIds`.
 * The catalog table is keyed on `(storeId, slug)`, never on `id`.
 * Storing IDs would force the loader to maintain a parallel id→slug
 * map; storing slugs keeps every lookup a single indexed read.
 */

import type { PrismaLike, StorefrontCatalogProductRow } from "../contracts";
import { StorefrontCatalogProductRepository } from "../repositories/storefront-catalog";
import { StudioStoreRepository } from "../repositories/store";

/** Input shape for one curated catalog row. */
export interface FanaaCuratedRow {
  slug: string;
  sku: string;
  priceMinor: number;
  priceCurrency: string;
  offerTiers: ReadonlyArray<{
    quantity: number;
    total: { amount: number; currency: string };
  }>;
  collection: string | null;
  productType: string | null;
  target: string | null;
  problems: ReadonlyArray<string>;
  badges: ReadonlyArray<{ ar: string; en: string }>;
  rating: { value: number; count: number };
  stockLeft: number | null;
  recentBuyers: number | null;
  /** Other catalog slugs cross-sold by this product. */
  upsellIds: ReadonlyArray<string>;
  /** Optional URL override (e.g. /sugarbear bespoke landing). */
  landingPath: string | null;
}

/**
 * The four curated products, mirroring `apps/fanaa/data/products.ts`.
 *
 * Edits here propagate to the DB on the next seed run; they do NOT
 * propagate automatically to the bundled CRO content in
 * `apps/fanaa/data/products.ts`. Operators MUST keep slug + sku +
 * price + offer-tier shape aligned across both files — drift is
 * caught by the M12 Phase-2.4 smoke test which renders every curated
 * PDP and verifies the price chip matches the cart price.
 */
export const FANAA_CURATED_CATALOG: ReadonlyArray<FanaaCuratedRow> = [
  // ── p_001 — Glow Serum ─────────────────────────────────────────────
  {
    slug: "glow-serum",
    sku: "FN-SERUM-001",
    priceMinor: 19_900,
    priceCurrency: "SAR",
    offerTiers: [
      { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
    ],
    collection: "face",
    productType: "serum",
    target: "women",
    problems: ["dark-spots", "dryness", "uneven-tone"],
    badges: [
      { ar: "الأكثر طلباً في السعودية", en: "Most ordered in KSA" },
      { ar: "نتائج خلال ١٤ يوم", en: "Results in 14 days" },
      { ar: "+٣١٢ تقييم سعودي", en: "312+ Saudi reviews" },
    ],
    rating: { value: 4.9, count: 312 },
    stockLeft: 14,
    recentBuyers: 31,
    upsellIds: ["barrier-cream", "hair-mask"],
    landingPath: null,
  },
  // ── p_002 — Barrier Repair Cream ───────────────────────────────────
  {
    slug: "barrier-cream",
    sku: "FN-CREAM-002",
    priceMinor: 19_900,
    priceCurrency: "SAR",
    offerTiers: [
      { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
    ],
    collection: "face",
    productType: "cream",
    target: "unisex",
    problems: ["dryness", "barrier-damage", "sensitive-skin"],
    badges: [
      { ar: "ترطيب ٢٤ ساعة", en: "24-hour hydration" },
      { ar: "بدون عطور", en: "Fragrance-free" },
      { ar: "مختبر طبياً", en: "Clinically tested" },
    ],
    rating: { value: 4.8, count: 187 },
    stockLeft: 9,
    recentBuyers: 22,
    upsellIds: ["glow-serum", "hair-mask"],
    landingPath: null,
  },
  // ── p_003 — Deep Repair Mask ───────────────────────────────────────
  {
    slug: "hair-mask",
    sku: "FN-HAIRMASK-003",
    priceMinor: 19_900,
    priceCurrency: "SAR",
    offerTiers: [
      { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
    ],
    collection: "hair",
    productType: "mask",
    target: "women",
    problems: ["hair-damage", "hair-dryness", "breakage", "color-treated"],
    badges: [
      { ar: "للشعر التالف والمصبوغ", en: "For damaged & colored hair" },
      { ar: "نعومة من أول استخدام", en: "Softness from first use" },
      { ar: "+٢٤١ تقييم سعودي", en: "241+ Saudi reviews" },
    ],
    rating: { value: 4.9, count: 241 },
    stockLeft: 11,
    recentBuyers: 26,
    upsellIds: ["glow-serum", "barrier-cream"],
    landingPath: null,
  },
  // ── p_004 — Sugarbear Hair Vitamins ────────────────────────────────
  // The bespoke /sugarbear landing experience owns this product end-to-
  // end. `landingPath` is the kill-switch that tells the storefront
  // shop card to navigate to `/sugarbear` instead of the default
  // `/products/sugarbear-hair` PDP template.
  {
    slug: "sugarbear-hair",
    sku: "FN-SUG-004",
    priceMinor: 19_900,
    priceCurrency: "SAR",
    offerTiers: [
      { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
      { quantity: 2, total: { amount: 27_900, currency: "SAR" } },
      { quantity: 3, total: { amount: 34_900, currency: "SAR" } },
    ],
    collection: "hair",
    productType: null,
    target: null,
    problems: [],
    badges: [
      { ar: "تركيبة نباتية ١٠٠٪", en: "100% Vegan" },
      { ar: "خالٍ من الجلوتين", en: "Gluten Free" },
      { ar: "بنكهة التوت الطبيعية", en: "Natural Berry Flavor" },
    ],
    rating: { value: 4.9, count: 12_647 },
    stockLeft: 23,
    recentBuyers: 47,
    upsellIds: ["barrier-cream", "hair-mask"],
    landingPath: "/sugarbear",
  },
];

/**
 * Identifier for the fanaa `StudioStore` row. Mirrors `fanaaStore.id`
 * from `@platform/stores` without importing it — keeps this seed
 * dependency-free so it can run against any DB regardless of which
 * apps are present in the workspace.
 */
const FANAA_STORE_ID = "fanaa";
const FANAA_STORE_DISPLAY_NAME = "Fanaa";

/** Stable opaque hash for the seeded store row's `configHash`. The
 *  real Studio runtime computes this from the live `StoreConfig`
 *  shape; the seed pins it to a deterministic sentinel so we never
 *  accidentally rewrite the live config_hash with seed-time noise. */
const FANAA_STORE_CONFIG_HASH_SENTINEL = "seed-storefront-catalog";

/** Result returned by `seedFanaaStorefrontCatalog`. Tests + the CLI
 *  log this for the operator's audit trail. */
export interface FanaaCatalogSeedResult {
  storeId: string;
  rows: ReadonlyArray<{ slug: string; id: string; created: boolean }>;
}

/**
 * Idempotently upserts the four curated fanaa catalog rows.
 *
 * @param prisma  Prisma client (real or mocked).
 * @returns       Summary suitable for stdout logging.
 *
 * # What "created" means in the result
 *
 * `upsert` doesn't expose a created-vs-updated bit, so we infer it
 * from a pre-flight `findBySlug`: absent → created, present →
 * updated. The pre-flight read is cheap (single indexed lookup per
 * slug) and gives the operator a meaningful "first run vs. re-run"
 * signal.
 */
export async function seedFanaaStorefrontCatalog(
  prisma: PrismaLike,
): Promise<FanaaCatalogSeedResult> {
  const storeRepo = new StudioStoreRepository({ prisma });
  const catalogRepo = new StorefrontCatalogProductRepository({ prisma });

  return await prisma.$transaction(async (tx) => {
    const txStoreRepo = new StudioStoreRepository({ prisma: tx });
    const txCatalogRepo = new StorefrontCatalogProductRepository({ prisma: tx });

    // Use the OUTER repo refs at type level but route writes through
    // the transaction-scoped repos. Keeping a reference to the outer
    // repos catches accidental mismatches in tests where the mock
    // `$transaction` short-circuits without rebuilding the repos.
    void storeRepo;
    void catalogRepo;

    // ── Ensure the StudioStore row exists ─────────────────────────
    await txStoreRepo.upsert({
      id: FANAA_STORE_ID,
      displayName: FANAA_STORE_DISPLAY_NAME,
      configHash: FANAA_STORE_CONFIG_HASH_SENTINEL,
      status: "live",
    });

    // ── Upsert each curated catalog row ───────────────────────────
    const rows: { slug: string; id: string; created: boolean }[] = [];
    for (const row of FANAA_CURATED_CATALOG) {
      const existing = await txCatalogRepo.findBySlug({
        storeId: FANAA_STORE_ID,
        slug: row.slug,
      });
      const persisted: StorefrontCatalogProductRow = await txCatalogRepo.upsert({
        storeId: FANAA_STORE_ID,
        slug: row.slug,
        source: "curated",
        priceMinor: row.priceMinor,
        priceCurrency: row.priceCurrency,
        sku: row.sku,
        offerTiers: row.offerTiers,
        collection: row.collection,
        productType: row.productType,
        target: row.target,
        problems: row.problems,
        badges: row.badges,
        rating: row.rating,
        stockLeft: row.stockLeft,
        recentBuyers: row.recentBuyers,
        upsellIds: row.upsellIds,
        landingPath: row.landingPath,
        isLive: true,
      });
      rows.push({
        slug: persisted.slug,
        id: persisted.id,
        created: existing === null,
      });
    }

    return { storeId: FANAA_STORE_ID, rows };
  });
}

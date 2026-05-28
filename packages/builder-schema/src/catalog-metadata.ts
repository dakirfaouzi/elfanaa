import { z } from "zod";

/**
 * Catalog metadata — operator-editable commerce shape attached to a
 * `DraftDocument` and persisted to `storefront_catalog_product` on
 * publish (M12 / Step 2 / Phase 2.3).
 *
 * # Role in the hybrid loader
 *
 * fanaa's hybrid storefront catalog (Phase 2.2) reads commerce data
 * from `storefront_catalog_product` and overlays it onto the
 * build-time snapshot in `apps/fanaa/data/products.ts`. Phase 2.3
 * is the upstream half: this schema describes the shape the Studio
 * draft builder lets the operator edit, and the publish flow upserts
 * those values into the catalog table. The merge contract in
 * `apps/fanaa/lib/catalog/merge.ts` lists, field-by-field, which
 * inputs here override the snapshot and which never reach commerce
 * (the snapshot's CRO content always wins).
 *
 * # Why "liberal in, strict in UI"
 *
 * - The catalog table accepts `null` for every commerce-side field
 *   (the persistence layer treats `null` as "clear / use fallback").
 *   We mirror that contract here so the schema works as the
 *   round-trip wire format AND as the form-state.
 * - Enum fields (`collection`, `productType`, `target`, individual
 *   `problems`) are typed as `z.string()` — the Fanaa taxonomy lives
 *   in `@platform/catalog-schema/extensions/fanaa.ts` and the UI
 *   surfaces it as a dropdown, but the schema stays open so future
 *   stores with different taxonomies can ship without a schema bump.
 *   The storefront-side hybrid loader does the same (it does not
 *   enforce closed-union values either).
 *
 * # Money representation
 *
 * `priceMinor` carries integer minor units (halalas for SAR, fils
 * for AED), matching the `storefront_catalog_product.price_minor`
 * column and the `apps/fanaa/lib/types.ts::Money.amount` convention.
 * Operators type major-unit amounts in the UI; the panel converts
 * at the input boundary so the schema never has to deal with
 * floats.
 *
 * # Offer tiers
 *
 * The shape mirrors `apps/fanaa/lib/types.ts::OfferTier` exactly
 * (`{ quantity, total: { amount, currency } }`) so the snapshot,
 * the storefront merge function, the seed CLI, and the catalog
 * panel all speak the same shape. Note: this is a different shape
 * from the **intake** offers in `@platform/ingest/metadata/offers`
 * (which carries `label` + `bundlePrice` in major units). The
 * catalog-metadata-defaults helper translates between them.
 *
 * # Backward compatibility
 *
 * The entire `catalogMetadata` field is optional on `DraftDocument`:
 * drafts created before Phase 2.3 parse cleanly. The draft mapper
 * synthesises defaults on the next save, and the publish flow only
 * upserts a catalog row when the field is present.
 */

/* -------------------------------------------------------------------------- */
/*                                  Primitives                                 */
/* -------------------------------------------------------------------------- */

/**
 * ISO 4217 currency code — uppercase, length 3 (e.g. "SAR", "AED",
 * "USD"). Kept lax (`z.string().length(3)`) so a future PR adding a
 * new currency doesn't require a schema PR here.
 */
export const CurrencyCodeSchema = z.string().length(3);

/**
 * Money — integer minor units + currency.
 *
 * Mirrors `apps/fanaa/lib/types.ts::Money`. The `amount` field is
 * `z.number().int()` because every storefront / cart / pricing
 * math operation in fanaa assumes integers; floating-point sneaks
 * in via copy-pasted values (`19_900.0` after a JSON round trip)
 * which then silently double the rendered subtotal. Refusing
 * non-integer amounts at the schema is the cheapest place to catch
 * the regression.
 */
export const CatalogMoneySchema = z.object({
  amount: z.number().int().nonnegative().max(100_000_000),
  currency: CurrencyCodeSchema,
});
export type CatalogMoney = z.infer<typeof CatalogMoneySchema>;

/**
 * Offer tier — the line total for a fixed bundle quantity.
 *
 * `total` is the LINE total at the exact quantity, NOT the per-unit
 * price (this matches `apps/fanaa/lib/types.ts::OfferTier` and the
 * pricing engine in `apps/fanaa/lib/pricing.ts::lineTotal`). Per-unit
 * is derived downstream as `total.amount / quantity`.
 *
 * `quantity` capped at 99 — matches `@platform/ingest/metadata/offers`
 * so the two ingest-time vs. catalog-time shapes can be cross-walked
 * without truncation surprises.
 */
export const CatalogOfferTierSchema = z.object({
  quantity: z.number().int().positive().max(99),
  total: CatalogMoneySchema,
});
export type CatalogOfferTier = z.infer<typeof CatalogOfferTierSchema>;

/**
 * Localized string — same shape as the rest of the builder
 * (`{ ar?: string, en?: string }`) but BOTH locales required for a
 * badge. A badge with only one locale renders blank on the inactive
 * locale, which is worse than no badge at all.
 */
export const CatalogBadgeSchema = z.object({
  ar: z.string().min(1).max(60),
  en: z.string().min(1).max(60),
});
export type CatalogBadge = z.infer<typeof CatalogBadgeSchema>;

/**
 * Aggregate rating — value (0..5) + count. Both must be present
 * together; the storefront's PDP renders "—" when either is missing
 * which is uglier than just hiding the rating widget.
 */
export const CatalogRatingSchema = z.object({
  value: z.number().min(0).max(5),
  count: z.number().int().nonnegative().max(10_000_000),
});
export type CatalogRating = z.infer<typeof CatalogRatingSchema>;

/* -------------------------------------------------------------------------- */
/*                              Top-level shape                                */
/* -------------------------------------------------------------------------- */

/**
 * `CatalogMetadata` — the commerce-half of a `DraftDocument`.
 *
 * Every field except `priceMinor` + `priceCurrency` is nullable.
 * Nulls are the canonical "absent / use snapshot fallback" signal
 * and match the `StorefrontCatalogProductRepository.upsert`
 * `null = clear, undefined = leave as-is` contract.
 *
 * `priceMinor` + `priceCurrency` are required because every
 * commerce row needs at least a baseline price. The draft mapper
 * seeds them from `priceHint` on the first auto-derivation pass
 * so an operator never opens the panel to a price-less row.
 */
export const CatalogMetadataSchema = z.object({
  // ── Required: baseline price ────────────────────────────────────
  priceMinor: z.number().int().nonnegative().max(100_000_000),
  priceCurrency: CurrencyCodeSchema,

  // ── Optional: identity + bundles ─────────────────────────────────
  sku: z.string().max(80).nullable().default(null),
  offerTiers: z.array(CatalogOfferTierSchema).max(10).default([]),

  // ── Optional: storefront taxonomy ────────────────────────────────
  // These read as enums in the UI but stay free-string in the schema
  // so future stores can add their own taxonomies without a schema
  // bump. See `apps/fanaa/lib/catalog/merge.ts` for the equivalent
  // permissive treatment at the storefront-side loader.
  collection: z.string().max(80).nullable().default(null),
  productType: z.string().max(80).nullable().default(null),
  target: z.string().max(80).nullable().default(null),
  problems: z.array(z.string().min(1).max(80)).max(20).default([]),

  // ── Optional: marketing surface ──────────────────────────────────
  badges: z.array(CatalogBadgeSchema).max(8).default([]),
  rating: CatalogRatingSchema.nullable().default(null),
  stockLeft: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  recentBuyers: z.number().int().nonnegative().max(1_000_000).nullable().default(null),

  // ── Optional: cross-sell + routing ───────────────────────────────
  upsellIds: z.array(z.string().min(1).max(80)).max(16).default([]),
  /**
   * Optional bespoke-landing URL override (e.g. "/sugarbear"). When
   * set, fanaa's PDP route 308-redirects to this path — see
   * `apps/fanaa/app/products/[slug]/page.tsx` for the contract.
   * Must start with "/"; absolute URLs are rejected to keep cross-
   * origin traffic out of the storefront's internal links.
   */
  landingPath: z
    .string()
    .min(1)
    .max(200)
    // Must start with `/` followed by a non-`/` character. The
    // second clause rejects protocol-relative URLs like
    // `//evil.example.com` which the browser treats as the
    // current scheme + new authority — same exfil class as an
    // outright `https://` redirect.
    .regex(/^\/[^/]/, "landing_path_must_be_relative")
    .nullable()
    .default(null),
});
export type CatalogMetadata = z.infer<typeof CatalogMetadataSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Defaults                                   */
/* -------------------------------------------------------------------------- */

/**
 * `emptyCatalogMetadata` — a minimal-but-valid `CatalogMetadata`
 * with `priceMinor = 0` and `priceCurrency = "SAR"`. Used by:
 *
 *   • `makeBlankDraft` when the operator clicks "New draft" in the
 *     UI (no pipeline output to derive from).
 *   • The catalog-metadata-defaults helper as the floor that
 *     pipeline-derived values are layered on top of.
 *   • Tests that need a typed-but-empty object without re-deriving
 *     every default by hand.
 *
 * `priceCurrency` defaults to `"SAR"` because:
 *   • Every store wired into the platform today (fanaa) is SAR.
 *   • Validation requires the column to be exactly 3 chars; an
 *     empty default would trip a Zod failure on the first save
 *     before the operator has had a chance to pick the right
 *     currency.
 *
 * Future stores with non-SAR defaults can override at the
 * `productToDraftDocument` layer.
 */
export function emptyCatalogMetadata(): CatalogMetadata {
  return {
    priceMinor: 0,
    priceCurrency: "SAR",
    sku: null,
    offerTiers: [],
    collection: null,
    productType: null,
    target: null,
    problems: [],
    badges: [],
    rating: null,
    stockLeft: null,
    recentBuyers: null,
    upsellIds: [],
    landingPath: null,
  };
}

/**
 * `hasMeaningfulCatalogMetadata` — true when the operator has set
 * enough fields that the publish flow should upsert a catalog row.
 *
 * The publish flow uses this to decide between:
 *   • "No catalog metadata yet — skip the upsert, just write the
 *     studio_published_product row." (the legacy path)
 *   • "Catalog metadata present — upsert the catalog row so the
 *     product appears on /shop." (the Phase 2.3 path)
 *
 * Tier-A heuristic: `priceMinor > 0`. The draft mapper synthesises
 * `priceMinor` from `priceHint` when it can, so a non-zero price is
 * the strongest signal that the metadata is "ready". An operator
 * who wants to publish without commerce metadata simply leaves the
 * panel as `priceMinor = 0` and the upsert is skipped.
 */
export function hasMeaningfulCatalogMetadata(meta: CatalogMetadata): boolean {
  return meta.priceMinor > 0;
}

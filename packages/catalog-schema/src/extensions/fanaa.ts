import type { LocalizedString, Money } from "../locales";

/**
 * FanaaProductExtension — fields the Fanaa storefront (`apps/fanaa/`) needs
 * that DO NOT belong in the universal shape.
 *
 * # Why an extension and not part of UniversalProduct?
 *
 * Anything in UniversalProduct must be meaningful for every store. Things
 * like:
 *
 *   • `landingPath`  — only Fanaa has a bespoke-landing concept today.
 *   • `offerTiers`   — Fanaa's volume-pricing bundle ("1=199, 2=279, 3=349")
 *                       isn't how Shopify or TikTok Shop expose offers.
 *   • `sku`          — Fanaa's `FN-<TOKEN>-<NNN>` format is a publisher
 *                       concern; Shopify generates its own.
 *   • `productType`/`target`/`problems` — Fanaa filter taxonomy. Other
 *                       stores will have their own collection systems.
 *   • `stockLeft`/`recentBuyers` — Fanaa-specific scarcity hints.
 *
 * The eventual M7 `FanaaPublisher.publish()` computes these from the
 * UniversalProduct + StoreConfig and writes the combined object to
 * `apps/fanaa/data/products.ts`. The storefront's `Product` type stays
 * unchanged (its fields end up being the union of UniversalProduct's
 * customer-facing fields + FanaaProductExtension).
 *
 * Values mirror `apps/fanaa/lib/types.ts` so the M7 mapping is a 1:1
 * rename rather than a structural transform.
 */
export interface FanaaProductExtension {
  /**
   * Optional bespoke-landing route (e.g. "/sugarbear"). When set the
   * Fanaa storefront swaps the generic PDP for a CRO landing template
   * — see apps/fanaa/lib/types.ts `Product.landingPath` for the full
   * redirect contract.
   */
  landingPath?: string;

  /**
   * Operational SKU surfaced to the warehouse / Aramex / accounting.
   * Format: `FN-<TOKEN>-<NNN>` (apps/fanaa/lib/sku.ts).
   * Optional because publishers may auto-generate when omitted.
   */
  sku?: string;

  /** Comparison "was X SAR" price for the strikethrough display. */
  compareAtPrice?: Money;

  /** Volume-pricing tiers — see apps/fanaa/lib/pricing.ts. */
  offerTiers?: FanaaOfferTier[];

  /** Display badges (e.g. "Best-seller", "New"). */
  badges?: LocalizedString[];

  /** Storefront collection slug — drives ProductCard / collection routing. */
  collection?: string;

  /** UniversalProduct.id references to surface as cross-sells on this PDP. */
  upsellIds?: string[];

  // ─── Filter taxonomy ─────────────────────────────────────────────────
  /** Physical form. Drives the "Product Type" filter. */
  productType?: FanaaProductType;
  /** Primary intended audience. Drives the "For" filter. */
  target?: FanaaProductTarget;
  /** Concerns this product addresses. Drives the "Concern" filter. */
  problems?: FanaaProductProblem[];

  // ─── Display-only scarcity hints ─────────────────────────────────────
  /** "Only X left." Display-only; does NOT gate inventory. */
  stockLeft?: number;
  /** "X people bought today." Display-only. */
  recentBuyers?: number;
}

/**
 * Volume-pricing tier. Mirrors `apps/fanaa/lib/types.ts` `OfferTier`.
 * `total` is the LINE total at that exact quantity (not unit price).
 */
export type FanaaOfferTier = {
  quantity: number;
  total: Money;
};

/**
 * Fanaa product-type taxonomy. Closed union; expanding it is a storefront
 * concern (drives filter UI). Keep in sync with
 * apps/fanaa/lib/types.ts `ProductType`.
 */
export type FanaaProductType =
  | "serum"
  | "cream"
  | "mask"
  | "oil"
  | "capsules"
  | "spray"
  | "device"
  | "bundle";

/** Audience filter. Keep in sync with apps/fanaa/lib/types.ts. */
export type FanaaProductTarget = "women" | "men" | "unisex";

/**
 * Skin/hair concern taxonomy. Closed union — keep in sync with
 * apps/fanaa/lib/types.ts `ProductProblem`. Adding a new concern is
 * a storefront change (filter UI + collection mapping).
 */
export type FanaaProductProblem =
  | "dark-spots"
  | "dryness"
  | "uneven-tone"
  | "barrier-damage"
  | "sensitive-skin"
  | "oily-skin"
  | "pores"
  | "hair-damage"
  | "hair-dryness"
  | "breakage"
  | "color-treated"
  | "hair-loss"
  | "complete-care";

/**
 * Core domain types.
 *
 * Currency is stored as integer minor units (e.g. 12500 = 125.00) to avoid
 * floating-point rounding errors during subtotal/tax/discount math.
 */

export type Locale = "ar" | "en";

export type Money = {
  amount: number; // minor units
  currency: string; // ISO 4217, e.g. "MAD", "AED", "SAR"
};

export type LocalizedString = Record<Locale, string>;

export type ProductImage = {
  src: string;
  alt: LocalizedString;
};

export type ProductVariant = {
  id: string;
  title: LocalizedString;
  price: Money;
  compareAtPrice?: Money;
  inventory: number;
};

/**
 * Volume-pricing tier. Applied per-product so a single SKU can be sold as
 * "1 = 199, 2 = 279, 3 = 349" without complicating other products in the cart.
 * `total` is the LINE total at that exact quantity (not the unit price).
 */
export type OfferTier = {
  quantity: number;
  total: Money;
};

export type Product = {
  id: string;
  slug: string;
  title: LocalizedString;
  description: LocalizedString;
  images: ProductImage[];
  price: Money;
  compareAtPrice?: Money;
  badges?: LocalizedString[];
  variants?: ProductVariant[];
  rating?: { value: number; count: number };
  collection?: string;
  upsellIds?: string[];
  /** Bundle pricing tiers — see lib/pricing.ts. */
  offerTiers?: OfferTier[];

  /* ------------------------- CRO content surface ----------------------- */

  /**
   * Strong emotional headline shown on the PDP — overrides the product
   * `title` for the H1. The title still drives metadata and the cart UI;
   * the headline drives conversion ("Spots fade. Glow arrives.",
   * not "Glow Serum").
   */
  headline?: LocalizedString;

  /**
   * One-line subhead under the headline. Calmer than the headline,
   * carries the brand promise for this specific SKU.
   */
  subheadline?: LocalizedString;

  /**
   * Lifestyle band image — separate from the gallery so the editorial
   * section uses the *aspirational* photo, not the product cut-out.
   */
  lifestyleImage?: ProductImage;

  /**
   * Benefits, NOT features. Each item is 1 emotional sentence + the
   * literal feature behind it. Rendered as 4 cards on the PDP. Icons
   * match Lucide names; the component falls back to a neutral icon if
   * the name is unknown.
   */
  benefits?: ProductBenefit[];

  /**
   * Per-product FAQ. Premium DTC playbook: handle the top 3–5 buying
   * objections in line with the PDP, not buried in a help center.
   */
  faq?: ProductFaq[];

  /**
   * Curated review excerpts surfaced under the gallery. Falls back to
   * the aggregated `rating` when not provided.
   */
  reviews?: ProductReview[];

  /**
   * Scarcity hints. Both fields are display-only — they do NOT gate
   * inventory. Use `stockLeft` for "only X left" and `recentBuyers` for
   * "X people bought today". Static values are fine for an MVP, but
   * back them with live numbers as soon as the order count justifies it.
   */
  stockLeft?: number;
  recentBuyers?: number;
};

export type ProductBenefit = {
  icon: string; // lucide icon name (e.g. "Sparkles", "Shield", "Hand")
  title: LocalizedString;
  body: LocalizedString;
};

export type ProductFaq = {
  q: LocalizedString;
  a: LocalizedString;
};

export type ProductReview = {
  name: LocalizedString;
  /** City name — adds geographic credibility for KSA buyers. */
  city: LocalizedString;
  rating: number;
  body: LocalizedString;
  /** ISO yyyy-mm-dd, used as a recency hint. */
  date: string;
  verified?: boolean;
};

export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export type Cart = {
  lines: CartLine[];
  currency: string;
};

/**
 * Single source of truth for the COD checkout payload.
 *
 * Designed for a *minimum-friction* funnel (Baymard: -4–6% conversion per
 * extra field). City/address/landmark are intentionally captured later via a
 * confirmation WhatsApp/call instead of upfront, which is what high-converting
 * GCC COD funnels do (CODRocket / EasySell benchmarks).
 */
export type CodOrderInput = {
  fullName: string;
  /** Saudi mobile in local format `05XXXXXXXX` after client-side normalisation. */
  phone: string;
  cart: Cart;
  locale: Locale;
};

export type Collection = {
  id: string;
  slug: string;
  title: LocalizedString;
  productIds: string[];
};

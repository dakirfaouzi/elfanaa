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
  /**
   * Semantic scene role (Phase 4.6.3) — `mechanism` | `result` | `ingredient`
   * | `proof` | `context` | `trust` | `detail` | …. Drives section-aware image
   * assignment in `ProductSections`. Absent on curated/gallery images.
   */
  intent?: string;
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
  /**
   * Optional bespoke landing-page route (e.g. `/sugarbear`). When set, the
   * product is treated as having a hero/CRO landing experience that lives
   * outside the generic `/products/[slug]` template:
   *
   *   • Every internal link (ProductCard, related/recommendation rows,
   *     menu entries) resolves through `productHref()` and points here.
   *   • The generic `/products/[slug]` route 308-redirects to this path
   *     (both at the edge via `next.config.mjs` AND at runtime as a
   *     safety net) so SEO equity collapses onto a single canonical URL.
   *
   * Pattern for future products: build the bespoke page under
   * `app/<route>/...`, then add `landingPath: "/<route>"` here AND a
   * corresponding entry in `next.config.mjs` `redirects()`. Nothing else
   * in the catalog code needs to change.
   */
  landingPath?: string;
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
  /**
   * Dedicated product (id/slug) shown in the 99-SAR post-purchase offer.
   * Separate from `upsellIds` (the recommendation pool) so operators control
   * the post-purchase offer independently. Resolved id-or-slug; undefined →
   * the post-purchase resolver falls back to its scoring heuristic.
   */
  postPurchaseUpsellId?: string;
  /** Bundle pricing tiers — see lib/pricing.ts. */
  offerTiers?: OfferTier[];

  /**
   * Operational SKU shown to the warehouse / shipping partner / accounting.
   * Format `FN-<TOKEN>-<NNN>` (see `lib/sku.ts`). Optional because future
   * products that forget this field fall back to a deterministic generated
   * SKU — but pin one explicitly the moment an external system depends on
   * it (Aramex labels, ERP, etc).
   */
  sku?: string;

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
   * The generated scene pool (Phase 4.6.2). The PDP distributes these across
   * image-capable sections so the page reads image-led. AI-published rows carry
   * the full set; curated rows usually carry none (text-only fallback).
   */
  lifestyleImages?: ProductImage[];

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

  /**
   * Key active ingredients for the clinical/premium positioning.
   */
  ingredients?: ProductIngredient[];

  /* ─────────────────────── Filter metadata ─────────────────────── */

  /** Physical form of the product — drives the "Product Type" filter. */
  productType?: ProductType;
  /**
   * Primary intended audience — drives the "For" filter.
   * Use "unisex" when the product is genuinely gender-neutral
   * (e.g. the Barrier Cream), not as a lazy default.
   */
  target?: ProductTarget;
  /**
   * Skin / hair concerns this product addresses — drives the "Concern" filter.
   * Multi-value so one product can solve multiple problems.
   */
  problems?: ProductProblem[];

  /* ───────────── Step 4 — rich AI-generated CRO sections ───────────── */

  /** Founder / brand-story note rendered as its own section. */
  foundersNote?: LocalizedString;
  /**
   * Rich conversion sections generated by the AI pipeline (mechanism,
   * results, guarantee, comparison, objections). Present only for
   * AI-published products that carry a `cro_content` projection.
   */
  sectionContent?: SectionContent;
  /**
   * AI-chosen section ordering (catalog SectionKind strings). When present,
   * the PDP renders sections in this order; otherwise it uses the default
   * fixed DTC order.
   */
  sectionOrder?: string[];
};

export type ProductIngredient = {
  name: LocalizedString;
  role: LocalizedString;
};

/* ───────────────── Step 4 — section content shapes ───────────────── */

export type MechanismStep = { title: LocalizedString; body: LocalizedString };
export type HowItWorksContent = {
  summary: LocalizedString;
  steps: MechanismStep[];
};
export type ResultMilestone = { when: LocalizedString; outcome: LocalizedString };
export type ResultsContent = {
  intro?: LocalizedString;
  timeline: ResultMilestone[];
};
export type GuaranteeContent = { title: LocalizedString; body: LocalizedString };
export type ComparisonContent = {
  intro?: LocalizedString;
  ours: LocalizedString[];
  usual: LocalizedString[];
};
export type ObjectionItem = {
  objection: LocalizedString;
  response: LocalizedString;
};
export type ObjectionsContent = { items: ObjectionItem[] };
export type SectionContent = {
  howItWorks?: HowItWorksContent;
  results?: ResultsContent;
  guarantee?: GuaranteeContent;
  comparison?: ComparisonContent;
  objections?: ObjectionsContent;
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

/**
 * How a cart line was introduced. Drives the deterministic
 * `base / upsell / cross_sell` slot ordering written to the
 * Google Sheets "Product name" / "Total quantity" / "SKU"
 * columns by the order webhook.
 *
 * - `"base"`        — a product added from a PDP / shop / hero CTA.
 * - `"cross_sell"`  — a product added from the in-cart cross-sell
 *                     card (`components/cart/CrossSellCard.tsx`).
 *
 * Post-purchase upsells live in a separate flow (added by
 * `app/api/orders/[orderId]/upsell/route.ts`) and never appear
 * as a cart line — they get the `"post_purchase_upsell"` source
 * on the order receipt and the `"upsell"` source in the DB.
 *
 * Optional + `"base"` default so legacy persisted carts deserialise
 * without migration; older entries simply behave as base lines.
 */
export type CartLineSource = "base" | "cross_sell";

export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
  source?: CartLineSource;
  /**
   * Embedded product record captured at add-time (M12 / Step 2 /
   * Phase 2.5 — "bridge the catalog split").
   *
   * # Why this exists
   *
   * The fanaa catalog is split into two sources:
   *   • Snapshot (`data/products.ts`) — built into the JS bundle.
   *     Owns CRO content. Race-safe for the order re-pricer.
   *   • Hybrid loader (`lib/catalog/loader.ts`) — DB-backed.
   *     Owns AI-generated products published from Studio.
   *
   * Every client-side cart selector (`useResolvedCartLines`,
   * `useCartSubtotal`, `resolveCartCrossSells`) historically did
   * `getProductById(line.productId)` against the SNAPSHOT ONLY. AI-
   * generated products were silently filtered out: cart drawer
   * empty, subtotal stuck at 0, checkout 422'd at re-price. The
   * symptoms map 1:1 to the "Add to cart silently does nothing"
   * report.
   *
   * # How this field fixes it
   *
   * The PDP / ProductCard / CrossSellCard already have the full
   * `Product` in scope (they got it from the hybrid loader server-
   * side and received it as a prop). When they call `useCart.add`,
   * they pass the Product object via `opts.product` and it lands
   * here on the cart line. Every selector then prefers
   * `line.productSnapshot` over `getProductById(line.productId)`,
   * which means:
   *   • Snapshot products: identical behaviour (productSnapshot
   *     === getProductById result; either source works).
   *   • AI-generated products: productSnapshot is the ONLY source
   *     (snapshot misses), so the cart renders correctly.
   *
   * # Backward compatibility
   *
   * Optional by design — legacy persisted Zustand carts from before
   * Phase 2.5 deserialise unchanged and selectors fall through to
   * the old `getProductById` path automatically. No migration
   * needed; the field self-populates on the next `add`.
   *
   * # Why not a separate "AI-gen products" cart store
   *
   * Forking the cart store would require every consumer to merge
   * two sources at render time, plus a coordinated checkout flow.
   * Embedding the product record per-line keeps the existing
   * Zustand shape intact and makes "which product is this?" a
   * pure-data question on the cart line itself.
   *
   * # sessionStorage cost
   *
   * Each embedded Product is ~3-5 KB serialised (snapshot products
   * carry full CRO content). With the default cart cap of ~6 lines
   * the persisted payload stays well under the 5 MB localStorage
   * budget. The data URL placeholder used by AI-gen products is
   * the same shared reference across lines, so encoding overhead
   * is one-time per cart.
   */
  productSnapshot?: Product;
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
  /**
   * Optional KSA city — captured only on flows that opted into the longer
   * checkout form. The minimum-friction popup leaves this undefined and the
   * Sheets row's "Full Address" cell stays empty (this matches the brief:
   * "If address is missing: send empty string").
   */
  city?: string;
  /** Optional street/district/landmark — same rule as `city`. */
  address?: string;
};

/* ────────────────────────── Collection system ──────────────────────── */

export type CollectionType =
  | "main"       // primary catalog sections (face, hair, routine)
  | "concern"    // problem-solving collections (dark-spots, dryness…)
  | "gender"     // gender-targeted (women, men)
  | "ritual"     // lifestyle / time-based (morning, evening, weekly)
  | "seasonal"   // campaign-based (ramadan, summer…)
  | "ingredient" // ingredient-led (vitamin-c, ceramide…)
  | "promo";     // promotional / bundle (golden-offer…)

/* ─────────────────────────── Filter system ─────────────────────────── */

export type ProductType =
  | "serum" | "cream" | "mask" | "oil"
  | "capsules" | "spray" | "device" | "bundle";

export type ProductTarget = "women" | "men" | "unisex";

export type ProductProblem =
  | "dark-spots" | "dryness" | "uneven-tone" | "barrier-damage"
  | "sensitive-skin" | "oily-skin" | "pores"
  | "hair-damage" | "hair-dryness" | "breakage" | "color-treated" | "hair-loss"
  | "complete-care";

/** A single selectable filter option (value + bilingual label). */
export type FilterOption = {
  value: string;
  label: LocalizedString;
};

/** The three active filter dimensions in the shop. All arrays are multi-select. */
export type FilterState = {
  productTypes: string[];
  targets: string[];
  problems: string[];
};

/** Derived from the visible product set — only options that have matches. */
export type FilterOptions = {
  productTypes: FilterOption[];
  targets: FilterOption[];
  problems: FilterOption[];
};

/**
 * Per-option result counts for the filter panel (full faceted counts).
 *
 * For each dimension, the count of an option reflects how many products
 * would remain if that option were applied *on top of the filters active
 * in the other dimensions* — so toggling within a dimension behaves like
 * an OR and the numbers stay truthful as the customer narrows down.
 */
export type FilterCounts = {
  productTypes: Record<string, number>;
  targets: Record<string, number>;
  problems: Record<string, number>;
};

export const emptyFilterState: FilterState = {
  productTypes: [],
  targets: [],
  problems: [],
};

export type Collection = {
  id: string;
  slug: string;
  type?: CollectionType;
  /** Premium emotional name shown as the primary label. */
  title: LocalizedString;
  /**
   * Functional descriptor shown beneath the title.
   * Bridges luxury branding and clarity.
   */
  tagline?: LocalizedString;
  /** Longer editorial description for collection landing pages. */
  description?: LocalizedString;
  /** Editorial hero image for collection pages and the CollectionRow section. */
  heroImage?: string;
  productIds: string[];
  /** Pre-applied concern filter — used by concern collection pages. */
  presetProblems?: ProductProblem[];
  /** Pre-applied gender filter — used by gender collection pages. */
  presetTarget?: ProductTarget;
  /**
   * When true, the collection aggregates the *entire live catalog* rather
   * than a single `p.collection` bucket — e.g. the "complete ritual" set.
   * Keeps AI-generated products discoverable here without per-product tagging.
   */
  isAggregate?: boolean;
};

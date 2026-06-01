import type { LocalizedString, Money } from "./locales";

/**
 * Universal product primitives — the small structured types that compose a
 * UniversalProduct. Every field that the customer sees is `LocalizedString`
 * (bilingual). Field shapes mirror apps/fanaa/lib/types.ts where they
 * already exist, so the eventual FanaaPublisher mapping is a 1:1 rename
 * rather than a structural transform.
 */

// ── Visual ────────────────────────────────────────────────────────────────

/**
 * One product image. `src` is either:
 *   • an R2 key like "stores/fanaa/products/up_abc/hero.webp"  (post-M5)
 *   • an absolute https URL                                    (test fixtures)
 *
 * `alt` is bilingual because accessibility tools localise alongside the
 * page content (`lang="ar"` body → Arabic alt text, en mirror → English).
 */
export type ProductImage = {
  src: string;
  alt: LocalizedString;
  width?: number;
  height?: number;
  /**
   * Semantic role of a generated scene (Phase 4.6.3), e.g. `mechanism`,
   * `result`, `ingredient`, `proof`, `context`, `trust`, `detail`. Lets the
   * storefront assign the RIGHT scene to the right section instead of a
   * positional guess. A free string (soft contract with the creative-prompts
   * stage); the renderer matches it tolerantly. Absent for curated/gallery
   * images, which fall back to positional distribution.
   */
  intent?: string;
};

// ── Value content ────────────────────────────────────────────────────────

/**
 * A benefit card: 1 emotional sentence (`body`) + 1 feature-name title
 * + a Lucide icon name (matches the Fanaa rendering convention so the
 * FanaaPublisher passes the icon through as-is).
 */
export type ProductBenefit = {
  /** Lucide icon name (e.g. "Sparkles", "Shield"). Falls back to a neutral
   *  icon at the publisher when unknown. */
  icon: string;
  title: LocalizedString;
  body: LocalizedString;
};

/**
 * Generic product feature — niche-agnostic. Beauty/wellness products
 * usually use `benefits + ingredients`; electronics use `features + specs`.
 */
export type ProductFeature = {
  title: LocalizedString;
  body: LocalizedString;
};

/**
 * Active ingredient (beauty/wellness). `role` describes what the
 * ingredient does in the formula ("brightens, evens tone").
 */
export type ProductIngredient = {
  name: LocalizedString;
  role: LocalizedString;
  /** INCI string — single locale ok since INCI is by definition a
   *  language-agnostic identifier. */
  inci?: string;
};

/**
 * Tech specification row (electronics/home). Key/value pair.
 */
export type ProductSpec = {
  key: LocalizedString;
  value: LocalizedString;
};

/**
 * Certification / regulatory mark. `issuer` is e.g. "SFDA", "CE".
 */
export type ProductCert = {
  issuer: string;
  number?: string;
  label: LocalizedString;
};

// ── Social proof ─────────────────────────────────────────────────────────

/**
 * Generated customer review. The Studio's social-proof stage produces 3–6
 * of these per draft, tuned to the niche/brand voice. Realism guardrails
 * (no superlatives, realistic city distribution, varied dates) live in
 * the prompt — not enforced here.
 */
export type ProductReview = {
  name: LocalizedString;
  /** City name — adds geographic credibility for GCC buyers. */
  city: LocalizedString;
  /** 1–5 inclusive; the publisher decides how to render half-stars. */
  rating: number;
  body: LocalizedString;
  /** ISO yyyy-mm-dd. Used as a recency hint by publishers. */
  date: string;
  /** "verified buyer" badge hint — publisher decides whether to surface. */
  verified?: boolean;
};

// ── Conversion ───────────────────────────────────────────────────────────

/**
 * One FAQ pair. The FAQ stage targets the top GCC COD-funnel objections
 * (return policy, payment timing, shipping window, fake-call concerns).
 */
export type ProductFaq = {
  q: LocalizedString;
  a: LocalizedString;
};

// ── Pricing ──────────────────────────────────────────────────────────────

// (Money lives in `./locales` so it's available even when this module
// isn't imported.)
export type { Money };

// ── Ads / paid marketing ─────────────────────────────────────────────────

/**
 * One ad hook for paid social. The hooks stage produces a fixed set
 * (typically 5) so the brand has multiple angles to A/B test in Meta
 * /TikTok Ads Manager without rerunning the pipeline.
 *
 *   • `angle` — emotional / functional / scarcity / authority / story.
 *   • `body`  — 1–3 line ad copy (bilingual). Trimmed to ad-platform
 *               char limits at the publisher level, not here.
 *   • `cta`   — short call-to-action ("Shop now", "اطلبي الآن").
 */
export type AdHook = {
  angle:
    | "emotional"
    | "functional"
    | "scarcity"
    | "authority"
    | "story"
    | (string & {});
  body: LocalizedString;
  cta: LocalizedString;
};

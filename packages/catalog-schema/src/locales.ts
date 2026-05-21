/**
 * Localisation primitives — copied verbatim from apps/fanaa/lib/types.ts
 * so the platform never has two competing definitions of LocalizedString.
 *
 * The duplication is intentional in M3: the storefront does not depend on
 * @platform/catalog-schema yet (PLATFORM.md M3 row: "no runtime usage").
 * The eventual M7 FanaaPublisher will materialise UniversalProduct into the
 * storefront's existing Product shape, at which point the two definitions
 * align by construction.
 */

/**
 * Supported customer-facing locales.
 *
 * Open for extension later (e.g. "fr" for a Francophone GCC market) but
 * intentionally not declared as `string` — every Studio surface that types
 * a LocalizedString gets exhaustive-checking coverage today.
 */
export type Locale = "ar" | "en";

/**
 * Every customer-facing string in the universal schema is bilingual. The
 * Studio generates the Arabic primary copy and an English mirror; some
 * fields (city names, ingredient INCI strings) may legitimately share
 * identical content across locales.
 */
export type LocalizedString = Record<Locale, string>;

/**
 * Money — minor units to dodge floating-point drift. `amount = 12500`
 * means 125.00 of `currency` (e.g. 125.00 SAR). Matches the Fanaa
 * storefront convention so the FanaaPublisher mapping is loss-free.
 */
export type Money = {
  /** Integer minor units. */
  amount: number;
  /** ISO 4217 — "SAR", "AED", "USD". */
  currency: string;
};

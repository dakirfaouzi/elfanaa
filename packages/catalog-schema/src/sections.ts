/**
 * Section taxonomy — the catalogue of PDP sections the pipeline can produce
 * and a publisher may render. Each StoreTemplates entry references this
 * union to declare which sections that template supports.
 *
 * The pipeline's section-structure stage (PLATFORM.md §11 stage 05) picks
 * a subset and an ordering from `StoreTemplates.orderings`. Publishers
 * decide how to render each kind in their native shape (Fanaa renders
 * these as React components in apps/fanaa/components/sections/; Shopify
 * would map to metafields + theme blocks).
 *
 * Initial set (M3) is intentionally broad to avoid premature narrowing.
 * Adding a new SectionKind in a future milestone never requires breaking
 * existing publishers — they ignore kinds they don't render.
 */
export type SectionKind =
  | "hero"
  | "benefits"
  | "lifestyle"
  | "ingredients"
  | "specifications"
  | "social_proof"
  | "results_expectation"
  | "faq"
  | "guarantee"
  | "cross_sell"
  | "creative_strip"
  | "comparison"
  | "founders_note"
  | "press_strip"
  | "sticky_cta"
  | (string & {});

/**
 * Product extension kinds — drives which optional UniversalProduct shape
 * extensions a publisher should look for. Mirrors the niches directory:
 *
 *   "beauty_wellness" → BeautyWellnessExtension (skinTypes, concerns, …)
 *   "fashion"         → FashionExtension        (future · placeholder)
 *   "electronics"     → ElectronicsExtension    (future · placeholder)
 */
export type ProductExtensionKind =
  | "beauty_wellness"
  | "fashion"
  | "electronics"
  | "home"
  | "fitness"
  | (string & {});

import type { LocalizedString } from "../locales";

/**
 * Beauty / wellness niche shape extension (PLATFORM.md §9).
 *
 * Populated by the niche-specific pipeline stages (M5+). Publishers
 * decide which fields to surface — Fanaa's PDP currently uses
 * `ingredients` heavily, `routineSuggestion` lightly, `skinTypes`
 * and `concerns` as filter inputs.
 */

/**
 * Skin-type targets. `"all"` denotes intentionally universal formulas
 * (e.g. ceramide barrier creams) — distinct from omitting the field.
 */
export type SkinType =
  | "oily"
  | "dry"
  | "combination"
  | "sensitive"
  | "normal"
  | "all";

/**
 * Skin concerns this product is positioned to address.
 *
 * Open union (string-extension) so niche-specific copy/strategy stages
 * can introduce concerns ("post-acne marks", "menopausal skin") without
 * a schema change. Known values get IDE autocomplete; unknown values
 * fall through to plain strings.
 */
export type SkinConcern =
  | "aging"
  | "hydration"
  | "pigmentation"
  | "acne"
  | "barrier"
  | "redness"
  | "dullness"
  | "fine-lines"
  | "dark-circles"
  | (string & {});

/**
 * One step in a suggested routine. Steps are ordered (`order` is
 * 1-indexed). `product` references either THIS UniversalProduct
 * (e.g. "apply <self>") or a sibling cross-sell — publishers decide
 * whether to render product references as links.
 */
export type RoutineStep = {
  order: number;
  step: LocalizedString;
  /** Optional name of the product used at this step. */
  product?: LocalizedString;
};

/**
 * Niche extension. Attached to UniversalProduct when `niche === "beauty_wellness"`.
 */
export interface BeautyWellnessExtension {
  skinTypes?: SkinType[];
  concerns?: SkinConcern[];
  routineSuggestion?: RoutineStep[];
}

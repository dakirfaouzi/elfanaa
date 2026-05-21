/**
 * Niche-specific extensions to UniversalProduct.
 *
 * The pipeline's niche-specific stages populate these fields based on
 * `UniversalProduct.niche`. Publishers may consume or ignore them.
 *
 * Future entries (when those niches ship):
 *   • fashion.ts       — sizing chart, materials, fit notes
 *   • electronics.ts   — warranty terms, compatibility, specs override
 *   • home.ts          — dimensions, room placement, install difficulty
 *   • fitness.ts       — target muscle group, frequency, modality
 */
export type {
  BeautyWellnessExtension,
  SkinType,
  SkinConcern,
  RoutineStep,
} from "./beauty-wellness";

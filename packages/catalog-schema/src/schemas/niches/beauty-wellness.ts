import { z } from "zod";
import type {
  BeautyWellnessExtension,
  SkinType,
  SkinConcern,
  RoutineStep,
} from "../../niches/beauty-wellness";
import { LocalizedStringSchema } from "../locales";

/**
 * Runtime validator for BeautyWellnessExtension
 * (../../niches/beauty-wellness.ts).
 *
 * Consumed by niche-specific pipeline stages (M5+) and the FanaaPublisher
 * when surfacing routine-suggestion cards. Dormant in M3.
 */

export const SkinTypeSchema: z.ZodType<SkinType> = z.enum([
  "oily",
  "dry",
  "combination",
  "sensitive",
  "normal",
  "all",
]);

/**
 * Open-union: known concerns get IDE autocomplete via the TS type, but the
 * runtime validator accepts any non-empty string so niche-specific stages
 * can introduce concerns without a schema bump.
 */
export const SkinConcernSchema: z.ZodType<SkinConcern> = z.string().min(1);

export const RoutineStepSchema: z.ZodType<RoutineStep> = z.object({
  order: z.number().int().positive(),
  step: LocalizedStringSchema,
  product: LocalizedStringSchema.optional(),
});

export const BeautyWellnessExtensionSchema: z.ZodType<BeautyWellnessExtension> =
  z.object({
    skinTypes: z.array(SkinTypeSchema).optional(),
    concerns: z.array(SkinConcernSchema).optional(),
    routineSuggestion: z.array(RoutineStepSchema).optional(),
  });

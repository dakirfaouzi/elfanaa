import { z } from "zod";
import {
  ComparisonContentSchema,
  GuaranteeContentSchema,
  HowItWorksContentSchema,
  ProductIngredientSchema,
  ResultsContentSchema,
} from "@platform/catalog-schema/schemas";
import type { SectionContentOutput } from "../pipeline/types-section-content";

/**
 * Zod schema for the section-content stage output (stage 11b).
 *
 * Every block is optional — the generator omits blocks it cannot ground in
 * the product reality. The locale-bleed check lives in the stage code
 * (`pipeline/section-content.ts`), mirroring the copy stage.
 */
export const SectionContentOutputSchema: z.ZodType<SectionContentOutput> =
  z.object({
    howItWorks: HowItWorksContentSchema.optional(),
    ingredients: z.array(ProductIngredientSchema).min(1).max(10).optional(),
    results: ResultsContentSchema.optional(),
    guarantee: GuaranteeContentSchema.optional(),
    comparison: ComparisonContentSchema.optional(),
  });

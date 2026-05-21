import { z } from "zod";
import type { CopyOutput } from "../pipeline/types-copy";
import {
  LocalizedStringSchema,
  ProductBenefitSchema,
} from "@platform/catalog-schema/schemas";

/**
 * Zod schema for the copy stage output (stage 06).
 *
 * Validates the bilingual copy block before downstream stages consume
 * it. The AR-codepoint-coverage check that catches mixed-locale bleeds
 * lives in `pipeline/copy.ts` (stage code, not the schema) because
 * Zod can express it only via a refinement which is harder to read in
 * a shared place.
 */
export const CopyOutputSchema: z.ZodType<CopyOutput> = z.object({
  title: LocalizedStringSchema,
  headline: LocalizedStringSchema,
  subheadline: LocalizedStringSchema.optional(),
  description: LocalizedStringSchema,
  benefits: z.array(ProductBenefitSchema).min(3).max(8),
  foundersNote: LocalizedStringSchema.optional(),
});

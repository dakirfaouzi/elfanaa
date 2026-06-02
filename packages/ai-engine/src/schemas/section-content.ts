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
 * A fault-tolerant optional block. If the model returns `null`, an empty array,
 * or a malformed block for a section, that block is DROPPED (coerced to
 * `undefined`) instead of failing the whole stage — and therefore the whole
 * pipeline.
 *
 * Why: every block here is a "best-effort" conversion section. The model is
 * instructed to OMIT any block it can't ground in the product reality, and it
 * legitimately does that by returning `null` (e.g. `ingredients: null` when the
 * supplier page / operator notes don't expose a concrete ingredient list).
 * `.optional()` alone rejects `null`, which turned a graceful "couldn't ground
 * it" into a fatal `section_content` failure (Step 4 graceful-degradation rule:
 * a missing ingredient list must NEVER fail PDP generation). `.catch(undefined)`
 * makes any unpartseable value for the block a no-op omission. Required nested
 * fields are still enforced WITHIN a block that IS present and well-formed.
 */
const softBlock = <T extends z.ZodTypeAny>(
  schema: T,
): z.ZodCatch<z.ZodOptional<T>> => schema.optional().catch(undefined);

/**
 * Zod schema for the section-content stage output (stage 11b).
 *
 * Every block is optional AND fault-tolerant (see `softBlock`) — the generator
 * omits blocks it cannot ground, and a null/empty/malformed block degrades to
 * "absent" rather than throwing. The locale-bleed check lives in the stage code
 * (`pipeline/section-content.ts`), mirroring the copy stage.
 */
export const SectionContentOutputSchema: z.ZodType<SectionContentOutput> =
  z.object({
    howItWorks: softBlock(HowItWorksContentSchema),
    ingredients: softBlock(z.array(ProductIngredientSchema).min(1).max(10)),
    results: softBlock(ResultsContentSchema),
    guarantee: softBlock(GuaranteeContentSchema),
    comparison: softBlock(ComparisonContentSchema),
  }) as z.ZodType<SectionContentOutput>;

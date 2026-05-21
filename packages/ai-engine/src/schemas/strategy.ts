import { z } from "zod";
import type { StrategyOutput } from "../pipeline/types-strategy";
import { LocalizedStringSchema } from "@platform/catalog-schema/schemas";

/**
 * Zod schema for the strategy stage output (stage 04).
 *
 * The strategy brief is the spine every downstream stage reads — keep
 * its validators strict so a malformed strategy never leaks through to
 * copy/structure/social-proof.
 */
export const StrategyOutputSchema: z.ZodType<StrategyOutput> = z.object({
  heroPromise: LocalizedStringSchema,
  persona: LocalizedStringSchema,
  benefitAngles: z
    .array(
      z.object({
        label: z.string().min(1),
        title: LocalizedStringSchema,
        body: LocalizedStringSchema,
      }),
    )
    .min(3)
    .max(8),
  objections: z
    .array(
      z.object({
        objection: LocalizedStringSchema,
        neutraliser: LocalizedStringSchema,
      }),
    )
    .min(2)
    .max(7),
  adAngles: z.array(z.string().min(1)).min(3).max(8),
});

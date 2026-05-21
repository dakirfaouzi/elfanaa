import { z } from "zod";
import type { SocialProofOutput } from "../pipeline/types-social-proof";
import {
  AdHookSchema,
  ProductFaqSchema,
  ProductReviewSchema,
} from "@platform/catalog-schema/schemas";

/**
 * Zod schema for the social-proof stage output (stage 10).
 *
 * Validates the reviews / FAQ / hooks payload before assemble. The
 * realistic-name + dialect check (PLATFORM.md §11 stage 10 failure mode)
 * lives in `pipeline/social-proof.ts` (stage code, post-Zod) because
 * the rules are heuristic, not purely structural.
 */
export const SocialProofOutputSchema: z.ZodType<SocialProofOutput> = z.object({
  reviews: z.array(ProductReviewSchema).min(3).max(8),
  faq: z.array(ProductFaqSchema).min(4).max(9),
  hooks: z.array(AdHookSchema).min(3).max(8),
});

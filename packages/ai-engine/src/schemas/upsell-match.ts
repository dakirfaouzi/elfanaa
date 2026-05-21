import { z } from "zod";
import type { UpsellMatchOutput } from "../pipeline/types-upsell-match";

/**
 * Zod schema for the upsell-match stage output (stage 11).
 *
 * Returns N candidate UniversalProduct IDs ranked by similarity. The
 * `source` field tags whether the ranking came from a vector embedding
 * search (`"vector"`) or the best-sellers fallback (`"best_sellers"`),
 * so the publisher can decide whether to honour the suggestions.
 */
export const UpsellMatchOutputSchema: z.ZodType<UpsellMatchOutput> = z.object({
  suggestedProductIds: z.array(z.string().min(1)).max(12),
  source: z.enum(["vector", "best_sellers", "empty"]),
  durationMs: z.number().nonnegative(),
});

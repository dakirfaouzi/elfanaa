import type {
  AdHook,
  ProductFaq,
  ProductReview,
} from "@platform/catalog-schema";
import type { StrategyOutput } from "./types-strategy";

/**
 * Stage 10 (Social proof + FAQ + hooks) input + output types.
 *
 * Combines three traditionally-separate outputs into a single stage for
 * latency reasons (PLATFORM.md §11 stage 10). The realistic-name +
 * dialect heuristics run in `pipeline/social-proof.ts` (post-Zod).
 */
export interface SocialProofInput {
  strategy: StrategyOutput;
}

export interface SocialProofOutput {
  reviews: ProductReview[];
  faq: ProductFaq[];
  hooks: AdHook[];
}

import type {
  ComparisonContent,
  GuaranteeContent,
  HowItWorksContent,
  ProductIngredient,
  ResultsContent,
} from "@platform/catalog-schema";
import type { ResearchOutput } from "./types-research";
import type { StrategyOutput } from "./types-strategy";
import type { VisionOutput } from "./types-vision";
import type { AudienceTargeting } from "../prompts/audience-directive";

/**
 * Stage 11b — rich section content (Step 4, PLATFORM.md §26.4).
 *
 * Generates the *additional* conversion sections a premium GCC direct-response
 * page needs beyond hero/benefits/description: mechanism storytelling,
 * ingredients, a results/expectations timeline, a guarantee, and a comparison.
 *
 * Hard grounding rule: every block is OPTIONAL and the model MUST omit any
 * block it cannot ground in the product reality (vision + research). This is
 * the anti-hallucination guard — no invented ingredients/mechanisms.
 *
 * Objections are NOT generated here — they are mapped from `StrategyOutput`
 * during assemble, reclaiming already-generated data (no extra LLM call).
 */
export interface SectionContentInput {
  strategy: StrategyOutput;
  /** Concrete product identity — the anti-drift anchor. */
  vision?: VisionOutput;
  /** Supplier research markdown — the factual grounding for ingredients/specs. */
  research?: ResearchOutput;
  /** Operator-selected structured targeting (awareness/sophistication/tone). */
  targeting?: AudienceTargeting;
}

export interface SectionContentOutput {
  howItWorks?: HowItWorksContent;
  /** Maps onto `UniversalProduct.ingredients`. Omitted when not grounded. */
  ingredients?: ProductIngredient[];
  results?: ResultsContent;
  guarantee?: GuaranteeContent;
  comparison?: ComparisonContent;
}

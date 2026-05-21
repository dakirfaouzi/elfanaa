import type { LocalizedString } from "@platform/catalog-schema";
import type { ResearchOutput } from "./types-research";
import type { VisionOutput } from "./types-vision";

/**
 * Stage 04 (Strategy) input + output types.
 *
 * The strategy stage is the pivot of the pipeline: it consumes the
 * (optional) research + vision outputs and emits the positioning brief
 * every downstream stage reads. PLATFORM.md §11 stage 04 failure mode:
 * "Zod-validated; auto-retry with 'fix JSON' reprompt" — handled by the
 * shared `runTextStage()` helper.
 */
export interface StrategyInput {
  supplierUrl: string;
  research?: ResearchOutput;
  vision?: VisionOutput;
  /** Operator's free-text notes from intake (positioning hints). */
  operatorNotes?: string;
}

export interface StrategyBenefitAngle {
  /** Short slug — referenced downstream by copy and creative prompts. */
  label: string;
  title: LocalizedString;
  body: LocalizedString;
}

export interface StrategyObjection {
  objection: LocalizedString;
  neutraliser: LocalizedString;
}

export interface StrategyOutput {
  heroPromise: LocalizedString;
  persona: LocalizedString;
  benefitAngles: StrategyBenefitAngle[];
  objections: StrategyObjection[];
  /** Free-form angle slugs — seeded from `NicheProfile.defaultAngles`. */
  adAngles: string[];
}

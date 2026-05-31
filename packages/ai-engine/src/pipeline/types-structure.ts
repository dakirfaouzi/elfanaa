import type { SectionKind } from "@platform/catalog-schema";
import type { StrategyOutput } from "./types-strategy";
import type { AudienceTargeting } from "../prompts/audience-directive";

/**
 * Stage 05 (Section structure) input + output types.
 *
 * As of Step 4 §4.3 (ADR-S4-2) this stage is DETERMINISTIC: it computes the
 * section ordering from the operator's awareness/sophistication targeting via
 * `planSectionOrder`, falling back to the store's default ordering when no
 * awareness signal is present. No LLM call is made — ordering is a CRO policy
 * decision, so it is reproducible (and therefore testable) rather than
 * generated.
 */
export interface StructureInput {
  strategy: StrategyOutput;
  /**
   * Operator-selected audience targeting (Step 4 §4.3). `awarenessLevel` +
   * `sophisticationLevel` drive the ordering. Absent ⇒ store default ordering.
   */
  targeting?: AudienceTargeting;
}

export interface StructureOutput {
  /** Template ID — store's named template OR `"<custom>"`. */
  templateId: string;
  /** Final resolved ordering. Downstream consumers read this. */
  sections: SectionKind[];
  /** True when the model proposed a custom ordering rather than picking a template. */
  custom: boolean;
  rationale?: string;
  /** True when the stage hit the PLATFORM.md §11 stage 05 fallback path. */
  usedFallback: boolean;
}

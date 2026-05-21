import type { SectionKind } from "@platform/catalog-schema";
import type { StrategyOutput } from "./types-strategy";

/**
 * Stage 05 (Section structure) input + output types.
 *
 * The stage either selects a known template ID from
 * `StoreConfig.templates.orderings` or proposes a custom ordering
 * drawn from `StoreConfig.templates.sectionLibrary`. PLATFORM.md §11
 * stage 05 failure mode: "Fallback to `StoreConfig.templates.orderings`
 * default" — implemented at the stage level (catches structurally
 * invalid ordering before propagating).
 */
export interface StructureInput {
  strategy: StrategyOutput;
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

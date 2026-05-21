import type {
  LocalizedString,
  ProductBenefit,
} from "@platform/catalog-schema";
import type { StrategyOutput } from "./types-strategy";
import type { StructureOutput } from "./types-structure";
import type { VisionOutput } from "./types-vision";

/**
 * Stage 06 (Arabic copywriting) input + output types.
 *
 * Produces the bilingual customer-facing copy block. PLATFORM.md §11
 * stage 06 failure mode: "Validate AR codepoint coverage; rewrite if
 * mixed-locale bleeds" — implemented as a post-Zod check in
 * `pipeline/copy.ts`.
 */
export interface CopyInput {
  strategy: StrategyOutput;
  structure: StructureOutput;
  /** Optional vision-derived visual hooks the copy can reference. */
  vision?: VisionOutput;
}

export interface CopyOutput {
  title: LocalizedString;
  headline: LocalizedString;
  subheadline?: LocalizedString;
  description: LocalizedString;
  /** 3–8 benefit cards, ordered by importance. */
  benefits: ProductBenefit[];
  /** Optional brand-voice editorial block (used by the `founders_note` section). */
  foundersNote?: LocalizedString;
}

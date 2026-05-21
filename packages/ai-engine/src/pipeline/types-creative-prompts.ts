import type { StrategyOutput } from "./types-strategy";
import type { StructureOutput } from "./types-structure";
import type { CopyOutput } from "./types-copy";
import type { VisionOutput } from "./types-vision";

/**
 * Stage 07 (Creative prompts) input + output types.
 *
 * Produces the image-generation prompts (hero + lifestyle). PLATFORM.md
 * §11 stage 07 failure mode: "Always emits hero prompt; lifestyle
 * prompts optional" — enforced by the `hero` being required in
 * `CreativePromptsOutput`.
 */
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "2:3";

export interface CreativePrompt {
  /** The Flux / Recraft prompt itself (English; 60–120 words ideal). */
  prompt: string;
  /** Optional anti-artefact negative prompt. */
  negative?: string;
  aspectRatio: AspectRatio;
  /** Optional short label ("morning ritual", "gift box"). */
  intent?: string;
}

export interface CreativePromptsInput {
  strategy: StrategyOutput;
  structure: StructureOutput;
  copy: CopyOutput;
  vision?: VisionOutput;
}

export interface CreativePromptsOutput {
  hero: CreativePrompt;
  /** 0–6 lifestyle prompts. Image-gen runs them in parallel. */
  lifestyle: CreativePrompt[];
}

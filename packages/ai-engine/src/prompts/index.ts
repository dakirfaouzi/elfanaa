/**
 * @platform/ai-engine/prompts — barrel.
 *
 * Reusable prompt builders for the M5 pipeline (PLATFORM.md §11). Every
 * builder is a pure function: `(StoreConfig + stage-inputs) → string`.
 * No vendor SDK imports, no I/O, no globals.
 *
 * Builders are split into:
 *
 *   • `buildSystemPrompt`       — the base preamble (brand voice + niche
 *                                  guardrails + locale directive). Used
 *                                  by every text/vision stage.
 *   • `build<Stage>SystemPrompt` — extends the base with stage-specific
 *                                  rules.
 *   • `build<Stage>UserPrompt`   — the stage-specific user message,
 *                                  parameterised by the stage's inputs.
 *
 * Stages that don't call a text/vision provider (research, image-gen
 * post-process, upsell-match, assemble) have NO prompt builder here —
 * they're pure-TS transforms.
 */

export { buildSystemPrompt } from "./system";

export {
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "./vision";

export {
  buildStrategySystemPrompt,
  buildStrategyUserPrompt,
} from "./strategy";

export {
  buildStructureSystemPrompt,
  buildStructureUserPrompt,
} from "./structure";

export { buildCopySystemPrompt, buildCopyUserPrompt } from "./copy";

export {
  buildCreativePromptsSystemPrompt,
  buildCreativePromptsUserPrompt,
} from "./creative-prompts";

export {
  buildSocialProofSystemPrompt,
  buildSocialProofUserPrompt,
} from "./social-proof";

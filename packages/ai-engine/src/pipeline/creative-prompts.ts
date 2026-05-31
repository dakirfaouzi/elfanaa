import type { TextProvider } from "../providers/contracts";
import { CreativePromptsOutputSchema } from "../schemas/creative-prompts";
import {
  buildCreativePromptsSystemPrompt,
  buildCreativePromptsUserPrompt,
  summariseAudience,
} from "../prompts/creative-prompts";
import { runTextStage } from "./_helpers/run-text-stage";
import type { StageContext } from "./types";
import type {
  CreativePromptsInput,
  CreativePromptsOutput,
} from "./types-creative-prompts";

/**
 * Stage 07 — Creative prompts (PLATFORM.md §11).
 *
 * Failure mode: "Always emits hero prompt; lifestyle prompts optional"
 * — the Zod schema enforces the `hero` requirement structurally, and
 * the prompt instructs the model to always include one even when
 * lifestyle prompts are unreliable.
 *
 * # Why no auto-fallback hero?
 *
 * If the model refuses to produce a hero prompt after the retry, we
 * propagate the failure. A "default hero prompt" would be a footgun:
 * downstream image-gen would generate a generic shot inconsistent with
 * the actual product. Better to surface the failure to the worker so
 * the operator can rerun with a different provider.
 */
export async function creativePrompts(
  opts: {
    input: CreativePromptsInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<CreativePromptsOutput> {
  const system = buildCreativePromptsSystemPrompt({
    storeConfig: opts.storeConfig,
    targeting: opts.input.targeting,
  });
  const vision = opts.input.vision;
  const user = buildCreativePromptsUserPrompt({
    productCategory: vision?.productCategory,
    visualHooks: vision?.visualHooks ?? [],
    headlineEn: opts.input.copy.headline.en,
    benefitLabels: opts.input.strategy.benefitAngles.map((a) => a.label),
    identity:
      vision && !vision.skipped
        ? {
            productCategory: vision.productCategory,
            formFactor: vision.formFactor,
            packagingMaterial: vision.packagingMaterial,
            visibleColors: vision.visibleColors,
            visibleText: vision.visibleText,
            approximateSize: vision.approximateSize,
          }
        : undefined,
    audienceSummary: summariseAudience(opts.input.targeting),
  });

  return runTextStage<CreativePromptsOutput>({
    provider: opts.providers.text,
    stage: "creative-prompts",
    system,
    user,
    schema: CreativePromptsOutputSchema,
    storeId: opts.storeConfig.id,
    runId: opts.runId,
    temperature: 0.75,
    maxTokens: 2_500,
  });
}

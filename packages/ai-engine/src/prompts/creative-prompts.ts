import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Creative-prompts stage prompts (stage 07).
 *
 * Produces the actual text prompts that the image-gen stage (08) will
 * feed to fal.ai (Flux Pro 1.1 / Recraft v3). The prompts are crafted
 * for visual coherence with the store palette and the niche aesthetic.
 *
 * PLATFORM.md §11 stage 07 failure mode: "Always emits hero prompt;
 * lifestyle prompts optional" — enforced at the stage level by
 * structurally requiring `hero`.
 */
export function buildCreativePromptsSystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  const { palette } = opts.storeConfig.brand;
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Write the image-generation prompts that will produce the hero shot " +
      "and lifestyle/editorial supporting images for this product. Prompts " +
      "are English (Flux/Recraft don't reliably accept Arabic).",
    outputFormat: "json",
    stageRules: [
      `Embed the brand palette (bg ${palette.bg}, accent ${palette.accent}, ink ${palette.ink}) into every prompt where natural.`,
      "Hero prompt: studio-shot product on a clean backdrop, centred composition, soft directional light, square aspect.",
      "Lifestyle prompts: editorial photography, GCC/Khaleeji setting, soft natural light, props consistent with the niche aesthetic.",
      "Each prompt should be 60–120 words, dense with sensory detail.",
      "Provide a short `negative` prompt per image (anti-artefacts: text, watermark, hands, glare).",
      "Specify aspect ratios as `1:1`, `4:5`, `9:16`, or `16:9` — never raw pixels.",
    ],
  });
}

export function buildCreativePromptsUserPrompt(opts: {
  productCategory?: string;
  visualHooks: string[];
  headlineEn: string;
  benefitLabels: string[];
}): string {
  return [
    "INPUTS",
    "------",
    `Product category: ${opts.productCategory ?? "(not specified)"}`,
    `Headline (en): ${opts.headlineEn}`,
    `Visual hooks: ${opts.visualHooks.join(", ")}`,
    `Benefit angles to dramatise: ${opts.benefitLabels.join(", ")}`,
    "",
    "OUTPUT JSON:",
    "{",
    `  "hero": { "prompt": "...", "negative": "...", "aspectRatio": "1:1" },`,
    `  "lifestyle": [`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "short label, e.g. 'morning ritual'" }`,
    `  ]`,
    "}",
    "",
    "Produce exactly 1 hero and 2–4 lifestyle prompts.",
  ].join("\n");
}

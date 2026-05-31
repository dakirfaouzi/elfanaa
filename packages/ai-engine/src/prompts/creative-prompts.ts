import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";
import {
  buildAudienceDirective,
  summariseAudience,
  type AudienceTargeting,
} from "./audience-directive";

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
  /** Step 3 — operator-selected structured targeting. */
  targeting?: AudienceTargeting;
}): string {
  const { palette } = opts.storeConfig.brand;
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Write the image-generation prompts that will produce the hero shot " +
      "and lifestyle/editorial supporting images for this product. Prompts " +
      "are English (Flux/Recraft don't reliably accept Arabic).",
    outputFormat: "json",
    audienceDirective: buildAudienceDirective(opts.targeting),
    stageRules: [
      // Step 3 — product identity preservation. The hero prompt is also used
      // to condition an image-to-image (Kontext) edit of the operator's real
      // photo, so it must describe the EXACT product, not a generic stand-in.
      "PRODUCT IDENTITY IS PARAMOUNT: describe the EXACT product from the PRODUCT IDENTITY inputs below — same form factor, packaging material, colours, and any visible label text. Never invent a different shape, colour, or label.",
      `Embed the brand palette (bg ${palette.bg}, accent ${palette.accent}, ink ${palette.ink}) into every prompt where natural.`,
      "Hero prompt: studio-shot of the SAME product on a clean backdrop, centred composition, soft directional light, square aspect.",
      "Lifestyle prompts: editorial photography, GCC/Khaleeji setting, soft natural light; the person/scene should match the audience directive (gender, age, market) where one is set.",
      "Each prompt should be 60–120 words, dense with sensory detail.",
      "Provide a short `negative` prompt per image (anti-artefacts: text, watermark, hands, glare).",
      "Specify aspect ratios as `1:1`, `4:5`, `9:16`, or `16:9` — never raw pixels.",
    ],
  });
}

export interface CreativeProductIdentity {
  productCategory?: string;
  formFactor?: string;
  packagingMaterial?: string;
  visibleColors?: string[];
  visibleText?: string;
  approximateSize?: string;
}

export function buildCreativePromptsUserPrompt(opts: {
  productCategory?: string;
  visualHooks: string[];
  headlineEn: string;
  benefitLabels: string[];
  /** Step 3 — concrete product attributes from the vision stage. */
  identity?: CreativeProductIdentity;
  /** Step 3 — compact audience summary for scene casting. */
  audienceSummary?: string;
}): string {
  const id = opts.identity;
  const identityLines: string[] = [];
  if (id) {
    if (id.formFactor) identityLines.push(`Form factor: ${id.formFactor}`);
    if (id.packagingMaterial)
      identityLines.push(`Packaging material: ${id.packagingMaterial}`);
    if (id.visibleColors?.length)
      identityLines.push(`Colours: ${id.visibleColors.join(", ")}`);
    if (id.approximateSize)
      identityLines.push(`Approx. size: ${id.approximateSize}`);
    if (id.visibleText)
      identityLines.push(`Visible label text: "${id.visibleText}"`);
  }

  return [
    "PRODUCT IDENTITY (depict THIS exact product)",
    "-------------------------------------------",
    `Product category: ${opts.productCategory ?? "(not specified)"}`,
    ...(identityLines.length > 0
      ? identityLines
      : ["(no detailed vision attributes — rely on category + visual hooks)"]),
    "",
    "INPUTS",
    "------",
    `Headline (en): ${opts.headlineEn}`,
    `Visual hooks: ${opts.visualHooks.join(", ")}`,
    `Benefit angles to dramatise: ${opts.benefitLabels.join(", ")}`,
    ...(opts.audienceSummary
      ? [`Audience (for lifestyle casting): ${opts.audienceSummary}`]
      : []),
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

export { summariseAudience };

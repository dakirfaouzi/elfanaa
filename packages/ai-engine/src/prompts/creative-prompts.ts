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
      // Step 4 Phase 4.6 — image-led PDP (SugarBear benchmark). Composition,
      // casting, realism, and visual consistency are now first-class rules.
      "DEFAULT COMPOSITION = PRODUCT + HUMAN + CONTEXT. Every lifestyle/section scene must show a real, photorealistic person using, holding, or clearly alongside the EXACT product inside a believable premium environment. Do NOT produce product-only still-lifes or person-only portraits for these scenes unless an `intent` explicitly asks for a pure detail/pack shot.",
      "CAST THE HUMAN FROM THE AUDIENCE DIRECTIVE: match gender, age band, and market to the audience above (beauty→woman, men's grooming→man, family/home→a family or parent, wellness→an appropriate adult). When the market is GCC, people must read as authentically Gulf/Khaleeji — tasteful, modest, premium — never a generic Western stock look. When no audience is set, cast the product's most natural customer.",
      "PHOTOREALISM IS MANDATORY: full-frame editorial camera look, natural skin texture and pores, real catchlights in the eyes, correct anatomy and hands (five fingers). Explicitly avoid the obvious-AI face — no waxy/plastic skin, melted or asymmetric features, extra fingers, or uncanny eyes.",
      "VISUAL CONSISTENCY ACROSS SCENES: hero and every scene must share ONE coherent world — same lighting temperature, colour grade, wardrobe palette, and styling — so the page reads as a single premium campaign, not a collage of unrelated stock shots.",
      `Use the brand palette (bg ${palette.bg}, accent ${palette.accent}, ink ${palette.ink}) as the environment / wardrobe / prop colour story — never as overlaid text or graphics.`,
      "Hero: the EXACT product as the clear focal point, premium and crisp; include a person + context when it strengthens desire, otherwise an elevated clean product shot. 1:1 or 4:5.",
      "Lifestyle/section scenes: premium GCC e-commerce editorial photography (a high-end Gulf DTC brand), product visible and in use, mobile-first VERTICAL framing.",
      "Each prompt 60–120 words, dense with camera + sensory detail (lens, light, mood, environment).",
      "Provide a STRONG per-image `negative`: text, watermark, logo, deformed hands, extra fingers, plastic/waxy skin, uncanny face, lowres, jpeg artefacts, duplicated product.",
      "Aspect ratios: PREFER `4:5` or `9:16` (mobile-first vertical) for scenes; hero may be `1:1`. Never raw pixels.",
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
      ? [`Audience (CAST the human in every scene to match this): ${opts.audienceSummary}`]
      : []),
    "",
    "SCENE PLAN (image-led PDP — most sections carry a visual)",
    "---------------------------------------------------------",
    "Produce 1 hero + 4–5 lifestyle/section scenes. Give each scene an `intent`",
    "from this set so it maps to a page section. Cover as many as the product",
    "naturally allows, product + human + context in each:",
    "  • 'ritual'        — the person using the product in their daily routine",
    "  • 'result'        — the person enjoying the after-state / transformation",
    "  • 'detail'        — close, tactile product-in-hand (texture, application)",
    "  • 'context'       — the product at home in an aspirational GCC setting",
    "  • 'proof'         — a confident, satisfied person (testimonial energy)",
    "",
    "OUTPUT JSON:",
    "{",
    `  "hero": { "prompt": "...", "negative": "...", "aspectRatio": "4:5" },`,
    `  "lifestyle": [`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "ritual" }`,
    `  ]`,
    "}",
    "",
    "Produce exactly 1 hero and 4–5 lifestyle scenes (never fewer than 4).",
  ].join("\n");
}

export { summariseAudience };

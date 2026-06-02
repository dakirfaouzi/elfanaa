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
      "ROLE: You are a world-class GCC e-commerce CREATIVE DIRECTOR, a direct-" +
      "response landing-page designer, and a COMMERCIAL ADVERTISING PHOTOGRAPHER " +
      "— not a generic AI image generator and not a product designer. Your " +
      "objective is NOT to make pretty art; it is to write image-generation " +
      "prompts that produce premium, conversion-focused, mobile-first e-commerce " +
      "ADVERTISING photography that SELLS this exact product. Behave like an ad " +
      "photographer shooting the operator's real product, never like a designer " +
      "who reinvents it. Prompts are English (Flux/Recraft don't reliably accept " +
      "Arabic).",
    outputFormat: "json",
    audienceDirective: buildAudienceDirective(opts.targeting),
    stageRules: [
      // Step 4 Phase 4.6.1 (hardening) — the uploaded product is the SINGLE
      // SOURCE OF TRUTH. These run first so the model treats them as absolute.
      "THE UPLOADED PRODUCT IMAGE IS THE SINGLE SOURCE OF TRUTH. Every prompt MUST instruct: use the EXACT uploaded product; preserve packaging identity, label text, colours, shape, and branding; NO product redesign; NO product substitution; NO simplification or reinterpretation. Never invent a different product, a different container, or a different label.",
      "PRODUCT VISIBILITY IS MANDATORY in EVERY commercial scene — the real product must be clearly visible and recognisable, not implied or off-frame.",
      "HUMAN PRESENCE IS THE DEFAULT for beauty, wellness, fashion, cosmetic, personal-care and lifestyle products: compose PRODUCT + HUMAN + CONTEXT. Product-only frames are reserved ONLY for an explicit pack-shot/detail `intent`.",
      // Step 3 — product identity preservation. The hero prompt is also used
      // to condition an image-to-image (Kontext) edit of the operator's real
      // photo, so it must describe the EXACT product, not a generic stand-in.
      "PRODUCT IDENTITY IS PARAMOUNT: describe the EXACT product from the PRODUCT IDENTITY inputs below — same form factor, packaging material, colours, and any visible label text. Never invent a different shape, colour, or label.",
      // Step 4 Phase 4.6 — image-led PDP (SugarBear benchmark). Composition,
      // casting, realism, and visual consistency are now first-class rules.
      "DEFAULT COMPOSITION = PRODUCT + HUMAN + CONTEXT. Every lifestyle/section scene must show a real, photorealistic person using, holding, or clearly alongside the EXACT product inside a believable premium environment. Do NOT produce product-only still-lifes or person-only portraits for these scenes unless an `intent` explicitly asks for a pure detail/pack shot.",
      "CAST THE HUMAN FROM THE AUDIENCE DIRECTIVE: match gender, age band, and market to the audience above (beauty→woman, men's grooming→man, family/home→a family or parent, wellness→an appropriate adult). When the market is GCC, people must read as authentically Gulf/Khaleeji — tasteful, modest, premium — never a generic Western stock look. When no audience is set, cast the product's most natural customer.",
      // Step 4 Phase 4.6.3/4.6.4 — product-aware casting. The cast must be
      // BELIEVABLE as the real buyer of THIS product, not a fashion-model default.
      "PRODUCT-AWARE CASTING (infer the believable customer from the product's PROMISE, do NOT default to a 20-something model): anti-ageing / firming / wrinkle / eye-cream / menopause / collagen → a real, radiant 35–55 adult with age-appropriate features; acne / first-serum / teen / student → 18–25; hair-loss / beard / prostate → an age-appropriate man; baby / kids / family → a parent or family; joint / mobility / sleep → mature adults. The face, skin, and hands MUST visibly read as that real age — for an ageing/mature-skin product the model MUST look 40+ with authentic mature skin; casting a youthful flawless model is a FAILURE. Visible-but-cared-for maturity converts better. Vary casting across products; never reuse one generic woman.",
      "PHOTOREALISM IS MANDATORY: full-frame editorial commercial-advertising camera look, natural skin texture and pores, real catchlights in the eyes, correct anatomy and hands (five fingers). Explicitly avoid the obvious-AI face — no waxy/plastic skin, melted or asymmetric features, extra fingers, or uncanny eyes.",
      // Step 4 Phase 4.6.3/4.6.4 — natural interaction + low-artefact framing.
      "NATURAL PRODUCT INTERACTION: the person handles the EXACT product the way a real customer would — correct grip, cap/dropper/pump handled plausibly, believable product scale in the hand, a candid in-the-moment pose (applying, dispensing, mid-routine), NOT a stiff product-presentation pose with the label robotically squared to camera. The product stays clearly readable while the interaction looks real.",
      "MINIMISE AI ARTEFACTS BY FRAMING: prefer compositions that reduce hand/finger failure — crop at the wrist, a single simple natural grip, over-the-shoulder, or a tighter macro — instead of forcing both full hands on display. Never render contorted, extra, or fused fingers.",
      "VISUAL CONSISTENCY ACROSS SCENES: hero and every scene must share ONE coherent world — same lighting temperature, colour grade, wardrobe palette, and styling — so the page reads as a single premium campaign, not a collage of unrelated stock shots.",
      `Use the brand palette (bg ${palette.bg}, accent ${palette.accent}, ink ${palette.ink}) as the environment / wardrobe / prop colour story — never as overlaid text or graphics.`,
      "HERO = PRODUCT + HUMAN + CONTEXT by DEFAULT, ART-DIRECTED LIKE A LUXURY AD CAMPAIGN — not a snapshot of a person holding a bottle. Compose intentional NEGATIVE SPACE for an Arabic headline, editorial lighting, a premium aspirational environment, and the EXACT uploaded product as the clear hero held/used by a photorealistic, audience-matched person. Think premium GCC e-commerce commercial photography that creates desire. Only fall back to a clean product-only hero when the category genuinely has no human-use moment (rare). 4:5 or 1:1, the product clearly readable.",
      "Lifestyle/section scenes: premium GCC e-commerce ADVERTISING photography (a high-end Gulf DTC brand), the EXACT product visible and in use by the cast human, mobile-first VERTICAL framing.",
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
    "SHOT LIST (purpose-built section creatives — the asset must DEPICT its job)",
    "--------------------------------------------------------------------------",
    "Produce 1 hero + 6 section scenes. Each scene MUST carry an `intent` from the",
    "EXACT set below (a single word, no other value) so the storefront drops it onto",
    "its matching section. Each is a PURPOSE-BUILT marketing asset, not a generic",
    "lifestyle photo — write the prompt so the IMAGE ITSELF communicates the section:",
    "  • 'mechanism'  — an APPLICATION / USAGE moment: hands applying or dispensing",
    "                   the EXACT product onto the relevant area, the active step",
    "                   clearly visible (educational). → how-it-works",
    "  • 'result'     — the achievable OUTCOME end-state: the person visibly radiant /",
    "                   satisfied (the after the buyer wants), product in frame. → results",
    "  • 'ingredient' — a close tactile MACRO of the EXACT product + its hero",
    "                   ingredient/texture (droplet, swatch, botanical). A hand may",
    "                   hold it; a full person is OPTIONAL. → ingredients",
    "  • 'benefit'    — a PROBLEM→SOLUTION beat: visualise the concern being resolved",
    "                   (the relief / improvement moment), product present. → benefits",
    "  • 'proof'      — a confident real-customer PORTRAIT holding/using the product,",
    "                   direct eye contact (authentic testimonial energy). → social proof",
    "  • 'context'    — the product living in an aspirational GCC home/vanity setting",
    "                   with the person. → lifestyle",
    "Always include 'result', 'proof', and 'ingredient'. Keep ONE coherent world",
    "across hero + all scenes (same person archetype, lighting, grade, wardrobe) so",
    "the page reads as a single premium campaign.",
    "",
    "OUTPUT JSON:",
    "{",
    `  "hero": { "prompt": "...", "negative": "...", "aspectRatio": "4:5" },`,
    `  "lifestyle": [`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "mechanism" },`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "result" },`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "ingredient" },`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "benefit" },`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "proof" },`,
    `    { "prompt": "...", "negative": "...", "aspectRatio": "4:5", "intent": "context" }`,
    `  ]`,
    "}",
    "",
    "Produce exactly 1 hero and 6 section scenes (never fewer than 4). Use a",
    "DISTINCT `intent` per scene — do not repeat an intent.",
  ].join("\n");
}

export { summariseAudience };

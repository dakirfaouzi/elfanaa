import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Vision stage prompts (stage 03).
 *
 * The vision stage examines the supplier-uploaded images and emits a
 * structured "what is this product, what can you see, what does it
 * look like?" JSON object — feeds the strategy stage downstream.
 */
export function buildVisionSystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Analyse the supplied product image(s) and extract a structured visual " +
      "summary the downstream copywriting and strategy stages can rely on.",
    outputFormat: "json",
    stageRules: [
      "Be specific about visible materials, colours, packaging, and form factor.",
      "Identify any visible text on packaging (in any language).",
      "If multiple images are provided, treat them as different angles of ONE product.",
      "Do NOT invent attributes that are not visible. Mark uncertain attributes with a confidence < 0.6.",
    ],
  });
}

export function buildVisionUserPrompt(): string {
  return [
    "Examine the supplied image(s) and return a JSON object with these fields:",
    "",
    "  {",
    `    "productCategory": "broad category, e.g. 'face serum', 'hair oil'",`,
    `    "formFactor": "physical form, e.g. 'glass dropper bottle 30ml'",`,
    `    "visibleColors": ["#hex strings, dominant first"],`,
    `    "packagingMaterial": "e.g. 'amber glass', 'aluminium tube', 'matte paper box'",`,
    `    "visibleText": "any words visible on the packaging, concatenated",`,
    `    "labelLanguages": ["ISO codes for languages detected on the label"],`,
    `    "approximateSize": "rough dimensions or volume if inferable",`,
    `    "visualHooks": ["3–6 short noun phrases the copy stage can use, e.g. 'amber glass dropper', 'minimalist gold lettering'"],`,
    `    "confidence": 0.0 to 1.0,`,
    `    "notes": "any caveats about uncertain inferences"`,
    "  }",
    "",
    "Return ONLY the JSON object. No prose, no markdown fences.",
  ].join("\n");
}

import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Copy stage prompts (stage 06).
 *
 * The longest, most brand-sensitive stage. The system prompt extracts
 * the FULL brand voice + niche guardrails and adds a hard constraint:
 * Arabic output MUST be in the declared dialect and free of forbidden
 * words; English output is a mirror, not a translation, of the Arabic.
 *
 * The stage-level codepoint check (in copy.ts) catches mixed-locale
 * bleeds the prompt fails to prevent (PLATFORM.md §11 stage 06 failure
 * mode).
 */
export function buildCopySystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Write the full bilingual customer-facing copy for this product. " +
      "This stage produces the title, headline, subheadline, description, " +
      "benefit cards, and a short founder/editorial note. Every customer-" +
      "facing field MUST exist in both Arabic AND English with no leakage " +
      "of one language into the other field.",
    outputFormat: "json",
    stageRules: [
      "Arabic fields contain ONLY Arabic letters, Arabic punctuation, numerals (Arabic or Latin), and standard whitespace. No Latin letters.",
      "English fields contain ONLY Latin letters, ASCII punctuation, numerals, and standard whitespace. No Arabic letters.",
      "Arabic copy is in the dialect declared in the brand voice — naturally written, not transliterated.",
      "Mirror the brand voice precisely: register, dialect, forbidden words, house style.",
      "Title MUST be ≤ 60 chars in each locale. Headline MUST be ≤ 80 chars. Subheadline ≤ 120 chars.",
      "Description MUST be 2–4 short paragraphs in each locale (concise, scannable).",
      "Produce 4–6 benefits, each with an icon (Lucide name), a short title, and a 1-sentence body — in both locales.",
      "Reuse the strategy's heroPromise as the spine; do not invent contradictory promises.",
    ],
  });
}

export function buildCopyUserPrompt(opts: {
  heroPromise: string;
  benefitLabels: string[];
  visualHooks?: string[];
  ingredientsHint?: string;
  formFactor?: string;
}): string {
  const lines: string[] = [];
  lines.push("STRATEGY INPUTS");
  lines.push("---------------");
  lines.push(`Hero promise: ${opts.heroPromise}`);
  lines.push(`Benefit angles to expand: ${opts.benefitLabels.join(", ")}`);
  if (opts.visualHooks?.length) {
    lines.push(`Visual hooks (use where natural): ${opts.visualHooks.join(", ")}`);
  }
  if (opts.formFactor) {
    lines.push(`Form factor: ${opts.formFactor}`);
  }
  if (opts.ingredientsHint) {
    lines.push(`Ingredients hint: ${opts.ingredientsHint}`);
  }
  lines.push("");
  lines.push("OUTPUT JSON:");
  lines.push("{");
  lines.push(`  "title": { "ar": "...", "en": "..." },`);
  lines.push(`  "headline": { "ar": "...", "en": "..." },`);
  lines.push(`  "subheadline": { "ar": "...", "en": "..." },`);
  lines.push(`  "description": { "ar": "...", "en": "..." },`);
  lines.push(`  "benefits": [`);
  lines.push(`    { "icon": "LucideIconName", "title": {"ar":"","en":""}, "body": {"ar":"","en":""} }`);
  lines.push(`  ],`);
  lines.push(`  "foundersNote": { "ar": "...", "en": "..." }`);
  lines.push("}");
  return lines.join("\n");
}

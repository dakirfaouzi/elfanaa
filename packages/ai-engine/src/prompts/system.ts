import type { StoreConfig } from "@platform/stores";

/**
 * Base system-prompt builder (PLATFORM.md §11).
 *
 * Every text/vision pipeline stage assembles its system prompt by:
 *
 *   1. Calling `buildSystemPrompt({ storeConfig, task })` to get the
 *      brand-aware preamble.
 *   2. Appending stage-specific instructions on top.
 *
 * # What does the preamble contain?
 *
 *   • Brand identity        — store name, tagline (bilingual).
 *   • Voice                  — register (luxury/playful/…), dialect
 *                              (Saudi/Khaleeji/…), forbidden words, house
 *                              style notes. Sourced from
 *                              `StoreConfig.brand.voice`.
 *   • Niche guardrails       — `NicheProfile.legalGuardrails`
 *                              (claim restrictions, compliance posture).
 *   • Output format hint     — JSON-only directive when `outputFormat ===
 *                              "json"`, suppressing markdown fences.
 *   • Locale directive       — informs the model which locales are
 *                              supported and which is the primary.
 *
 * Everything is appended in this exact order so future audits of prompt
 * leakage have a stable haystack to grep.
 *
 * # Why a builder, not a string literal?
 *
 *   • Stores change. Adding "Trendora" later means a new StoreConfig
 *     instance; the prompts auto-adapt with zero pipeline edits.
 *   • Niche guardrails change. SFDA posture updates propagate platform-
 *     wide on next regeneration without touching prompt files.
 *
 * # Stability promise
 *
 * The string layout produced here IS part of the public contract. M6
 * tests will snapshot it. Changing the ordering or wording counts as a
 * prompt change and SHOULD be reflected in a regenerate-all decision.
 */
export function buildSystemPrompt(opts: {
  storeConfig: StoreConfig;
  task: string;
  outputFormat?: "json" | "text";
  /**
   * Extra "always do / never do" rules from the calling stage. Appended
   * verbatim after the brand/niche/voice block.
   */
  stageRules?: string[];
}): string {
  const { storeConfig, task, outputFormat = "text", stageRules = [] } = opts;
  const { brand, nicheProfile, defaultLocale, supportedLocales, market } =
    storeConfig;

  const lines: string[] = [];

  // Identity
  lines.push(
    `You are an expert AI copywriter and product strategist working inside the ` +
      `"${brand.name.en}" (${brand.name.ar}) ecommerce platform.`,
  );
  lines.push(`Tagline: "${brand.tagline.en}" / "${brand.tagline.ar}".`);
  lines.push(`Market: ${market}. Default locale: ${defaultLocale}. Supported locales: ${supportedLocales.join(", ")}.`);
  lines.push("");

  // Task
  lines.push("TASK");
  lines.push("----");
  lines.push(task);
  lines.push("");

  // Voice
  lines.push("BRAND VOICE");
  lines.push("-----------");
  lines.push(`- Register: ${brand.voice.register}.`);
  lines.push(`- Arabic dialect: ${brand.voice.dialect}.`);
  if (brand.voice.forbidden_words.length > 0) {
    lines.push(
      `- Forbidden words / phrases (NEVER use, in any form): ${brand.voice.forbidden_words.map((w) => `"${w}"`).join(", ")}.`,
    );
  }
  lines.push(`- House style: ${brand.voice.house_style_notes}`);
  lines.push("");

  // Niche guardrails
  lines.push("NICHE GUARDRAILS");
  lines.push("----------------");
  lines.push(nicheProfile.legalGuardrails);
  lines.push("");

  // Stage-specific extra rules
  if (stageRules.length > 0) {
    lines.push("STAGE RULES");
    lines.push("-----------");
    for (const rule of stageRules) {
      lines.push(`- ${rule}`);
    }
    lines.push("");
  }

  // Output format
  if (outputFormat === "json") {
    lines.push("OUTPUT FORMAT");
    lines.push("-------------");
    lines.push(
      "Respond with a SINGLE valid JSON object only. No markdown fences. " +
        "No explanatory prose before or after the object. The object MUST " +
        "satisfy the schema constraints described in the user prompt below.",
    );
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

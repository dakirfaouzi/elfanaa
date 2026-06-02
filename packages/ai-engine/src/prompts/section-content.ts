import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";
import {
  buildAudienceDirective,
  type AudienceTargeting,
} from "./audience-directive";

/**
 * Section-content stage prompts (stage 11b — Step 4).
 *
 * Produces the premium conversion sections (mechanism, ingredients, results,
 * guarantee, comparison). The defining constraint is GROUNDING: the model may
 * only assert what the product reality (vision + research) supports, and MUST
 * omit any block it cannot ground. This prevents the invented-ingredient /
 * generic-mechanism failure mode that Step 3's product-fidelity work guards
 * against in copy.
 */
export function buildSectionContentSystemPrompt(opts: {
  storeConfig: StoreConfig;
  targeting?: AudienceTargeting;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Write the rich conversion sections for this product page: a mechanism " +
      "('how it works') story, an ingredients/components list, a realistic " +
      "results/expectations timeline, a guarantee, and an 'us vs the usual " +
      "way' comparison. Every customer-facing field MUST exist in both Arabic " +
      "AND English with no language leakage between the two.",
    outputFormat: "json",
    audienceDirective: buildAudienceDirective(opts.targeting),
    stageRules: [
      "PRODUCT FIDELITY: every section MUST describe the EXACT product from the vision + research inputs (its real category, form factor, and label). NEVER drift to a generic store-typical product.",
      "GROUNDING (hard): only assert what the inputs support. OMIT any block you cannot ground — do NOT invent ingredients, mechanisms, clinical claims, or timelines. An omitted block is better than a fabricated one. To omit a block, LEAVE ITS KEY OUT of the JSON entirely (do NOT send the key with a null or empty value).",
      "INGREDIENTS: include ONLY ingredients/components actually evidenced by the visible label text or research. If none are evidenced, omit `ingredients` entirely. Never invent INCI names.",
      "HOW IT WORKS: explain the real mechanism in 2–5 plain steps a buyer understands; tie it to the product's actual form factor and use.",
      "RESULTS: give an honest, non-medical expectations timeline (e.g. first use → week 1 → week 4). No guarantees of cure; no fabricated statistics.",
      "GUARANTEE: phrase risk-reversal in line with a COD GCC store (e.g. cash-on-delivery, easy returns). Do not invent specific day-counts unless provided.",
      "COMPARISON: contrast this product's real advantages against the typical alternative — no naming competitors, no false claims.",
      "Open every section at the awareness level and carry the emotional angle + tone from the audience directive above.",
      "Arabic fields: ONLY Arabic letters/punctuation/numerals + whitespace. English fields: ONLY Latin letters/ASCII + whitespace. Arabic is in the brand's declared dialect, naturally written.",
      "Respect the brand voice and forbidden words.",
    ],
  });
}

export function buildSectionContentUserPrompt(opts: {
  heroPromise: string;
  persona?: string;
  benefitLabels: string[];
  objections?: string[];
  productCategory?: string;
  productLabel?: string;
  formFactor?: string;
  visualHooks?: string[];
  /** Trimmed supplier research markdown — factual grounding. */
  researchExcerpt?: string;
}): string {
  const lines: string[] = [];

  if (opts.productCategory || opts.productLabel || opts.formFactor) {
    lines.push("PRODUCT (write about THIS exact product)");
    lines.push("----------------------------------------");
    if (opts.productCategory)
      lines.push(`Product category: ${opts.productCategory}`);
    if (opts.productLabel)
      lines.push(`Visible label / brand text: "${opts.productLabel}"`);
    if (opts.formFactor) lines.push(`Form factor: ${opts.formFactor}`);
    if (opts.visualHooks?.length)
      lines.push(`Visual hooks: ${opts.visualHooks.join(", ")}`);
    lines.push("");
  }

  lines.push("STRATEGY INPUTS");
  lines.push("---------------");
  lines.push(`Hero promise: ${opts.heroPromise}`);
  if (opts.persona) lines.push(`Buyer persona: ${opts.persona}`);
  lines.push(`Benefit angles: ${opts.benefitLabels.join(", ")}`);
  if (opts.objections?.length) {
    lines.push(`Known objections to address: ${opts.objections.join(" | ")}`);
  }
  lines.push("");

  if (opts.researchExcerpt && opts.researchExcerpt.trim().length > 0) {
    lines.push("SUPPLIER RESEARCH (factual grounding — do not contradict)");
    lines.push("---------------------------------------------------------");
    lines.push(opts.researchExcerpt.trim());
    lines.push("");
  }

  lines.push(
    "OUTPUT JSON (omit any key you cannot ground in the inputs above):",
  );
  lines.push("{");
  lines.push(`  "howItWorks": {`);
  lines.push(`    "summary": { "ar": "...", "en": "..." },`);
  lines.push(
    `    "steps": [ { "title": {"ar":"","en":""}, "body": {"ar":"","en":""} } ]`,
  );
  lines.push(`  },`);
  lines.push(
    `  "ingredients": [ { "name": {"ar":"","en":""}, "role": {"ar":"","en":""} } ],`,
  );
  lines.push(`  "results": {`);
  lines.push(
    `    "timeline": [ { "when": {"ar":"","en":""}, "outcome": {"ar":"","en":""} } ]`,
  );
  lines.push(`  },`);
  lines.push(
    `  "guarantee": { "title": {"ar":"","en":""}, "body": {"ar":"","en":""} },`,
  );
  lines.push(`  "comparison": {`);
  lines.push(`    "ours": [ {"ar":"","en":""} ],`);
  lines.push(`    "usual": [ {"ar":"","en":""} ]`);
  lines.push(`  }`);
  lines.push("}");
  return lines.join("\n");
}

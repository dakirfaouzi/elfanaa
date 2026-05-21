import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Strategy stage prompts (stage 04).
 *
 * The strategy stage synthesises the research markdown + vision summary
 * into a positioning brief: who is this for, what is the hero promise,
 * what are the key benefits/angles, what objections must we beat. Every
 * downstream stage (structure, copy, creative-prompts, social-proof,
 * hooks) reads this brief.
 */
export function buildStrategySystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Synthesise a positioning brief for this product, optimised for the " +
      "store's brand voice and the target market. The brief drives every " +
      "downstream stage of the pipeline.",
    outputFormat: "json",
    stageRules: [
      "Pick ONE hero promise — the single sentence the page must convey.",
      "List 4–6 prioritised benefit angles, ordered by likely conversion power.",
      "Name 3–5 customer objections that the FAQ/social-proof stages will need to neutralise.",
      "Identify the primary persona (one short paragraph).",
      "All bilingual fields MUST have both `ar` and `en` keys, never empty.",
    ],
  });
}

export function buildStrategyUserPrompt(opts: {
  supplierUrl: string;
  researchMarkdown?: string;
  visionSummary?: string;
  operatorNotes?: string;
  defaultAngles: string[];
}): string {
  const sections: string[] = [];

  sections.push("INPUTS");
  sections.push("------");
  sections.push(`Supplier URL: ${opts.supplierUrl}`);
  if (opts.operatorNotes) {
    sections.push(`Operator notes: ${opts.operatorNotes}`);
  }
  sections.push(`Niche-default ad angles to consider: ${opts.defaultAngles.join(", ")}`);
  sections.push("");

  if (opts.researchMarkdown) {
    sections.push("RESEARCH MARKDOWN (scraped from supplier page)");
    sections.push("---");
    sections.push(opts.researchMarkdown.slice(0, 8_000));
    sections.push("---");
    sections.push("");
  } else {
    sections.push("(No research markdown — scrape failed or skipped.)");
    sections.push("");
  }

  if (opts.visionSummary) {
    sections.push("VISION SUMMARY (from product images)");
    sections.push("---");
    sections.push(opts.visionSummary);
    sections.push("---");
    sections.push("");
  } else {
    sections.push("(No vision summary — no images were analysed.)");
    sections.push("");
  }

  sections.push("OUTPUT — JSON object with EXACTLY these keys:");
  sections.push("");
  sections.push("{");
  sections.push(`  "heroPromise": { "ar": "...", "en": "..." },`);
  sections.push(`  "persona": { "ar": "...", "en": "..." },`);
  sections.push(`  "benefitAngles": [`);
  sections.push(`    { "label": "short slug", "title": {"ar":"","en":""}, "body": {"ar":"","en":""} }`);
  sections.push(`  ],`);
  sections.push(`  "objections": [`);
  sections.push(`    { "objection": {"ar":"","en":""}, "neutraliser": {"ar":"","en":""} }`);
  sections.push(`  ],`);
  sections.push(`  "adAngles": ["one of ${opts.defaultAngles.join(", ")} or any other"]`);
  sections.push("}");

  return sections.join("\n");
}

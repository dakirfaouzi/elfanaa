import type { StoreConfig } from "@platform/stores";
import { buildSystemPrompt } from "./system";

/**
 * Structure stage prompts (stage 05).
 *
 * The structure stage picks a section ordering for the PDP. Every store
 * declares its template orderings in `StoreConfig.templates.orderings`;
 * this stage either picks a known template ID or proposes a custom
 * ordering drawn from `StoreConfig.templates.sectionLibrary`.
 *
 * Fallback (PLATFORM.md §11 stage 05): if the model produces an invalid
 * structure, the stage falls back to `StoreConfig.templates.orderings`
 * default — implemented at the stage level, not the prompt level.
 */
export function buildStructureSystemPrompt(opts: {
  storeConfig: StoreConfig;
}): string {
  return buildSystemPrompt({
    storeConfig: opts.storeConfig,
    task:
      "Decide the section ordering for this product's landing page. You may " +
      "pick one of the named templates below, or propose a custom ordering " +
      "drawn from the store's section library.",
    outputFormat: "json",
    stageRules: [
      "Every section in the ordering MUST be from `availableSections`.",
      "The ordering MUST start with 'hero'.",
      "If you propose a custom ordering, justify it briefly in `rationale`.",
      "Otherwise set `templateId` to one of the named templates and leave `customOrdering` empty.",
    ],
  });
}

export function buildStructureUserPrompt(opts: {
  storeConfig: StoreConfig;
  heroPromise: string;
  benefitLabels: string[];
}): string {
  const { storeConfig, heroPromise, benefitLabels } = opts;
  const templates = Object.entries(storeConfig.templates.orderings)
    .map(([id, sections]) => `  - ${id}: ${sections.join(" → ")}`)
    .join("\n");

  return [
    "STRATEGY CONTEXT",
    "----------------",
    `Hero promise: ${heroPromise}`,
    `Benefit angles: ${benefitLabels.join(", ")}`,
    "",
    "AVAILABLE TEMPLATES",
    "-------------------",
    templates,
    "",
    `availableSections: ${storeConfig.templates.sectionLibrary.join(", ")}`,
    "",
    "OUTPUT JSON:",
    "{",
    `  "templateId": "one of the templates above OR null when proposing a custom ordering",`,
    `  "customOrdering": ["sections from availableSections, in order"] OR [],`,
    `  "rationale": "short justification"`,
    "}",
  ].join("\n");
}

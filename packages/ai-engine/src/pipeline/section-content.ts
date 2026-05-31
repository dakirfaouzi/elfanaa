import type { TextProvider } from "../providers/contracts";
import { SectionContentOutputSchema } from "../schemas/section-content";
import {
  buildSectionContentSystemPrompt,
  buildSectionContentUserPrompt,
} from "../prompts/section-content";
import { runTextStage } from "./_helpers/run-text-stage";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type {
  SectionContentInput,
  SectionContentOutput,
} from "./types-section-content";

/** Arabic letter range (U+0600 – U+06FF). */
const ARABIC_LETTER_RE = /[\u0600-\u06FF]/;
/** Latin alphabet (ASCII). */
const LATIN_LETTER_RE = /[A-Za-z]/;

/** Cap the research excerpt so the prompt stays inside the cost ceiling (§17). */
const RESEARCH_EXCERPT_MAX = 2_000;

/**
 * Stage 11b — rich section content (Step 4, PLATFORM.md §26.4).
 *
 * Single LLM call producing the premium conversion sections. Mirrors the copy
 * stage's locale-bleed guard, but every block is optional (the generator omits
 * what it can't ground), so the bleed check walks whatever blocks are present.
 */
export async function sectionContent(
  opts: {
    input: SectionContentInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<SectionContentOutput> {
  const baseSystem = buildSectionContentSystemPrompt({
    storeConfig: opts.storeConfig,
    targeting: opts.input.targeting,
  });
  const user = buildSectionContentUserPrompt({
    heroPromise: opts.input.strategy.heroPromise.en,
    persona: opts.input.strategy.persona.en,
    benefitLabels: opts.input.strategy.benefitAngles.map((a) => a.label),
    objections: opts.input.strategy.objections.map((o) => o.objection.en),
    productCategory: opts.input.vision?.productCategory,
    productLabel: opts.input.vision?.visibleText,
    formFactor: opts.input.vision?.formFactor,
    visualHooks: opts.input.vision?.visualHooks,
    researchExcerpt: opts.input.research?.markdown?.slice(
      0,
      RESEARCH_EXCERPT_MAX,
    ),
  });

  let lastBleeds: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? baseSystem
        : `${baseSystem}\n\n` +
          "Your previous output failed the locale guardrail. These fields " +
          `contained the WRONG language for their locale: ${lastBleeds.join(", ")}. ` +
          "Arabic fields contain ONLY Arabic letters; English fields contain " +
          "ONLY Latin letters. Rewrite the entire response now.";

    const parsed = await runTextStage<SectionContentOutput>({
      provider: opts.providers.text,
      stage: "section_content",
      system,
      user,
      schema: SectionContentOutputSchema,
      storeId: opts.storeConfig.id,
      runId: opts.runId,
      temperature: 0.7,
      maxTokens: 3_500,
      maxRetries: 0,
    });

    lastBleeds = findLocaleBleeds(parsed);
    if (lastBleeds.length === 0) return parsed;
  }

  throw new PipelineError({
    kind: "validation_failed",
    stage: "section_content",
    message: `section_content_locale_bleed: ${JSON.stringify(lastBleeds)}`,
  });
}

/**
 * Walk the output and return the dotted-path of every bilingual field whose
 * `ar` value contains Latin letters or whose `en` value contains Arabic
 * letters. Empty array = clean.
 */
function findLocaleBleeds(out: SectionContentOutput): string[] {
  const bleeds: string[] = [];
  const isLocalized = (
    v: unknown,
  ): v is { ar: string; en: string } =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as { ar?: unknown }).ar === "string" &&
    typeof (v as { en?: unknown }).en === "string";

  const walk = (value: unknown, path: string): void => {
    if (isLocalized(value)) {
      if (ARABIC_LETTER_RE.test(value.en)) bleeds.push(`${path}.en`);
      if (LATIN_LETTER_RE.test(value.ar)) bleeds.push(`${path}.ar`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };

  walk(out, "");
  return bleeds;
}

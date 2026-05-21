import type { TextProvider } from "../providers/contracts";
import { CopyOutputSchema } from "../schemas/copy";
import { buildCopySystemPrompt, buildCopyUserPrompt } from "../prompts/copy";
import { runTextStage } from "./_helpers/run-text-stage";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type { CopyInput, CopyOutput } from "./types-copy";

/**
 * Stage 06 — Arabic copywriting (PLATFORM.md §11).
 *
 * Failure mode: "Validate AR codepoint coverage; rewrite if mixed-locale
 * bleeds." Implemented as a post-Zod check via `validateLocaleCleanliness`
 * — when the model leaks Arabic letters into an English field (or vice
 * versa), the helper retries the whole stage once with a "fix locale
 * bleed" reprompt embedded.
 */

/** Arabic letter range (U+0600 – U+06FF) per Unicode block. */
const ARABIC_LETTER_RE = /[\u0600-\u06FF]/;
/** Latin alphabet (ASCII). */
const LATIN_LETTER_RE = /[A-Za-z]/;

export async function copy(
  opts: {
    input: CopyInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<CopyOutput> {
  const baseSystem = buildCopySystemPrompt({ storeConfig: opts.storeConfig });
  const user = buildCopyUserPrompt({
    heroPromise: opts.input.strategy.heroPromise.en,
    benefitLabels: opts.input.strategy.benefitAngles.map((a) => a.label),
    visualHooks: opts.input.vision?.visualHooks,
    formFactor: opts.input.vision?.formFactor,
  });

  const forbidden = opts.storeConfig.brand.voice.forbidden_words;

  // Two attempts: a baseline run, plus one corrective rerun if locale bleeds
  // or forbidden words appear in the first output.
  let lastBleeds: string[] = [];
  let lastForbidden: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? baseSystem
        : `${baseSystem}\n\n` +
          "Your previous output failed a hard guardrail. " +
          (lastBleeds.length > 0
            ? `These fields contained the WRONG language for their locale: ${lastBleeds.join(", ")}. ` +
              "Arabic fields contain ONLY Arabic letters. English fields contain ONLY Latin letters. "
            : "") +
          (lastForbidden.length > 0
            ? `These forbidden words appeared in the copy: ${lastForbidden.join(", ")}. Avoid them entirely. `
            : "") +
          "Rewrite the entire response now.";

    const parsed = await runTextStage<CopyOutput>({
      provider: opts.providers.text,
      stage: "copy",
      system,
      user,
      schema: CopyOutputSchema,
      storeId: opts.storeConfig.id,
      runId: opts.runId,
      temperature: 0.8,
      maxTokens: 3_500,
      maxRetries: 0,
    });

    lastBleeds = findLocaleBleeds(parsed);
    lastForbidden = findForbiddenWords(parsed, forbidden);

    if (lastBleeds.length === 0 && lastForbidden.length === 0) {
      return parsed;
    }
  }

  throw new PipelineError({
    kind: "validation_failed",
    stage: "copy",
    message: `copy_guardrails_violated: bleeds=${JSON.stringify(lastBleeds)} forbidden=${JSON.stringify(lastForbidden)}`,
  });
}

/**
 * Returns the dotted-path of every bilingual field where:
 *   • the `ar` value contains Latin letters, OR
 *   • the `en` value contains Arabic letters.
 *
 * Empty array = clean output.
 */
function findLocaleBleeds(out: CopyOutput): string[] {
  const bleeds: string[] = [];
  const check = (path: string, value: { ar: string; en: string }) => {
    if (ARABIC_LETTER_RE.test(value.en)) bleeds.push(`${path}.en`);
    if (LATIN_LETTER_RE.test(value.ar)) bleeds.push(`${path}.ar`);
  };

  check("title", out.title);
  check("headline", out.headline);
  if (out.subheadline) check("subheadline", out.subheadline);
  check("description", out.description);
  if (out.foundersNote) check("foundersNote", out.foundersNote);

  for (let i = 0; i < out.benefits.length; i++) {
    const b = out.benefits[i];
    check(`benefits[${i}].title`, b.title);
    check(`benefits[${i}].body`, b.body);
  }

  return bleeds;
}

/**
 * Returns the forbidden words that appear (case-insensitive substring
 * match) anywhere in the bilingual copy. Empty array = clean.
 */
function findForbiddenWords(out: CopyOutput, forbidden: string[]): string[] {
  if (forbidden.length === 0) return [];
  const haystack = serialiseCopy(out).toLowerCase();
  const hits = new Set<string>();
  for (const word of forbidden) {
    const needle = word.toLowerCase().trim();
    if (needle.length === 0) continue;
    if (haystack.includes(needle)) hits.add(word);
  }
  return Array.from(hits);
}

function serialiseCopy(out: CopyOutput): string {
  const parts: string[] = [
    out.title.ar,
    out.title.en,
    out.headline.ar,
    out.headline.en,
    out.subheadline?.ar ?? "",
    out.subheadline?.en ?? "",
    out.description.ar,
    out.description.en,
    out.foundersNote?.ar ?? "",
    out.foundersNote?.en ?? "",
  ];
  for (const b of out.benefits) {
    parts.push(b.title.ar, b.title.en, b.body.ar, b.body.en);
  }
  return parts.join("\n");
}

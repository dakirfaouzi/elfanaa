import type { TextProvider } from "../providers/contracts";
import { StrategyOutputSchema } from "../schemas/strategy";
import {
  buildStrategySystemPrompt,
  buildStrategyUserPrompt,
} from "../prompts/strategy";
import type { StageContext } from "./types";
import type { StrategyInput, StrategyOutput } from "./types-strategy";
import { runTextStage } from "./_helpers/run-text-stage";

/**
 * Stage 04 — Strategy synthesis (PLATFORM.md §11).
 *
 * Failure mode: "Zod-validated; auto-retry with 'fix JSON' reprompt" —
 * delegated to `runTextStage()`.
 *
 * # Why we serialise the vision summary for the prompt
 *
 * The model gets a plain text dump (not raw JSON) of the vision output
 * because it routinely produces more grounded strategies when the
 * upstream signal looks like a paragraph rather than structured data.
 */
export async function strategy(
  opts: {
    input: StrategyInput;
    providers: { text: TextProvider };
  } & StageContext,
): Promise<StrategyOutput> {
  const system = buildStrategySystemPrompt({ storeConfig: opts.storeConfig });
  const user = buildStrategyUserPrompt({
    supplierUrl: opts.input.supplierUrl,
    researchMarkdown:
      !opts.input.research?.skipped && opts.input.research?.markdown
        ? opts.input.research.markdown
        : undefined,
    visionSummary: !opts.input.vision?.skipped
      ? formatVisionForPrompt(opts.input.vision)
      : undefined,
    operatorNotes: opts.input.operatorNotes,
    defaultAngles: opts.storeConfig.nicheProfile.defaultAngles,
  });

  return runTextStage<StrategyOutput>({
    provider: opts.providers.text,
    stage: "strategy",
    system,
    user,
    schema: StrategyOutputSchema,
    storeId: opts.storeConfig.id,
    runId: opts.runId,
    temperature: 0.7,
    maxTokens: 2_500,
  });
}

/**
 * Serialises the vision output for inline-in-prompt consumption. Skips
 * empty fields so the prompt isn't padded with "undefined" lines.
 */
function formatVisionForPrompt(
  vision: StrategyInput["vision"],
): string | undefined {
  if (!vision || vision.skipped) return undefined;

  const lines: string[] = [];
  if (vision.productCategory)
    lines.push(`Category: ${vision.productCategory}`);
  if (vision.formFactor) lines.push(`Form factor: ${vision.formFactor}`);
  if (vision.packagingMaterial)
    lines.push(`Packaging: ${vision.packagingMaterial}`);
  if (vision.visibleColors?.length)
    lines.push(`Colours: ${vision.visibleColors.join(", ")}`);
  if (vision.approximateSize) lines.push(`Size: ${vision.approximateSize}`);
  if (vision.visibleText) lines.push(`Label text: "${vision.visibleText}"`);
  if (vision.visualHooks?.length)
    lines.push(`Visual hooks: ${vision.visualHooks.join(", ")}`);
  if (vision.notes) lines.push(`Notes: ${vision.notes}`);
  if (typeof vision.confidence === "number")
    lines.push(`Confidence: ${vision.confidence.toFixed(2)}`);

  return lines.length > 0 ? lines.join("\n") : undefined;
}

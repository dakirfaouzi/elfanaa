import type { ZodType } from "zod";
import type { TextProvider } from "../../providers/contracts";
import type { StoreId } from "@platform/catalog-schema";
import { PipelineError } from "../types";

/**
 * Shared text-stage runner.
 *
 * Centralises the "call provider with system+user prompt → Zod-validate
 * the JSON output → auto-retry once with a 'fix JSON' reprompt" pattern
 * used by every text/vision stage in the pipeline (PLATFORM.md §11
 * failure modes for stages 04, 06, 10).
 *
 * # Why a helper instead of one-off retry logic per stage?
 *
 * Every text stage has the exact same shape:
 *   1. Build a system prompt from StoreConfig.
 *   2. Build a user prompt from stage inputs.
 *   3. Call the text provider with a Zod schema.
 *   4. On schema failure: retry once with an explicit "fix JSON" suffix.
 *   5. After two failures: throw a typed PipelineError.
 *
 * Inlining that into 7 stages = 7× the bugs. One helper = one place to
 * audit retry counts, prompt suffixes, and error wrapping.
 *
 * # Why max ONE retry?
 *
 * Two text calls is the budget compromise (PLATFORM.md §17 cost
 * ceiling). Past two attempts the issue is usually "schema is too
 * strict" or "prompt is too vague" — neither solved by retry #3.
 * The worker is responsible for promoting to the M4 fallback chain
 * when this helper throws `provider_error`.
 */
export async function runTextStage<T>(opts: {
  provider: TextProvider;
  stage: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  storeId: StoreId;
  runId: string;
  temperature?: number;
  maxTokens?: number;
  /** Retries past the first attempt. Default 1 (= 2 calls max). */
  maxRetries?: number;
}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 1;
  let lastError: unknown;
  let lastRawText: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const system =
      attempt === 0
        ? opts.system
        : `${opts.system}\n\n` +
          "Your previous response failed JSON-schema validation. Reread the " +
          "schema constraints below, then respond again with a SINGLE valid " +
          "JSON object that satisfies every requirement. " +
          `Do not include explanatory prose. ` +
          (lastRawText
            ? `\n\nPrevious invalid response was:\n<<<\n${lastRawText}\n>>>`
            : "");

    try {
      const result = await opts.provider.generate<T>({
        system,
        prompt: opts.user,
        schema: opts.schema,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        storeId: opts.storeId,
        runId: opts.runId,
      });

      if (result.parsed !== undefined) {
        return result.parsed;
      }

      lastRawText = result.text;
      lastError = new Error("text_stage_missing_parsed_output");
    } catch (err) {
      lastError = err;
      lastRawText = undefined;
    }
  }

  const isValidationLike =
    lastError instanceof Error &&
    /zod|validation|invalid_json|parse/i.test(lastError.message);

  throw new PipelineError({
    kind: isValidationLike ? "validation_failed" : "provider_error",
    stage: opts.stage,
    message: `${opts.stage}_failed_after_${maxRetries + 1}_attempts`,
    cause: lastError,
  });
}

import { jsonrepair } from "jsonrepair";

/**
 * Two-stage JSON parser for LLM structured outputs.
 *
 * # Why this exists
 *
 * Large, schema-driven Anthropic responses occasionally emit
 * structurally invalid JSON near the tail of the payload — observed
 * failure modes from production:
 *
 *   • `SyntaxError: Unterminated string in JSON at position 8392`
 *     ← max_tokens truncation (now caught earlier via `stop_reason`)
 *   • `SyntaxError: Expected ',' or '}' after property value in JSON
 *     at position 8489`
 *     ← Claude forgot a comma between nested object members on a long
 *       bilingual response
 *   • `SyntaxError: Bad escaped character`
 *     ← Claude emitted an Arabic “smart-quote” inside a JSON string
 *       without escaping it
 *
 * These are well-known LLM-JSON quirks. Rather than re-prompting and
 * burning another full provider round-trip, we run the response
 * through `jsonrepair` — a small (zero-dep, ISC-licensed) library
 * specifically built for repairing LLM-generated JSON.
 *
 * # Two-stage strategy
 *
 * 1. **Fast path**: try `JSON.parse(text)` directly. The vast majority
 *    of responses are well-formed; we don't want to pay any repair
 *    overhead on them.
 * 2. **Repair path**: on parse failure, run the text through
 *    `jsonrepair` and try `JSON.parse` again. Logs a warning to
 *    stderr so we can monitor how often repair fires and tighten
 *    prompts if a particular stage repeatedly malforms.
 * 3. **Both-failed path**: throws an `Error` whose `message` is
 *    `${providerLabel}_json_parse_failed` and whose `cause` carries
 *    BOTH the original parser error AND the repair-attempt error,
 *    so the operator-facing error chain shows the full diagnostic.
 *
 * # Why repair, not just retry
 *
 * - Cheaper (no API call)
 * - Faster (parsing is microseconds vs. seconds)
 * - Idempotent (same bad text → same repair attempt; doesn't waste
 *   non-deterministic Claude attempts on the same underlying bug)
 * - The Zod schema check after parse still rejects semantically
 *   wrong output, so a successful repair → success only if the
 *   shape is also valid. Repair is purely a structural-bug
 *   correction, not a content-correction.
 *
 * `jsonrepair` handles: missing commas, missing quotes, missing
 * escape chars, smart quote → regular quote, trailing commas,
 * Python None/True/False, fenced code blocks, etc. See
 * https://github.com/josdejong/jsonrepair for the full list.
 */
export function parseJsonWithRepair(
  text: string,
  providerLabel: "anthropic" | "openai",
): unknown {
  // Fast path.
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    // Repair path.
    let repaired: string;
    try {
      repaired = jsonrepair(text);
    } catch (repairErr) {
      // jsonrepair itself failed (extremely rare — happens only on
      // input that's so far from JSON that it can't even guess at
      // brackets). Surface BOTH errors so the operator sees both
      // the original parse failure and the repair-attempt failure.
      throw new Error(`${providerLabel}_json_parse_failed`, {
        cause: new Error(
          `original=${errMessage(parseErr)} | repair_attempt=${errMessage(repairErr)}`,
          { cause: parseErr },
        ),
      });
    }
    try {
      const parsed = JSON.parse(repaired);
      // eslint-disable-next-line no-console
      console.warn(
        `[${providerLabel}-adapter] JSON repair fired — original parser error: ${errMessage(parseErr)}. ` +
          "Repair succeeded; the model's structured output had a recoverable defect. " +
          "If this repeats for the same stage, tighten the prompt's JSON instructions.",
      );
      return parsed;
    } catch (postRepairErr) {
      // Repair produced output that still doesn't parse — wrap
      // everything so the operator sees the full failure chain.
      throw new Error(`${providerLabel}_json_parse_failed`, {
        cause: new Error(
          `original=${errMessage(parseErr)} | post_repair=${errMessage(postRepairErr)}`,
          { cause: parseErr },
        ),
      });
    }
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

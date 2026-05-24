// Deep-import the metadata subpath — bundled with `IntakeForm`
// (client). The root barrel drags `node:fs` into the browser
// chunk and breaks `next build`.
import type { Targeting } from "@platform/ingest/metadata";
import {
  AWARENESS_LABELS,
  EMOTIONAL_ANGLE_LABELS,
  GENDER_LABELS,
  MARKET_LABELS,
  PRIMARY_LANGUAGE_LABELS,
  SOPHISTICATION_LABELS,
  TONE_STYLE_LABELS,
} from "./targeting-options";

/**
 * Render the structured Targeting object as a human-readable
 * string suitable for the `operatorNotes` field that the
 * strategy stage already consumes.
 *
 * # Why serialise down to a string
 *
 * The strategy stage's Claude prompt (packages/ai-engine/src/
 * prompts/strategy.ts) currently does:
 *
 *     if (opts.operatorNotes) {
 *       sections.push(`Operator notes: ${opts.operatorNotes}`);
 *     }
 *
 * It interpolates `operatorNotes` verbatim into the prompt. By
 * serialising structured targeting INTO that string at intake
 * time, we get Claude-side benefit immediately without touching
 * the prompt template — strategy-stage changes are explicitly
 * out of scope for the Phase B UX work (per the non-regression
 * constraint).
 *
 * The raw structured object ALSO flows through to the worker via
 * `IngestJob.intakeMetadata.targeting`, so future stages can read
 * it directly (richer prompting, deterministic branching, etc.).
 * That's an opt-in enhancement; until then the serialised string
 * is the load-bearing path.
 *
 * # Output format
 *
 * A compact bullet list followed (optionally) by the operator's
 * freeform text:
 *
 *     Audience targeting:
 *     • Gender: Women
 *     • Age range: 25–40
 *     • Market: Saudi Arabia (SA)
 *     • Primary language: Arabic
 *     • Awareness: Solution-aware (knows solutions exist, not the brand)
 *     • Sophistication: Intermediate (tried a few products)
 *     • Emotional angle: Transformation / change
 *     • Tone style: Luxurious (premium, refined)
 *
 *     Notes: <operator's freeform text>
 *
 * Bullets are emitted ONLY for fields the operator actually picked.
 * An empty targeting object + no freeform notes returns the empty
 * string — the form omits the field, the strategy prompt sees no
 * operator-notes section (same as M9 behaviour).
 *
 * # Why labels not enum values
 *
 * "Solution-aware (knows solutions exist, not the brand)" gives
 * Claude better context than `"solution-aware"`. The label
 * dictionary expands the enum into the same English the operator
 * picked from the dropdown.
 */
export function renderTargetingAsNotes(
  targeting: Targeting | undefined,
  freeformNotes: string | undefined,
): string {
  const bullets: string[] = [];

  if (targeting?.gender) {
    bullets.push(`• Gender: ${GENDER_LABELS[targeting.gender]}`);
  }
  if (
    typeof targeting?.ageMin === "number" ||
    typeof targeting?.ageMax === "number"
  ) {
    const lo = targeting.ageMin;
    const hi = targeting.ageMax;
    const range =
      lo !== undefined && hi !== undefined
        ? `${lo}–${hi}`
        : lo !== undefined
          ? `${lo}+`
          : `≤ ${hi}`;
    bullets.push(`• Age range: ${range}`);
  }
  if (targeting?.market) {
    const friendly = MARKET_LABELS[targeting.market];
    bullets.push(
      friendly
        ? `• Market: ${friendly} (${targeting.market})`
        : `• Market: ${targeting.market}`,
    );
  }
  if (targeting?.primaryLanguage) {
    bullets.push(
      `• Primary language: ${PRIMARY_LANGUAGE_LABELS[targeting.primaryLanguage]}`,
    );
  }
  if (targeting?.awarenessLevel) {
    bullets.push(
      `• Awareness: ${AWARENESS_LABELS[targeting.awarenessLevel]}`,
    );
  }
  if (targeting?.sophisticationLevel) {
    bullets.push(
      `• Sophistication: ${SOPHISTICATION_LABELS[targeting.sophisticationLevel]}`,
    );
  }
  if (targeting?.emotionalAngle) {
    bullets.push(
      `• Emotional angle: ${EMOTIONAL_ANGLE_LABELS[targeting.emotionalAngle]}`,
    );
  }
  if (targeting?.toneStyle) {
    bullets.push(
      `• Tone style: ${TONE_STYLE_LABELS[targeting.toneStyle]}`,
    );
  }

  const trimmedFreeform = (freeformNotes ?? "").trim();

  if (bullets.length === 0 && !trimmedFreeform) {
    return "";
  }

  const parts: string[] = [];
  if (bullets.length > 0) {
    parts.push("Audience targeting:\n" + bullets.join("\n"));
  }
  if (trimmedFreeform) {
    parts.push("Notes: " + trimmedFreeform);
  }
  return parts.join("\n\n");
}

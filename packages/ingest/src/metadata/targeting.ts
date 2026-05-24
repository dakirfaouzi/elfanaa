import { z } from "zod";

/**
 * Structured operator-targeting metadata (Phase B2).
 *
 * # Why structured instead of free-text
 *
 * The M9 intake form has a single `operatorNotes` textarea that
 * operators use to convey audience + positioning hints. The
 * strategy stage stuffs that string verbatim into Claude's prompt
 * (`prompts/strategy.ts`). It works — but the quality of the
 * output is gated by how thoroughly each operator writes their
 * notes, and operators routinely forget to include high-leverage
 * fields (awareness level, sophistication, market, language).
 *
 * Structured controls solve this with hard guardrails:
 *
 *   • Awareness + sophistication are Schwartz-grade ad-strategy
 *     concepts that materially change the copy register. Capturing
 *     them as enums means every prompt now starts with the right
 *     frame.
 *   • Market (ISO country) + primaryLanguage steer the cultural
 *     references the strategy + copy stages emit.
 *   • Emotional angle + tone style give the creative stages a
 *     consistent voice across runs from the same operator.
 *
 * # Backward-compat contract
 *
 * EVERY field is optional. The form may emit `targeting: {}` (no
 * picks made), `targeting: { gender: "female" }` (partial), or
 * the full object. All three are semantically valid; the
 * `renderTargetingAsNotes()` helper in
 * `apps/studio/lib/studio/intake/serialize-targeting.ts`
 * gracefully serialises whatever subset is present.
 *
 * # Why this lives in `@platform/ingest` not `@platform/studio`
 *
 * The targeting shape is part of `IngestJobSchema` (under
 * `intakeMetadata.targeting`) — the cross-process trust boundary.
 * The studio form WRITES it; the worker MAY READ it directly in
 * future enhancements. Keeping the schema in the contract package
 * gives both producers and consumers the same canonical definition.
 *
 * # Why each field is an enum and not a free string
 *
 * Enums let the strategy stage branch deterministically on the
 * value AND give the form an obvious dropdown UX. Free strings
 * would mean Claude has to interpret the operator's wording, which
 * is exactly the M9 problem we're trying to leave behind.
 *
 * # Adding values
 *
 * Each enum is intentionally short — the set was chosen to match
 * the strategy stage's existing `defaultAngles` and the Eugene
 * Schwartz "Breakthrough Advertising" awareness/sophistication
 * model. If a new value lands, also update the displayName
 * mapping in `apps/studio/lib/studio/intake/targeting-options.ts`.
 */

export const GENDER_VALUES = ["female", "male", "any"] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

export const PRIMARY_LANGUAGE_VALUES = ["ar", "en", "mixed"] as const;
export type PrimaryLanguageValue = (typeof PRIMARY_LANGUAGE_VALUES)[number];

/** Eugene Schwartz's 5-level awareness model. The strategy stage's
 *  Claude prompt can use this verbatim. */
export const AWARENESS_VALUES = [
  "unaware",
  "problem-aware",
  "solution-aware",
  "product-aware",
  "most-aware",
] as const;
export type AwarenessValue = (typeof AWARENESS_VALUES)[number];

/** How sophisticated the customer is RE: the category — affects
 *  whether copy needs to "educate" or can lead with the differentiator. */
export const SOPHISTICATION_VALUES = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;
export type SophisticationValue = (typeof SOPHISTICATION_VALUES)[number];

/** Which emotional lever to lead with. Maps loosely to the
 *  pipeline's `nicheProfile.defaultAngles` but operator-overridable. */
export const EMOTIONAL_ANGLE_VALUES = [
  "fear",
  "desire",
  "curiosity",
  "belonging",
  "status",
  "transformation",
] as const;
export type EmotionalAngleValue = (typeof EMOTIONAL_ANGLE_VALUES)[number];

/** Tone register the creative stages should hit. */
export const TONE_STYLE_VALUES = [
  "clinical",
  "luxurious",
  "playful",
  "authoritative",
  "intimate",
  "energetic",
] as const;
export type ToneStyleValue = (typeof TONE_STYLE_VALUES)[number];

/**
 * Targeting object schema. Every field optional — operators may
 * fill in as few or as many as they like. Cross-field constraint:
 * if BOTH ageMin and ageMax are set, ageMin must be ≤ ageMax.
 */
export const TargetingSchema = z
  .object({
    gender: z.enum(GENDER_VALUES).optional(),
    /** ISO 3166-1 alpha-2 country code (uppercase). Loose validation —
     *  the strategy stage tolerates unknown codes by treating them
     *  as a free-text market label. */
    market: z
      .string()
      .regex(/^[A-Z]{2}$/, "market_must_be_iso_alpha2")
      .optional(),
    primaryLanguage: z.enum(PRIMARY_LANGUAGE_VALUES).optional(),
    ageMin: z.number().int().min(13).max(100).optional(),
    ageMax: z.number().int().min(13).max(100).optional(),
    awarenessLevel: z.enum(AWARENESS_VALUES).optional(),
    sophisticationLevel: z.enum(SOPHISTICATION_VALUES).optional(),
    emotionalAngle: z.enum(EMOTIONAL_ANGLE_VALUES).optional(),
    toneStyle: z.enum(TONE_STYLE_VALUES).optional(),
  })
  .refine(
    (v) => v.ageMin === undefined || v.ageMax === undefined || v.ageMin <= v.ageMax,
    { message: "age_min_must_not_exceed_max", path: ["ageMin"] },
  );

export type Targeting = z.infer<typeof TargetingSchema>;

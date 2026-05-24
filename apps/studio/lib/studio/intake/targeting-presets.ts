// Deep-import the metadata subpath — this file is bundled into the
// `TargetingControls` client component. The root `@platform/ingest`
// barrel pulls `FileQueue` (`node:fs`) into the client webpack chunk
// and fails the build. The `/metadata` subpath is the zero-runtime
// schema surface.
import type { Targeting } from "@platform/ingest/metadata";

/**
 * One-click audience-targeting presets (Phase B6 / intake polish).
 *
 * # What this is
 *
 * Curated bundles of `Partial<Targeting>` picks an operator can apply
 * with a single click. They cover the highest-frequency starting
 * points for Fanaa's GCC e-commerce operators — saving 6-8 clicks per
 * intake when the product fits a known archetype.
 *
 * # Behaviour contract
 *
 *   • MERGE semantics — applying a preset COPIES its `picks` over the
 *     current `Targeting` value. Fields the preset does NOT touch are
 *     preserved. This lets multiple presets compose: clicking "GCC
 *     Women" then "Beauty" yields a woman-targeted beauty pitch with
 *     all eight fields filled in.
 *   • TOGGLE semantics — applying the SAME preset again UNDOES exactly
 *     the keys the preset originally set (only when each of those
 *     keys currently equals the preset's value). This lets operators
 *     bail out of a preset without manually clearing 5 dropdowns. If
 *     the operator has since edited one of the preset's keys to a
 *     different value, that key is left untouched (we never clobber
 *     manual edits).
 *   • NEVER mutates the schema — presets are pure `Partial<Targeting>`,
 *     so they parse cleanly under `TargetingSchema` (proven by the
 *     unit test alongside this file).
 *
 * # Why this file is data-only (no React imports)
 *
 * The `applyPreset` / `togglePreset` helpers are pure functions over
 * the public `Targeting` shape. Tests run without a DOM (`vitest`,
 * Node environment) and the schema-guard test re-validates every
 * preset's `picks` object on each run — so if the contracts package
 * ever tightens an enum, this file fails CI loudly rather than
 * shipping silently-invalid presets to operators.
 *
 * # Adding a preset
 *
 * Append to `TARGETING_PRESETS` below. Each entry must:
 *   1. Have a unique stable `id` (used as React key + telemetry).
 *   2. Have a short `label` (≤ 16 chars renders cleanly as a chip).
 *   3. Use ONLY enum values from `packages/ingest/src/metadata/targeting.ts`
 *      — TypeScript enforces this for enum fields, and the
 *      schema-guard test enforces it for `market` (free-form regex).
 *   4. Keep the `picks` object small — every key the preset sets is
 *      a key the operator can no longer fine-tune without clearing
 *      the preset first. Bundles of 3-5 picks read best.
 */

export interface TargetingPreset {
  /** Stable identifier — React key, telemetry tag. snake_case. */
  id: string;
  /** Operator-facing chip label. Keep concise. */
  label: string;
  /** Optional tooltip on hover — explains the audience archetype in
   *  plain English. Surfaced via `title` attribute on the chip. */
  description?: string;
  /** Subset of the `Targeting` shape this preset applies. Every field
   *  optional; only the keys present here are touched on apply. */
  picks: Partial<Targeting>;
}

export const TARGETING_PRESETS: TargetingPreset[] = [
  {
    id: "gcc_women",
    label: "GCC Women",
    description:
      "Arabic-speaking women in Saudi Arabia, 22–45. Default GCC female buyer profile.",
    picks: {
      gender: "female",
      market: "SA",
      primaryLanguage: "ar",
      ageMin: 22,
      ageMax: 45,
    },
  },
  {
    id: "gcc_men",
    label: "GCC Men",
    description:
      "Arabic-speaking men in Saudi Arabia, 22–45. Default GCC male buyer profile.",
    picks: {
      gender: "male",
      market: "SA",
      primaryLanguage: "ar",
      ageMin: 22,
      ageMax: 45,
    },
  },
  {
    id: "beauty",
    label: "Beauty",
    description:
      "Transformation-led, luxurious tone, intermediate sophistication. Composes well with GCC Women.",
    picks: {
      emotionalAngle: "transformation",
      toneStyle: "luxurious",
      sophisticationLevel: "intermediate",
    },
  },
  {
    id: "wellness",
    label: "Wellness",
    description:
      "Transformation-led, intimate tone, problem-aware buyer. Composes with any audience preset.",
    picks: {
      emotionalAngle: "transformation",
      toneStyle: "intimate",
      awarenessLevel: "problem-aware",
    },
  },
  {
    id: "home_gadgets",
    label: "Home Gadgets",
    description:
      "Curiosity-led, playful tone, solution-aware buyer. Great for novelty / convenience SKUs.",
    picks: {
      emotionalAngle: "curiosity",
      toneStyle: "playful",
      awarenessLevel: "solution-aware",
    },
  },
  {
    id: "cod_ecommerce",
    label: "COD Ecommerce",
    description:
      "Saudi market, solution-aware, energetic tone. Default for cash-on-delivery campaigns.",
    picks: {
      market: "SA",
      awarenessLevel: "solution-aware",
      toneStyle: "energetic",
    },
  },
];

/**
 * Merge a preset's `picks` over the current targeting. Pure function:
 * does not mutate the input. Fields the preset doesn't touch are
 * preserved verbatim — this is what enables composition (e.g. GCC
 * Women + Beauty fills in all eight fields without either preset
 * clobbering the other).
 */
export function applyPreset(
  current: Targeting,
  preset: TargetingPreset,
): Targeting {
  return { ...current, ...preset.picks };
}

/**
 * Returns true iff every key the preset sets currently equals the
 * preset's value in `current`. Used to drive the chip's "active" state
 * AND the toggle-off behaviour in `togglePreset` — we only undo a
 * preset that's still fully applied (no operator overrides on any of
 * its keys), so manual edits are never clobbered.
 */
export function isPresetActive(
  current: Targeting,
  preset: TargetingPreset,
): boolean {
  const cur = current as Record<string, unknown>;
  const picks = preset.picks as Record<string, unknown>;
  for (const key of Object.keys(picks)) {
    if (cur[key] !== picks[key]) return false;
  }
  return true;
}

/**
 * One-click toggle. Apply the preset's `picks` if not currently
 * active; otherwise CLEAR exactly the keys the preset originally set
 * (provided each still matches — see `isPresetActive`). Other fields
 * the operator may have set manually are left untouched.
 */
export function togglePreset(
  current: Targeting,
  preset: TargetingPreset,
): Targeting {
  if (!isPresetActive(current, preset)) {
    return applyPreset(current, preset);
  }
  const next: Targeting = { ...current };
  for (const key of Object.keys(preset.picks)) {
    // The schema treats absent keys as "no preference"; deleting is
    // the right semantic (matches what the `__none__` sentinel does
    // in the individual dropdowns).
    delete (next as Record<string, unknown>)[key];
  }
  return next;
}

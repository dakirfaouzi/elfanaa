import { z } from "zod";
import { TargetingSchema } from "./targeting";

/**
 * IntakeMetadata — namespaced container for STRUCTURED intake fields
 * (M14+ universal-supplier intake UX). See `metadata/README` (or the
 * Phase A audit in agent-transcripts) for the broader rationale.
 *
 * # Why a separate namespace
 *
 * `IngestJob` has been the cross-process trust boundary since M6. The
 * `worker`, `studio`, `ai-engine`, and `persistence` packages all
 * deserialize this shape, on-disk run records use it as their schema,
 * and replays validate against it. Every NEW intake field — universal
 * supplier provider, multi-tier offers, structured targeting,
 * structured cost breakdown, generation mode, etc. — could in
 * principle have lived as a top-level optional on `IngestJobSchema`.
 *
 * We deliberately do NOT do that. Instead, ALL new structured intake
 * data lives under ONE optional namespace: `intakeMetadata`. This
 * gives us:
 *
 *   • One blast radius for `IngestJobSchema` growth — we change ONE
 *     optional field on the canonical contract regardless of how many
 *     intake features ship.
 *   • Clean introspection — `if (job.intakeMetadata?.targeting) {…}`
 *     is unambiguous about what came from structured intake vs. what
 *     came from the M9 legacy free-text fields.
 *   • Forward-compat — new nested fields are pure additions inside
 *     this namespace; old payloads that wrote `intakeMetadata: {}`
 *     (or didn't write the field at all) keep validating cleanly.
 *
 * # Backward compatibility contract
 *
 * `intakeMetadata` is OPTIONAL at every level. Every field inside it
 * is OPTIONAL too. The orchestrator MUST treat missing `intakeMetadata`
 * as semantically identical to `intakeMetadata = {}`. Concretely:
 *
 *   • Old serialized runs (pre-A1) → `intakeMetadata = undefined` →
 *     orchestrator falls back to `job.operatorNotes` / `job.marginNotes`
 *     / single `priceHint`. Behavior IDENTICAL to today.
 *   • New intake forms (post-A1) → `intakeMetadata = { targeting: …,
 *     offers: [...], … }` → orchestrator opts INTO structured paths
 *     where present, falls back to flat fields elsewhere.
 *
 * # Phase A1 — empty namespace
 *
 * This file ships the SHAPE only — the schema is intentionally empty
 * (`z.object({})`) so the namespace exists for downstream consumers
 * to read against without breaking on `undefined`. Real fields land
 * in Phase A2+ (provider detection, currencies) and Phase B (offers,
 * targeting, cost breakdown, generation mode). Each addition is a
 * pure additive change to this single schema.
 *
 * # Strip semantics (NOT strict)
 *
 * Default Zod object behavior is `.strip()` — unknown keys are
 * dropped silently. We intentionally do NOT use `.strict()` here
 * because:
 *
 *   1. A future version of the studio MAY emit fields not yet known
 *      to an older worker; we want the worker to accept the payload
 *      and ignore the unknown keys rather than crash on
 *      `unrecognized_keys`.
 *   2. Replay of an old run after a schema shrink (rare but possible)
 *      shouldn't fail because the disk record has an extra field.
 *
 * Trade-off: typos in field names won't be caught at the validation
 * boundary. Mitigation: the typed `IntakeMetadata` interface in
 * TypeScript catches the typo at compile time before it reaches
 * runtime.
 */
export const IntakeMetadataSchema = z.object({
  // ── Phase B2 — structured audience & creative targeting ──
  /** Audience + creative-direction picks the operator made via the
   *  structured controls. All fields optional; the form may emit
   *  an empty `targeting: {}` if no picks were made. The strategy
   *  stage continues to read its inputs primarily from
   *  `job.operatorNotes` — the IntakeForm serialises the
   *  structured picks INTO that string at submit time via
   *  `serialize-targeting.ts`, so this field is opt-in for the
   *  worker (read it for richer routing once we wire that in;
   *  ignore it and rely on the legacy string today). */
  targeting: TargetingSchema.optional(),

  // ── Future phase scaffolding (intentionally absent today) ──
  //    • Phase A2 → sourceProvider (provider detection result)
  //    • Phase A3 → currencyPreset  (market currency hint)
  //    • Phase B3 → costBreakdown   (structured cost decomposition)
  //    • Phase C1 → offers          (multi-tier offer builder)
  //    • Phase D2 → generationMode  ("fast" | "balanced" | "premium")
});

export type IntakeMetadata = z.infer<typeof IntakeMetadataSchema>;

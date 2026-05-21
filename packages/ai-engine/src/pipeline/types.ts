/**
 * Pipeline shared types (PLATFORM.md §11).
 *
 * The 11 stage functions implemented in M5 (research → assemble) share a
 * small surface defined here:
 *
 *   • `StageContext`        — the common envelope every stage receives
 *                              (StoreConfig + injected providers + runId).
 *   • `PipelineProviders`   — the full provider bundle a worker resolves
 *                              from the M4 registry; individual stages
 *                              destructure only what they need via
 *                              `Pick<PipelineProviders, "...">`.
 *   • `StageError`          — typed error surface so the M6 worker can
 *                              decide retry / fallback / abort.
 *
 * Design rules (enforced by review, not by code):
 *
 *   1. Stages are PURE async functions. No global state, no module-level
 *      singletons, no direct provider-registry imports — every dependency
 *      is injected via the parameter object. This is what makes them
 *      unit-testable with mocked providers.
 *
 *   2. Stage outputs are validated by Zod (see `../schemas/<stage>.ts`).
 *      A stage that returns a value that fails its own Zod schema is a
 *      bug — the test suite catches it.
 *
 *   3. Stages declare exactly the providers they need (e.g. research
 *      needs `scraper`, strategy needs `text`). Stages MUST NOT accept
 *      the full `PipelineProviders` bundle — that masks dependency creep
 *      and slows tests.
 */

import type { StoreConfig } from "@platform/stores";
import type {
  EmbeddingProvider,
  ImageProvider,
  ScraperProvider,
  TextProvider,
  VisionProvider,
} from "../providers/contracts";

/**
 * The full provider bundle a worker resolves from the M4 registry before
 * dispatching the pipeline. Individual stages destructure only what they
 * need — never the whole thing.
 *
 * `embedding` is optional because the M5 upsell-match stage falls back to
 * store best-sellers when no embedding provider is configured (per
 * PLATFORM.md §11 stage 11 failure mode).
 */
export interface PipelineProviders {
  text: TextProvider;
  vision: VisionProvider;
  image: ImageProvider;
  scraper: ScraperProvider;
  embedding?: EmbeddingProvider;
}

/**
 * Common envelope every stage receives.
 *
 *   • `storeConfig` carries the brand voice, niche profile, palette,
 *     templates — everything a prompt builder needs to specialise the
 *     output for this exact store/niche.
 *   • `runId` is the Inngest run identifier (when called from M6) or a
 *     synthetic test ID (when called from a unit test). Adapters tag
 *     their cost rows with it.
 *
 * Stages take their own narrow `providers: Pick<...>` instead of pulling
 * the whole bundle. This keeps each stage's surface honest.
 */
export interface StageContext {
  storeConfig: StoreConfig;
  runId: string;
}

/**
 * Typed pipeline error surface.
 *
 * Stages throw `PipelineError` (not bare `Error`) when they fail in a
 * structured way so the M6 worker can branch on `kind`:
 *
 *   • `validation_failed`  — Zod rejected the provider output, retries
 *                             exhausted. Worker SHOULD mark the stage
 *                             skipped if the failure mode permits
 *                             (PLATFORM.md §11), else abort the run.
 *   • `provider_error`     — Provider call itself failed (4xx / 5xx /
 *                             network). Worker SHOULD try the next
 *                             provider in the M4 chain.
 *   • `precondition_failed`— Inputs to the stage were missing or shaped
 *                             wrong. Always a bug — never retryable.
 *
 * Carries `cause` so callers can inspect the underlying error.
 */
export type StageErrorKind =
  | "validation_failed"
  | "provider_error"
  | "precondition_failed";

export class PipelineError extends Error {
  override readonly name = "PipelineError";
  readonly kind: StageErrorKind;
  readonly stage: string;
  override readonly cause?: unknown;

  constructor(opts: {
    kind: StageErrorKind;
    stage: string;
    message: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.kind = opts.kind;
    this.stage = opts.stage;
    this.cause = opts.cause;
  }
}

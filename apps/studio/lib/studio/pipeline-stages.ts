/**
 * Studio-facing labels + descriptions for the 12-stage AI pipeline.
 *
 * # Why this lives in `apps/studio/lib/studio/` and not `@platform/worker`
 *
 * The canonical pipeline stage list (`PIPELINE_STAGES`) is defined in
 * `packages/worker/src/runtime/types.ts` and drives the orchestrator's
 * execution order. That package transitively pulls in Node-runtime
 * deps (filesystem queues, prisma adapters), so importing from its
 * root barrel into a `"use client"` component would re-trip the
 * Phase B `UnhandledSchemeError: node:fs` build failure.
 *
 * Instead, we **mirror** the stage list here as a static const array.
 * The companion unit test (`pipeline-stages.test.ts`) re-imports
 * `PIPELINE_STAGES` from `@platform/worker` (server-side, safe at
 * test time) and asserts:
 *
 *   • `STAGE_ORDER` has exactly the same length.
 *   • The names match in order.
 *   • Every stage in `STAGE_ORDER` has a label in `STAGE_LABELS`
 *     and a description in `STAGE_DESCRIPTIONS`.
 *
 * If a stage is renamed / added / removed in `@platform/worker`,
 * the test fails loudly in CI rather than the UI silently drifting.
 *
 * # Why operator-facing labels and not the raw stage IDs
 *
 * The raw stage IDs (`creative_prompts`, `image_post`, `upsell_match`)
 * are precise but read like CLI artefacts. Operators looking at "Stage
 * 7 of 11" need a human label that conveys what's happening in plain
 * English — "Generating product images", not "image_gen". This is
 * presentation, not contract, so it lives in the Studio app.
 *
 * Descriptions are intentionally short — they appear as `title=`
 * tooltips on the stage pip, not as primary copy.
 */

/**
 * Canonical 12-stage list. Indices line up with the operator-facing
 * "Stage X of 12" count (1-indexed in the UI, 0-indexed here).
 *
 * MUST stay in sync with `PIPELINE_STAGES` from `@platform/worker`.
 * The unit test in `__tests__/pipeline-stages.test.ts` enforces this.
 */
export const STAGE_ORDER = [
  "research",
  "vision",
  "strategy",
  "structure",
  "copy",
  "creative_prompts",
  "image_gen",
  "image_post",
  "social_proof",
  "section_content",
  "upsell_match",
  "assemble",
] as const;

export type PipelineStage = (typeof STAGE_ORDER)[number];

/** Operator-facing label for the pipeline pip + step row header. */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  research: "Research",
  vision: "Vision",
  strategy: "Strategy",
  structure: "Structure",
  copy: "Copy",
  creative_prompts: "Creative prompts",
  image_gen: "Image generation",
  image_post: "Image post-processing",
  social_proof: "Social proof",
  section_content: "Section content",
  upsell_match: "Upsell matching",
  assemble: "Assembly",
};

/** One-line "what this stage does" — surfaced as the pip's `title`. */
export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  research:
    "Scrape the supplier URL and extract product facts (title, price, attributes, raw images).",
  vision:
    "Read the product photos and emit structured visual metadata for downstream copy + creative.",
  strategy:
    "Derive positioning, target audience, awareness stage, and primary buying motive.",
  structure:
    "Plan the section ladder and information architecture of the storefront page.",
  copy:
    "Write the Arabic-first product copy (hero, benefits, ingredients, FAQs, hooks).",
  creative_prompts:
    "Generate the prompts that drive the hero / lifestyle / proof image renders.",
  image_gen:
    "Render the hero + supporting images via Flux Pro and Recraft v3 (Arabic-text-in-image).",
  image_post:
    "Post-process the generated images (crop, upscale, watermark, alt-text).",
  social_proof:
    "Synthesise testimonial / review / star-rating snippets aligned with the positioning.",
  section_content:
    "Generate the rich conversion sections (mechanism, results timeline, guarantee, comparison) grounded in research + vision.",
  upsell_match:
    "Match offer tiers + bundles + cross-sells from the catalog to the new product.",
  assemble:
    "Assemble the final UniversalProduct bundle and write it into the draft.",
};

/**
 * Result of analysing a step list against the canonical pipeline.
 *
 * Pure derivation — no I/O. Pass in the `steps` from a `RunRecord`
 * (or the live in-memory list from `LiveStepTimeline`) and the
 * current `status` and get back everything the UI needs to render
 * the progress bar + pip ladder.
 */
export interface PipelineProgress {
  /** Number of stages with a `success` step record. */
  successCount: number;
  /** Number of stages with a `failed` step record. */
  failureCount: number;
  /** Number of stages with a `skipped` step record. */
  skippedCount: number;
  /** Total stages in the pipeline (always 12). */
  totalCount: number;
  /** 1-indexed "Stage N of 12" — N is the CURRENT stage (next to
   *  start, or the stage that just finished + 1 when running, or
   *  the LAST stage when terminal). Capped at totalCount. */
  currentOrdinal: number;
  /** The name of the active / most-recent stage, or null when
   *  the run has not started any stage yet. */
  currentStage: PipelineStage | null;
  /** Progress as a 0–1 fraction. Equals successCount / totalCount
   *  for running pipelines; 1.0 for completed pipelines; clamped
   *  to whatever steps exist for failed pipelines (so a failure at
   *  stage 5 shows 4 / 12 ≈ 33% if 4 had already succeeded). */
  fraction: number;
  /** Per-stage status, keyed by stage name. Stages with no step
   *  record are reported as `"pending"`. Stages that ran but failed
   *  surface their actual `"failed"` status. */
  perStage: Record<PipelineStage, StagePipStatus>;
}

export type StagePipStatus =
  | "success"
  | "failed"
  | "skipped"
  | "active" // currently running (most-recent stage on a non-terminal run)
  | "pending"; // not yet started

/** Subset of `RunStatus` we care about here (avoids importing the
 *  full type from `@platform/ingest` just for this helper). */
export type RunStatusForProgress =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Subset of `StepRecord` we read — `stage` + `status`. Inlined to
 *  avoid a node-side `@platform/ingest` import from any client
 *  component that uses `computePipelineProgress`. */
interface StepLike {
  stage: string;
  status: "success" | "failed" | "skipped";
}

/**
 * Pure derivation: turn a list of completed/in-flight steps into a
 * single `PipelineProgress` snapshot. Safe to call on every render
 * (no allocation hot paths beyond the small fixed-size record).
 */
export function computePipelineProgress(
  steps: ReadonlyArray<StepLike>,
  runStatus: RunStatusForProgress,
): PipelineProgress {
  // Initialise every stage to pending. We overlay any step records on
  // top, then optionally promote the "next unstarted" stage to active
  // when the run is still running.
  const perStage: Record<PipelineStage, StagePipStatus> = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, "pending" as StagePipStatus]),
  ) as Record<PipelineStage, StagePipStatus>;

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const step of steps) {
    // Only accept stages we know about — defensive: an unknown stage
    // name (drifted from worker) is ignored rather than crashing.
    if (!(step.stage in perStage)) continue;
    const stage = step.stage as PipelineStage;
    perStage[stage] = step.status;
    if (step.status === "success") successCount += 1;
    else if (step.status === "failed") failureCount += 1;
    else if (step.status === "skipped") skippedCount += 1;
  }

  // When the pipeline is still running, mark the next un-finished
  // stage as `"active"` so the pip ladder can pulse it. We pick the
  // FIRST stage in canonical order whose perStage is still "pending"
  // — this matches the orchestrator's actual execution order.
  if (runStatus === "running" || runStatus === "pending") {
    for (const stage of STAGE_ORDER) {
      if (perStage[stage] === "pending") {
        perStage[stage] = "active";
        break;
      }
    }
  }

  // Find the current stage for the ordinal display. Priority order:
  //   1. The active stage (running).
  //   2. The LAST stage with any step record (terminal runs).
  //   3. null (run hasn't dispatched a single stage yet).
  let currentStage: PipelineStage | null = null;
  let currentOrdinal = 0;
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    const stage = STAGE_ORDER[i]!;
    if (perStage[stage] === "active") {
      currentStage = stage;
      currentOrdinal = i + 1;
      break;
    }
  }
  if (currentStage === null) {
    for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
      const stage = STAGE_ORDER[i]!;
      if (perStage[stage] !== "pending") {
        currentStage = stage;
        currentOrdinal = i + 1;
        break;
      }
    }
  }

  // Progress fraction: success-only for running pipelines (no false
  // confidence from skips); full 1.0 only for completed runs.
  let fraction: number;
  if (runStatus === "completed") {
    fraction = 1;
  } else {
    fraction = successCount / STAGE_ORDER.length;
  }

  return {
    successCount,
    failureCount,
    skippedCount,
    totalCount: STAGE_ORDER.length,
    currentOrdinal,
    currentStage,
    fraction,
    perStage,
  };
}

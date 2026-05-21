import {
  assemble,
  copy as copyStage,
  creativePrompts,
  imageGen,
  imagePost,
  PipelineError,
  research,
  socialProof,
  strategy,
  structure,
  upsellMatch,
  vision,
} from "@platform/ai-engine/pipeline";
import type { UpsellMatchCatalogPort } from "@platform/ai-engine";
import type {
  CostRow,
  RunRecord,
  StepRecord,
  RetryPolicyTable,
} from "@platform/ingest";
import {
  backoffForAttempt,
  defaultRetryPolicy,
  resolvePolicy,
} from "@platform/ingest";
import { createLogger, type Logger } from "./logger";
import { emptyCatalog } from "./catalog-stub";
import type {
  OrchestratorOptions,
  OrchestratorResult,
  PipelineStageName,
  StageOutputs,
} from "./types";
import { PIPELINE_STAGES } from "./types";
import {
  wrapEmbeddingWithCost,
  wrapImageWithCost,
  wrapScraperWithCost,
  wrapTextWithCost,
  wrapVisionWithCost,
} from "../provider-wiring/cost-recorder";
import type { ResolvedProviders } from "../provider-wiring";

/**
 * Worker pipeline executor (PLATFORM.md §14 + §15).
 *
 * Drives the 11 M5 stages in fixed order against an `IngestJob`,
 * persisting step records + costs + final product to a `RunStore`.
 *
 * Contract:
 *
 *   1. Always calls `store.createRun()` if no prior record exists.
 *   2. Sets the run to `running`, then dispatches each stage in
 *      PIPELINE_STAGES order. Honours `resume.fromStage` when set.
 *   3. Per stage:
 *        a. Resolve effective retry policy from the table (kind
 *           `provider_call` for AI stages, `assemble` for assemble).
 *        b. Reset the stage's cost buffer.
 *        c. Run the stage; on PipelineError({kind:'provider_error'}),
 *           respect the policy and retry after backoff.
 *        d. Persist a StepRecord (status, attempts, costs, output) to
 *           the store.
 *        e. Append the per-stage cost buffer to the store.
 *   4. If every stage succeeded, persist the final UniversalProduct
 *      and mark the run `completed`. Otherwise mark `failed`.
 *
 * # Internal cost recording
 *
 * The orchestrator wraps the supplied providers ONCE with a closure
 * that pushes to a `stageCosts` array and reads the `currentStage`
 * mutable ref. Between stages it swaps the buffer and resets the
 * stage tag. Callers pass RAW providers — wrapping is the
 * orchestrator's responsibility because only it knows which stage is
 * active at any moment.
 *
 * # What this function does NOT do
 *
 *   • No queue I/O. Callers dequeue the job first and pass it in.
 *   • No cost-ceiling enforcement (M6.5 / M10 middleware).
 *   • No Sharp / R2 work — image_post stays a pure transform in M6.
 */
export async function runPipeline(
  opts: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const baseLogger = (opts.logger ?? createLogger()).withContext({
    runId: opts.job.runId,
    storeId: opts.job.storeId,
  });
  const retryPolicy = opts.retryPolicy ?? defaultRetryPolicy;
  const catalog = opts.catalog ?? emptyCatalog;

  // Mutable refs for cost recording. The wrapped providers read both
  // refs at call time (via getStage closure + push closure).
  let stageCosts: CostRow[] = [];
  const stageRef = { current: "init" as PipelineStageName };
  const wrappedProviders = wrapProviders(opts.providers, {
    runId: opts.job.runId,
    getStage: () => stageRef.current,
    push: (row) => stageCosts.push(row),
  });

  // Step 1: ensure a run record exists.
  let run = await ensureRunRecord(opts, baseLogger);

  // Step 2: hydrate prior outputs when resuming.
  const outputs: StageOutputs = opts.resume
    ? hydrateOutputs(opts.resume.prior)
    : {};

  await opts.store.markRunStarted(opts.job.runId);
  baseLogger.info("run_started", { stages: PIPELINE_STAGES.length });

  let skipping = Boolean(opts.resume?.fromStage);

  for (const stageName of PIPELINE_STAGES) {
    if (skipping) {
      if (stageName === opts.resume?.fromStage) {
        skipping = false;
      } else if (outputs[stageName] !== undefined) {
        baseLogger.info("stage_skipped_resumed", { stage: stageName });
        continue;
      } else {
        // No persisted output AND we haven't hit the resume target yet —
        // resume target is invalid because earlier dependency stages
        // weren't persisted. Bail out with a precondition failure.
        baseLogger.error("stage_skip_failed_missing_dependency", {
          stage: stageName,
          resumeTarget: opts.resume?.fromStage,
        });
        await opts.store.markRunFailed(
          opts.job.runId,
          `resume_invalid:${stageName}_output_missing`,
        );
        const failed = await opts.store.getRun(opts.job.runId);
        return { run: failed ?? run, product: undefined };
      }
    }

    const stageLogger = baseLogger.withContext({ stage: stageName });
    stageRef.current = stageName;
    stageCosts = [];

    const result = await runOneStage({
      stageName,
      outputs,
      providers: wrappedProviders,
      storeConfig: opts.storeConfig,
      runId: opts.job.runId,
      job: opts.job,
      catalog,
      retryPolicy,
      logger: stageLogger,
    });

    // Tag the step with the sum of provider calls observed during it.
    const stageCostUsd = stageCosts.reduce((sum, row) => sum + row.costUsd, 0);
    const stepWithCost: StepRecord = { ...result.step, costUsd: stageCostUsd };

    await opts.store.appendStep(opts.job.runId, stepWithCost);
    await opts.store.appendCosts(opts.job.runId, stageCosts);

    if (stepWithCost.status === "failed") {
      await opts.store.markRunFailed(
        opts.job.runId,
        `${stageName}: ${stepWithCost.errorMessage ?? "unknown"}`,
      );
      const finalRun = await opts.store.getRun(opts.job.runId);
      stageLogger.error("run_failed", {
        stage: stageName,
        attempts: stepWithCost.attempts,
      });
      return { run: finalRun ?? run, product: undefined };
    }

    if (result.output !== undefined) {
      (outputs as Record<string, unknown>)[stageName] = result.output;
    }
  }

  const finalProduct = outputs.assemble;
  if (!finalProduct) {
    // Should be unreachable — assemble is the last stage and either
    // throws (caught above as failed) or produces a UniversalProduct.
    await opts.store.markRunFailed(opts.job.runId, "assemble_returned_no_product");
    const finalRun = await opts.store.getRun(opts.job.runId);
    return { run: finalRun ?? run, product: undefined };
  }

  await opts.store.markRunComplete(opts.job.runId, finalProduct);
  const completed = await opts.store.getRun(opts.job.runId);
  baseLogger.info("run_completed", {
    totalCostUsd: completed?.totalCostUsd ?? 0,
  });
  return { run: completed ?? run, product: finalProduct };
}

async function ensureRunRecord(
  opts: OrchestratorOptions,
  logger: Logger,
): Promise<RunRecord> {
  if (opts.resume) {
    logger.info("run_resumed", { fromStage: opts.resume.fromStage });
    return opts.resume.prior;
  }
  const existing = await opts.store.getRun(opts.job.runId);
  if (existing) {
    logger.info("run_existing_record_reused", { status: existing.status });
    return existing;
  }
  return opts.store.createRun({
    runId: opts.job.runId,
    job: opts.job,
    createdAt: opts.job.createdAt,
  });
}

/**
 * Reconstruct the in-memory StageOutputs from a persisted RunRecord.
 * Used by the replay path. Only successful steps contribute outputs.
 */
function hydrateOutputs(prior: RunRecord): StageOutputs {
  const outputs: StageOutputs = {};
  for (const step of prior.steps) {
    if (step.status !== "success") continue;
    if (step.output === undefined) continue;
    (outputs as Record<string, unknown>)[step.stage] = step.output;
  }
  if (prior.finalProduct) outputs.assemble = prior.finalProduct;
  return outputs;
}

function wrapProviders(
  raw: ResolvedProviders,
  opts: {
    runId: string;
    getStage: () => string;
    push: (row: CostRow) => void;
  },
): ResolvedProviders {
  return {
    text: wrapTextWithCost(raw.text, opts),
    vision: wrapVisionWithCost(raw.vision, opts),
    image: wrapImageWithCost(raw.image, opts),
    scraper: wrapScraperWithCost(raw.scraper, opts),
    embedding: raw.embedding
      ? wrapEmbeddingWithCost(raw.embedding, opts)
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Per-stage executor (with retry)
// ─────────────────────────────────────────────────────────────────────────

interface RunOneStageOptions {
  stageName: PipelineStageName;
  outputs: StageOutputs;
  providers: ResolvedProviders;
  storeConfig: OrchestratorOptions["storeConfig"];
  runId: string;
  job: OrchestratorOptions["job"];
  catalog: UpsellMatchCatalogPort;
  retryPolicy: RetryPolicyTable;
  logger: Logger;
}

interface RunOneStageResult {
  step: StepRecord;
  output?: unknown;
}

async function runOneStage(
  opts: RunOneStageOptions,
): Promise<RunOneStageResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const kind = opts.stageName === "assemble" ? "assemble" : "provider_call";
  const policy = resolvePolicy(opts.retryPolicy, kind, opts.stageName);

  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    opts.logger.info("stage_attempt", {
      attempt,
      maxAttempts: policy.maxAttempts,
    });
    try {
      const output = await dispatchStage(opts);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;
      opts.logger.info("stage_complete", { attempts: attempt, durationMs });
      return {
        step: {
          stage: opts.stageName,
          status: "success",
          startedAt,
          finishedAt,
          durationMs,
          attempts: attempt,
          costUsd: 0, // populated by orchestrator from accumulated CostRows
          output,
        },
        output,
      };
    } catch (err) {
      lastError = err;
      const shouldRetry = attempt < policy.maxAttempts && isRetryable(err);
      if (!shouldRetry) break;
      const delay = backoffForAttempt(policy, attempt);
      opts.logger.warn("stage_retry_scheduled", {
        attempt,
        nextDelayMs: delay,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      if (delay > 0) await sleep(delay);
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedMs;
  const message = lastError instanceof Error ? lastError.message : "unknown_error";
  const errorKind =
    lastError instanceof PipelineError ? lastError.kind : undefined;
  opts.logger.error("stage_failed", {
    durationMs,
    errorKind,
    errorMessage: message,
  });
  return {
    step: {
      stage: opts.stageName,
      status: "failed",
      startedAt,
      finishedAt,
      durationMs,
      attempts: policy.maxAttempts,
      costUsd: 0,
      errorMessage: message,
      errorKind,
    },
  };
}

/**
 * Errors with `kind: "precondition_failed"` are NEVER retryable — they
 * indicate the orchestrator dispatched the stage with bad inputs.
 * Provider errors and validation failures are retryable.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof PipelineError) {
    return err.kind !== "precondition_failed";
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────
// Stage dispatch — pure function of inputs + outputs bag
// ─────────────────────────────────────────────────────────────────────────

async function dispatchStage(opts: RunOneStageOptions): Promise<unknown> {
  const { stageName, outputs, providers, storeConfig, runId, job, catalog } =
    opts;
  const stageContext = { storeConfig, runId };

  switch (stageName) {
    case "research":
      return research({
        ...stageContext,
        input: {
          supplierUrl: job.supplierUrl,
          skip: job.skipResearch,
        },
        providers: { scraper: providers.scraper },
      });

    case "vision":
      return vision({
        ...stageContext,
        input: {
          images: job.uploadedImages.map((i) => ({ src: i.src, alt: i.alt })),
        },
        providers: { vision: providers.vision },
      });

    case "strategy":
      return strategy({
        ...stageContext,
        input: {
          supplierUrl: job.supplierUrl,
          research: outputs.research,
          vision: outputs.vision,
          operatorNotes: job.operatorNotes,
        },
        providers: { text: providers.text },
      });

    case "structure":
      requirePresent(outputs.strategy, "structure", "strategy");
      return structure({
        ...stageContext,
        input: { strategy: outputs.strategy! },
        providers: { text: providers.text },
      });

    case "copy":
      requirePresent(outputs.strategy, "copy", "strategy");
      requirePresent(outputs.structure, "copy", "structure");
      return copyStage({
        ...stageContext,
        input: {
          strategy: outputs.strategy!,
          structure: outputs.structure!,
          vision: outputs.vision,
        },
        providers: { text: providers.text },
      });

    case "creative_prompts":
      requirePresent(outputs.strategy, "creative_prompts", "strategy");
      requirePresent(outputs.structure, "creative_prompts", "structure");
      requirePresent(outputs.copy, "creative_prompts", "copy");
      return creativePrompts({
        ...stageContext,
        input: {
          strategy: outputs.strategy!,
          structure: outputs.structure!,
          copy: outputs.copy!,
          vision: outputs.vision,
        },
        providers: { text: providers.text },
      });

    case "image_gen":
      requirePresent(outputs.creative_prompts, "image_gen", "creative_prompts");
      return imageGen({
        ...stageContext,
        input: { prompts: outputs.creative_prompts! },
        providers: { image: providers.image },
      });

    case "image_post":
      requirePresent(outputs.image_gen, "image_post", "image_gen");
      requirePresent(outputs.copy, "image_post", "copy");
      return imagePost({
        ...stageContext,
        input: {
          imageGen: outputs.image_gen!,
          copy: outputs.copy!,
        },
      });

    case "social_proof":
      requirePresent(outputs.strategy, "social_proof", "strategy");
      return socialProof({
        ...stageContext,
        input: { strategy: outputs.strategy! },
        providers: { text: providers.text },
      });

    case "upsell_match":
      requirePresent(outputs.strategy, "upsell_match", "strategy");
      requirePresent(outputs.copy, "upsell_match", "copy");
      return upsellMatch({
        ...stageContext,
        input: {
          strategy: outputs.strategy!,
          copy: outputs.copy!,
          catalog,
        },
        providers: { embedding: providers.embedding },
      });

    case "assemble":
      requirePresent(outputs.research, "assemble", "research");
      requirePresent(outputs.vision, "assemble", "vision");
      requirePresent(outputs.strategy, "assemble", "strategy");
      requirePresent(outputs.structure, "assemble", "structure");
      requirePresent(outputs.copy, "assemble", "copy");
      requirePresent(outputs.creative_prompts, "assemble", "creative_prompts");
      requirePresent(outputs.image_gen, "assemble", "image_gen");
      requirePresent(outputs.image_post, "assemble", "image_post");
      requirePresent(outputs.social_proof, "assemble", "social_proof");
      requirePresent(outputs.upsell_match, "assemble", "upsell_match");
      return assemble({
        ...stageContext,
        input: {
          research: outputs.research!,
          vision: outputs.vision!,
          strategy: outputs.strategy!,
          structure: outputs.structure!,
          copy: outputs.copy!,
          prompts: outputs.creative_prompts!,
          imageGen: outputs.image_gen!,
          imagePost: outputs.image_post!,
          socialProof: outputs.social_proof!,
          upsells: outputs.upsell_match!,
          priceHint: job.priceHint,
          uploadedImageKeys: job.uploadedImages.map((i) => i.src),
          marginNotes: job.marginNotes,
        },
      });
  }
}

function requirePresent<T>(
  value: T | undefined,
  stage: string,
  dependency: string,
): asserts value is T {
  if (value === undefined) {
    throw new PipelineError({
      kind: "precondition_failed",
      stage,
      message: `${stage}_missing_dependency:${dependency}`,
    });
  }
}

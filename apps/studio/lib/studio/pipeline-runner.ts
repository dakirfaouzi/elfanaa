import { FileStore } from "@platform/ingest";
import { fanaaStore, getStore } from "@platform/stores";
import type { StoreConfig } from "@platform/stores";
import type { IngestJob } from "@platform/ingest";
import {
  createLogger,
  emptyCatalog,
  noopSink,
  resolveProvidersForStore,
  runPipeline,
  withCostCeiling,
  type OrchestratorResult,
  type ResolvedProviders,
} from "@platform/worker";
import {
  FanaaPublisher,
  type PublishResult,
} from "@platform/publishers";
import {
  FilePublishStore,
} from "@platform/publishers/persistence";
import path from "node:path";
import { platformDataRoot, runsRoot } from "./paths";

/**
 * Studio-local pipeline runner — the e2e glue that turns an
 * `IngestJob` into a published bundle.
 *
 * # Why in-process and not Inngest?
 *
 * PLATFORM.md §15 names Inngest Cloud as the production queue, but
 * M9 has no Inngest project provisioned and the user has gated
 * Docker / infra changes out of scope. The intake action therefore
 * runs the orchestrator IN-PROCESS inside the request handler — the
 * dispatcher returns immediately (no `await`) and the runner
 * progresses in the background.
 *
 * The runner is structured so the future Inngest adapter slots in
 * with a one-line change: replace `runPipeline(...)` with
 * `inngest.send("studio/draft.dispatch", { runId })`. Every other
 * concern (provider resolution, cost ceiling, publisher) is unchanged.
 *
 * # Resolution failure handling
 *
 * `resolveProvidersForStore` throws when an API key is missing.
 * The runner catches it and creates a failed RunRecord so the SSE
 * watcher can surface the error to the operator instead of leaving
 * the run stuck in `pending`.
 *
 * # Publisher invocation
 *
 * After a successful pipeline run the runner immediately materialises
 * the bundle via `FanaaPublisher` (file-backed). The Octokit PR
 * writer is M10 — M9 ships the file-backed bundle so the M8 products
 * browser sees the result.
 */
export interface RunPipelineResult {
  runId: string;
  orchestrator: OrchestratorResult;
  publish?: PublishResult;
}

export interface RunIntakePipelineOptions {
  job: IngestJob;
  /** Override the store config lookup — tests pass a synthetic store. */
  storeConfig?: StoreConfig;
  /** Override providers — tests inject mocks. */
  providers?: ResolvedProviders;
  /** Override the data root — tests point at a temp dir. */
  dataRoot?: string;
}

/**
 * Look up the StoreConfig for the job's storeId via @platform/stores.
 * Falls back to `fanaaStore` for the "fanaa" id so this never throws
 * during M9 (only one store is shipped).
 */
function resolveStoreConfig(storeId: string): StoreConfig | undefined {
  if (storeId === fanaaStore.id) return fanaaStore;
  return getStore(storeId);
}

/**
 * Drive the full intake → workers → publisher pipeline for one job.
 *
 * This function is called by the intake server action (which returns
 * the promise to the response, NOT awaiting it — letting the request
 * complete immediately while the pipeline runs in the background).
 */
export async function runIntakePipeline(
  opts: RunIntakePipelineOptions,
): Promise<RunPipelineResult> {
  const storeConfig = opts.storeConfig ?? resolveStoreConfig(opts.job.storeId);
  if (!storeConfig) {
    throw new Error(`unknown_store:${opts.job.storeId}`);
  }

  const dataRoot = opts.dataRoot ?? platformDataRoot();
  const store = new FileStore(path.join(dataRoot, "runs"));

  // Resolve providers OR surface a structured failed run. We can't
  // rely on `runPipeline` to do this because it would throw before
  // the RunRecord is created, leaving the file system in a state
  // where the SSE watcher times out with `not_found`.
  let providers: ResolvedProviders;
  try {
    providers = opts.providers ?? resolveProvidersForStore({ storeConfig });
  } catch (err) {
    const message = err instanceof Error ? err.message : "provider_resolve_failed";
    // Create + fail the run in one go so the watcher sees it.
    await store.createRun({
      runId: opts.job.runId,
      job: opts.job,
      createdAt: opts.job.createdAt,
    });
    await store.markRunStarted(opts.job.runId);
    await store.markRunFailed(opts.job.runId, `providers_unavailable:${message}`);
    const fresh = (await store.getRun(opts.job.runId))!;
    return { runId: opts.job.runId, orchestrator: { run: fresh } };
  }

  const logger = createLogger({
    sink: noopSink,
    context: { runId: opts.job.runId, storeId: opts.job.storeId },
  });

  const orchestrator = await runPipeline({
    job: opts.job,
    storeConfig,
    providers,
    store,
    catalog: emptyCatalog,
    logger,
    onStepRecorded: withCostCeiling({ storeConfig }),
  });

  // Publisher only fires when the pipeline produced a final product.
  if (!orchestrator.product) {
    return { runId: opts.job.runId, orchestrator };
  }

  const publishStore = new FilePublishStore({
    rootDir: path.join(dataRoot, "products"),
  });
  const publisher = new FanaaPublisher({ store: publishStore });
  const publish = await publisher.publish({
    universalProduct: orchestrator.product,
    storeConfig,
    runId: opts.job.runId,
    actor: "studio",
  });

  return { runId: opts.job.runId, orchestrator, publish };
}

export { runsRoot };

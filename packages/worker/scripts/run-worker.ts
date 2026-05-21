#!/usr/bin/env tsx
/**
 * Worker drain CLI.
 *
 *   pnpm --filter @platform/worker run-worker
 *
 * Pulls IngestJobs off the configured FileQueue and runs the M5
 * pipeline against each one, persisting results to the configured
 * FileStore. Loops until interrupted (Ctrl+C). Exits cleanly on SIGINT.
 *
 * Environment:
 *   PLATFORM_QUEUE_DIR  — default ".platform-data/queue"
 *   PLATFORM_RUNS_DIR   — default ".platform-data/runs"
 *   ANTHROPIC_API_KEY   — required by the text/vision providers
 *   FAL_KEY             — required by the image provider
 *   FIRECRAWL_API_KEY   — required by the scraper provider
 *
 * # Single-process only
 *
 * The FileQueue is not multi-process safe (no formal locking). Running
 * two `run-worker` processes against the same queue dir is undefined
 * behaviour — the Inngest/BullMQ adapters land in M6.5 and lift this
 * restriction.
 */
import {
  FileQueue,
  FileStore,
  IngestJobSchema,
  type IngestJob,
} from "@platform/ingest";
import { fanaaStore } from "@platform/stores";
import type { StoreConfig } from "@platform/stores";
import { resolveProvidersForStore } from "../src/provider-wiring";
import { runPipeline } from "../src/runtime/orchestrator";
import { createLogger } from "../src/runtime/logger";

const QUEUE_DIR = process.env.PLATFORM_QUEUE_DIR ?? ".platform-data/queue";
const RUNS_DIR = process.env.PLATFORM_RUNS_DIR ?? ".platform-data/runs";

// Store registry — extend when a new apps/<store>/ ships in M11.
const STORES: Record<string, StoreConfig> = {
  fanaa: fanaaStore,
};

let shuttingDown = false;
process.on("SIGINT", () => {
  shuttingDown = true;
  console.log(JSON.stringify({ event: "sigint_received" }));
});
process.on("SIGTERM", () => {
  shuttingDown = true;
  console.log(JSON.stringify({ event: "sigterm_received" }));
});

async function main(): Promise<number> {
  const queue = new FileQueue<IngestJob>(QUEUE_DIR);
  const store = new FileStore(RUNS_DIR);
  const logger = createLogger({ context: { component: "worker" } });

  logger.info("worker_started", { queueDir: QUEUE_DIR, runsDir: RUNS_DIR });

  while (!shuttingDown) {
    const queued = await queue.dequeue({ timeoutMs: 1_000 });
    if (!queued) continue;

    let job: IngestJob;
    try {
      job = IngestJobSchema.parse(queued.job);
    } catch (err) {
      logger.error("invalid_job_skipped", {
        queueId: queued.id,
        errorMessage: err instanceof Error ? err.message : "unknown",
      });
      await queue.markFailed(queued.id, "invalid_job");
      continue;
    }

    const storeConfig = STORES[job.storeId];
    if (!storeConfig) {
      logger.error("unknown_store", { queueId: queued.id, storeId: job.storeId });
      await queue.markFailed(queued.id, `unknown_store:${job.storeId}`);
      continue;
    }

    try {
      const providers = resolveProvidersForStore({ storeConfig });
      const result = await runPipeline({
        job,
        storeConfig,
        providers,
        store,
        logger,
      });
      if (result.run.status === "completed") {
        await queue.markComplete(queued.id);
        logger.info("job_completed", {
          runId: job.runId,
          totalCostUsd: result.run.totalCostUsd,
        });
      } else {
        await queue.markFailed(queued.id, result.run.errorMessage ?? "unknown");
        logger.error("job_failed", {
          runId: job.runId,
          errorMessage: result.run.errorMessage,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      logger.error("worker_crashed_on_job", { runId: job.runId, message });
      await queue.markFailed(queued.id, message);
    }
  }

  logger.info("worker_stopped", {});
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("worker_main_crashed", err);
    process.exit(1);
  });

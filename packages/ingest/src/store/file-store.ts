import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { UniversalProduct } from "@platform/catalog-schema";
import type {
  CostRow,
  ListRunsFilter,
  NewRunRecord,
  RunRecord,
  RunStore,
  StepRecord,
} from "./types";

/**
 * File-backed RunStore.
 *
 * One JSON file per run: `<rootDir>/<runId>.json`. The file contains
 * the complete `RunRecord` — every append rewrites the whole file.
 * Acceptable because the file is small (≪ 1 MB even with all step
 * outputs persisted) and writes are infrequent (one per stage, ~11
 * total per run).
 *
 * # Why not JSONL for steps
 *
 *   • Replay (worker/replay.ts) needs random access to "the latest
 *     successful step output" — JSONL forces a full scan. JSON is O(1).
 *   • A run is a closed unit (11 steps); not append-forever like an
 *     event log. JSON's "rewrite-whole" cost is bounded.
 *
 * # Atomicity
 *
 * Writes go to a `.tmp` sibling, then `rename` over the destination.
 * `rename` is atomic on POSIX; on Windows it's not strictly atomic but
 * is single-syscall, sufficient for the single-writer M6 worker.
 */
export class FileStore implements RunStore {
  private readonly rootDir: string;
  private initPromise: Promise<void> | null = null;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private async ensureDir(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (!existsSync(this.rootDir)) {
        await mkdir(this.rootDir, { recursive: true });
      }
    })();
    return this.initPromise;
  }

  private pathFor(runId: string): string {
    return join(this.rootDir, `${runId}.json`);
  }

  private async writeRun(run: RunRecord): Promise<void> {
    await this.ensureDir();
    const dest = this.pathFor(run.runId);
    const tmp = `${dest}.tmp`;
    await writeFile(tmp, JSON.stringify(run, null, 2), "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(tmp, dest);
  }

  private async readRun(runId: string): Promise<RunRecord | null> {
    await this.ensureDir();
    const dest = this.pathFor(runId);
    if (!existsSync(dest)) return null;
    const raw = await readFile(dest, "utf8");
    return JSON.parse(raw) as RunRecord;
  }

  async createRun(record: NewRunRecord): Promise<RunRecord> {
    const run: RunRecord = {
      runId: record.runId,
      storeId: record.job.storeId,
      status: "pending",
      job: record.job,
      steps: [],
      costs: [],
      totalCostUsd: 0,
      createdAt: record.createdAt,
    };
    await this.writeRun(run);
    return run;
  }

  async markRunStarted(runId: string): Promise<void> {
    const run = await this.requireRun(runId);
    run.status = "running";
    run.startedAt = new Date().toISOString();
    await this.writeRun(run);
  }

  async appendStep(runId: string, step: StepRecord): Promise<void> {
    const run = await this.requireRun(runId);
    run.steps.push(step);
    await this.writeRun(run);
  }

  async appendCosts(runId: string, costs: CostRow[]): Promise<void> {
    if (costs.length === 0) return;
    const run = await this.requireRun(runId);
    run.costs.push(...costs);
    run.totalCostUsd = run.costs.reduce((sum, c) => sum + c.costUsd, 0);
    await this.writeRun(run);
  }

  async markRunComplete(
    runId: string,
    finalProduct: UniversalProduct,
  ): Promise<void> {
    const run = await this.requireRun(runId);
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    run.finalProduct = finalProduct;
    await this.writeRun(run);
  }

  async markRunFailed(runId: string, errorMessage: string): Promise<void> {
    const run = await this.requireRun(runId);
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.errorMessage = errorMessage;
    await this.writeRun(run);
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.readRun(runId);
  }

  async listRuns(filter?: ListRunsFilter): Promise<RunRecord[]> {
    await this.ensureDir();
    const limit = Math.min(filter?.limit ?? 50, 1000);
    const names = await readdir(this.rootDir);
    const runs: RunRecord[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      if (name.endsWith(".tmp.json")) continue;
      const raw = await readFile(join(this.rootDir, name), "utf8");
      const run = JSON.parse(raw) as RunRecord;
      if (filter?.storeId && run.storeId !== filter.storeId) continue;
      if (filter?.status && run.status !== filter.status) continue;
      runs.push(run);
    }
    runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return runs.slice(0, limit);
  }

  private async requireRun(runId: string): Promise<RunRecord> {
    const run = await this.readRun(runId);
    if (!run) throw new Error(`run_not_found: ${runId}`);
    return run;
  }
}

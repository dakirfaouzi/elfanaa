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
 * In-memory RunStore — tests only.
 *
 * Identical contract to FileStore / future PrismaStore, but everything
 * lives in a Map<runId, RunRecord>. Use in unit tests where filesystem
 * I/O would be noise.
 */
export class MemoryStore implements RunStore {
  private readonly runs = new Map<string, RunRecord>();

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
    this.runs.set(record.runId, run);
    return run;
  }

  async markRunStarted(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    run.status = "running";
    run.startedAt = new Date().toISOString();
  }

  async appendStep(runId: string, step: StepRecord): Promise<void> {
    const run = this.requireRun(runId);
    run.steps.push(step);
  }

  async appendCosts(runId: string, costs: CostRow[]): Promise<void> {
    if (costs.length === 0) return;
    const run = this.requireRun(runId);
    run.costs.push(...costs);
    run.totalCostUsd = run.costs.reduce((sum, c) => sum + c.costUsd, 0);
  }

  async markRunComplete(
    runId: string,
    finalProduct: UniversalProduct,
  ): Promise<void> {
    const run = this.requireRun(runId);
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    run.finalProduct = finalProduct;
  }

  async markRunFailed(runId: string, errorMessage: string): Promise<void> {
    const run = this.requireRun(runId);
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.errorMessage = errorMessage;
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }

  async listRuns(filter?: ListRunsFilter): Promise<RunRecord[]> {
    const limit = Math.min(filter?.limit ?? 50, 1000);
    let rows = Array.from(this.runs.values());
    if (filter?.storeId) rows = rows.filter((r) => r.storeId === filter.storeId);
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows.slice(0, limit);
  }

  private requireRun(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run_not_found: ${runId}`);
    return run;
  }
}

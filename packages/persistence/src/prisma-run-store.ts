import type { UniversalProduct } from "@platform/catalog-schema";
import type {
  CostRow,
  ListRunsFilter,
  NewRunRecord,
  RunRecord,
  RunStore,
  StepRecord,
} from "@platform/ingest/store";
import {
  PersistenceError,
  type PrismaLike,
  type PrismaRunStoreOptions,
} from "./contracts";
import {
  runRecordToCreateInput,
  runRowToRecord,
  runStatusToPrisma,
  stepRecordToCreateInput,
  usdToCents,
} from "./mappers";

/**
 * Postgres-backed `RunStore` (PLATFORM.md §13).
 *
 * # Identity model
 *
 * Two ID spaces exist:
 *
 *   • `runId`  — supplied by the worker. URL-safe. Used by the
 *               worker, file-store, and SSE endpoint.
 *   • `id`     — Prisma cuid PK on `studio_run`. Internal to the DB.
 *
 * `studio_run.run_id` is a UNIQUE index so the two spaces stay in
 * lockstep. PrismaRunStore reads by `runId` everywhere — never by
 * the internal cuid.
 *
 * # Draft binding
 *
 * Studio creates a `StudioDraft` row at intake time and passes the
 * draftId in via the `draftIdResolver` hook. If no draft exists for
 * the runId, `createRun` returns a `PersistenceError{not_found}` —
 * the M6 contract requires `createRun` to succeed, so the caller
 * MUST seed the draft first. Composite stores handle this by ALWAYS
 * creating a draft for a new run before delegating to PrismaRunStore.
 *
 * # What is NOT in M10
 *
 *   • Per-provider cost attribution (`studio_run_cost` table) —
 *     M11. Costs roll up to `studio_step.cost_cents`.
 *   • `studio_artifact` writes — the worker assembles artifacts
 *     in-memory and the publisher consumes them; persisting them
 *     to Postgres is M11.
 *   • `studio_event` writes from inside the store — that's the
 *     caller's responsibility via `StudioEventRepository`.
 */
export class PrismaRunStore implements RunStore {
  private readonly prisma: PrismaLike;
  private readonly draftIdResolver: (runId: string) => Promise<string | null>;

  constructor(opts: PrismaRunStoreOptions) {
    this.prisma = opts.prisma;
    this.draftIdResolver = opts.draftIdResolver;
  }

  async createRun(record: NewRunRecord): Promise<RunRecord> {
    const draftId = await this.draftIdResolver(record.runId);
    if (!draftId) {
      throw new PersistenceError({
        kind: "not_found",
        message: `prisma_run_store_draft_not_found_for_run:${record.runId}`,
      });
    }
    const seed: RunRecord = {
      runId: record.runId,
      storeId: record.job.storeId,
      status: "pending",
      job: record.job,
      steps: [],
      costs: [],
      totalCostUsd: 0,
      createdAt: record.createdAt,
    };
    const data = runRecordToCreateInput(seed, draftId);
    try {
      // Upsert by `runId` so a re-issue (rare; e.g. composite store
      // retrying after a partial file write) is idempotent.
      await this.prisma.studioRun.upsert({
        where: { runId: record.runId },
        create: { ...data, runId: record.runId },
        update: {
          status: data.status,
          inputSnapshot: data.inputSnapshot,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "createRun");
    }
    return seed;
  }

  async markRunStarted(runId: string): Promise<void> {
    try {
      await this.prisma.studioRun.update({
        where: { runId },
        data: {
          status: "running",
          startedAt: new Date(),
        },
      });
    } catch (err) {
      throw wrapDbError(err, "markRunStarted");
    }
  }

  async appendStep(runId: string, step: StepRecord): Promise<void> {
    try {
      const run = await this.prisma.studioRun.findUnique({ where: { runId } });
      if (!run) {
        throw new PersistenceError({
          kind: "not_found",
          message: `prisma_run_store_run_not_found:${runId}`,
        });
      }
      const prismaRunId = (run as { id: string }).id;
      const stepRow = stepRecordToCreateInput(step, prismaRunId);
      await this.prisma.studioStep.create({ data: stepRow });
    } catch (err) {
      throw wrapDbError(err, "appendStep");
    }
  }

  async appendCosts(runId: string, costs: CostRow[]): Promise<void> {
    if (costs.length === 0) return;
    const incrementCents = costs.reduce(
      (sum, c) => sum + usdToCents(c.costUsd),
      0,
    );
    try {
      const run = await this.prisma.studioRun.findUnique({ where: { runId } });
      if (!run) {
        throw new PersistenceError({
          kind: "not_found",
          message: `prisma_run_store_run_not_found:${runId}`,
        });
      }
      await this.prisma.studioRun.update({
        where: { runId },
        data: {
          costCents: (run as { costCents: number }).costCents + incrementCents,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "appendCosts");
    }
  }

  async markRunComplete(
    runId: string,
    _finalProduct: UniversalProduct,
  ): Promise<void> {
    try {
      await this.prisma.studioRun.update({
        where: { runId },
        data: {
          status: runStatusToPrisma("completed"),
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      throw wrapDbError(err, "markRunComplete");
    }
  }

  async markRunFailed(runId: string, errorMessage: string): Promise<void> {
    try {
      await this.prisma.studioRun.update({
        where: { runId },
        data: {
          status: runStatusToPrisma("failed"),
          finishedAt: new Date(),
          errorMessage,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "markRunFailed");
    }
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    try {
      const row = await this.prisma.studioRun.findUnique({
        where: { runId },
        include: { steps: true },
      });
      if (!row) return null;
      return runRowToRecord(row);
    } catch (err) {
      throw wrapDbError(err, "getRun");
    }
  }

  async listRuns(filter?: ListRunsFilter): Promise<RunRecord[]> {
    const limit = Math.min(filter?.limit ?? 50, 1000);
    try {
      const rows = await this.prisma.studioRun.findMany({
        where: {
          // Filter by storeId at the database level via the draft join.
          // Prisma supports relation filters but our PrismaLike doesn't
          // type them — fall back to in-memory filtering after fetch.
        },
        include: { steps: true },
        orderBy: { startedAt: "desc" },
        take: limit * 4, // over-fetch + filter
      });
      let runs = rows.map(runRowToRecord);
      if (filter?.storeId) {
        runs = runs.filter((r) => r.storeId === filter.storeId);
      }
      if (filter?.status) {
        runs = runs.filter((r) => r.status === filter.status);
      }
      return runs.slice(0, limit);
    } catch (err) {
      throw wrapDbError(err, "listRuns");
    }
  }
}

function wrapDbError(err: unknown, op: string): PersistenceError {
  if (err instanceof PersistenceError) return err;
  const e = err as { code?: string; name?: string; message?: string };
  if (e?.code === "P2025") {
    return new PersistenceError({
      kind: "not_found",
      message: `prisma_${op}_not_found:${e.message ?? ""}`,
      cause: err,
    });
  }
  if (e?.code === "P2002") {
    return new PersistenceError({
      kind: "conflict",
      message: `prisma_${op}_conflict:${e.message ?? ""}`,
      cause: err,
    });
  }
  if (e?.code === "P2003") {
    return new PersistenceError({
      kind: "invalid_input",
      message: `prisma_${op}_fk_violation:${e.message ?? ""}`,
      cause: err,
    });
  }
  return new PersistenceError({
    kind: "unknown",
    message: `prisma_${op}_failed:${e?.message ?? "unknown"}`,
    cause: err,
  });
}

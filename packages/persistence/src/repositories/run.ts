import type { RunRecord } from "@platform/ingest/store";
import {
  PersistenceError,
  type PrismaLike,
  type StudioRunRow,
} from "../contracts";
import { runRowToRecord } from "../mappers";

/**
 * StudioRunRepository — read-side wrapper around `prisma.studioRun`.
 *
 * # Why a separate repository
 *
 * `PrismaRunStore` owns the worker-side write contract (`RunStore`).
 * This repository owns reads that Studio surfaces — listing runs
 * for a draft, fetching a single run by draftId, etc. Splitting the
 * two keeps each surface focused.
 *
 * # Replay support
 *
 * `loadForReplay` returns a fully materialised `RunRecord` so the
 * worker's M6 replay code path can re-run any persisted run. This
 * is the read side of "Run recovery/replay loading" in M10.
 */
export class StudioRunRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  async findByRunId(runId: string): Promise<StudioRunRow | null> {
    try {
      return await this.prisma.studioRun.findUnique({
        where: { runId },
        include: { steps: true },
      });
    } catch (err) {
      throw wrapDbError(err, "find_run");
    }
  }

  async listForDraft(args: {
    draftId: string;
    take?: number;
  }): Promise<StudioRunRow[]> {
    try {
      return await this.prisma.studioRun.findMany({
        where: { draftId: args.draftId },
        orderBy: { startedAt: "desc" },
        include: { steps: true },
        take: Math.min(args.take ?? 50, 1000),
      });
    } catch (err) {
      throw wrapDbError(err, "list_runs_for_draft");
    }
  }

  /**
   * Materialise a RunRecord from Postgres so the worker can replay
   * a run that exists only in the DB (e.g. the operator's laptop
   * is no longer holding the original `.platform-data/runs/` files).
   */
  async loadForReplay(runId: string): Promise<RunRecord | null> {
    const row = await this.findByRunId(runId);
    if (!row) return null;
    return runRowToRecord(row);
  }
}

function wrapDbError(err: unknown, op: string): PersistenceError {
  if (err instanceof PersistenceError) return err;
  const e = err as { message?: string };
  return new PersistenceError({
    kind: "unknown",
    message: `${op}_failed:${e?.message ?? "unknown"}`,
    cause: err,
  });
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UniversalProductSchema } from "@platform/catalog-schema/schemas";
import { IngestJobSchema } from "@platform/ingest";
import type { RunRecord, RunStatus, StepRecord } from "@platform/ingest";
import { runRowToRecord, type StudioRunRow } from "@platform/persistence";
import { getStudioPersistence } from "./persistence";
import { runsRoot } from "./paths";

/**
 * Studio run loader — Postgres-first, filesystem-fallback.
 *
 * # Why this hybrid
 *
 * M9 wrote runs to `.platform-data/runs/<runId>.json` on the local
 * filesystem. M10 added Postgres dual-write via `CompositeRunStore`,
 * but kept reads file-backed for behavioural continuity. M13 (this
 * module) flips the read path to Postgres because filesystem
 * persistence is too fragile under managed-platform rebuilds:
 *
 *   • EasyPanel / similar PaaS volumes can be reset on rebuild
 *     (verified twice in production — the recurrence is what
 *     motivated this change).
 *   • A subtle cwd mismatch shipped silently: the standalone Next.js
 *     server runs from `/app/apps/studio`, not `/app/`, so
 *     `process.cwd()/.platform-data` resolves to a directory that
 *     is NOT the mounted volume. Writes landed on the ephemeral
 *     overlay layer, and every rebuild wiped them.
 *
 * # Read order
 *
 *   1. Try Postgres via `StudioRunRepository`. This is the durable
 *      authority — drafts, runs, and steps live in the same database
 *      with the same lifecycle.
 *   2. Fall back to the filesystem for runs that pre-date dual-write
 *      OR for dev environments running without Postgres. Validated
 *      against the same Zod schema as before so corruption surfaces
 *      identically in the UI.
 *
 * # Why we DON'T just rip out the filesystem path
 *
 * The SSE live-update watcher (run-watcher.ts) still tails files for
 * sub-second step updates while a run is in flight. Removing the file
 * write would require a Postgres LISTEN/NOTIFY rewrite that's out of
 * scope for this fix. As long as the worker dual-writes, the file is
 * just a transient tail buffer and the DB is the source of truth.
 *
 * # Public contract — UNCHANGED
 *
 * `listRuns()` and `readRun(runId)` keep the M9 signatures (return
 * shapes, status discriminators, corrupted-record handling). Every
 * caller — pages, API routes, replay action — works without edits.
 */

/* ─── Mirror schemas (filesystem fallback path) ──────────────────────── */

const StepRecordSchema: z.ZodType<StepRecord> = z.object({
  stage: z.string().min(1),
  status: z.enum(["success", "failed", "skipped"]),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
  attempts: z.number().int().positive(),
  costUsd: z.number().nonnegative(),
  output: z.unknown().optional(),
  errorMessage: z.string().optional(),
  errorKind: z.string().optional(),
});

const CostRowSchema = z.object({
  runId: z.string().min(1),
  stage: z.string().min(1),
  capability: z.string().min(1),
  providerId: z.string().min(1),
  model: z.string().optional(),
  costUsd: z.number().nonnegative(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  latencyMs: z.number().nonnegative(),
  timestamp: z.string().min(1),
});

const RunStatusSchema: z.ZodType<RunStatus> = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

const RunRecordSchema: z.ZodType<RunRecord> = z.object({
  runId: z.string().min(1),
  storeId: z.string().min(1),
  status: RunStatusSchema,
  job: IngestJobSchema,
  steps: z.array(StepRecordSchema),
  costs: z.array(CostRowSchema),
  totalCostUsd: z.number().nonnegative(),
  createdAt: z.string().min(1),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  finalProduct: UniversalProductSchema.optional(),
  errorMessage: z.string().optional(),
});

/* ─── Result types — unchanged from M9 ───────────────────────────────── */

export type RunLoadResult =
  | { status: "ok"; run: RunRecord; filePath: string }
  | { status: "not_found"; runId: string }
  | {
      status: "corrupted";
      runId: string;
      filePath: string;
      reason: "invalid_json" | "schema_mismatch" | "read_error";
      details?: string;
    };

export interface RunSummary {
  runId: string;
  storeId: string;
  status: RunStatus;
  supplierUrl: string;
  createdAt: string;
  finishedAt?: string;
  totalCostUsd: number;
  stepCount: number;
  finalProductId?: string;
  errorMessage?: string;
  corrupted?: { reason: string };
}

/* ─── Public API ────────────────────────────────────────────────────── */

/**
 * List every run, newest first. DB-first; falls back to filesystem
 * scan when the DB layer is unavailable (no `ADMIN_DATABASE_URL`,
 * no `@prisma/client`, etc.) or when the DB returns zero rows AND
 * the filesystem has historical records.
 *
 * Why we MERGE rather than picking one source:
 *
 * Pre-M13 file-only runs that were never dual-written exist on the
 * volume. We want them visible in the UI alongside DB-backed runs
 * during the transition. De-duplication is by `runId`; the DB row
 * wins because it carries the authoritative cost rollups.
 */
export async function listRuns(): Promise<RunSummary[]> {
  const dbSummaries = await listRunsFromDb();
  const fsSummaries = await listRunsFromFs();

  if (!dbSummaries) {
    return fsSummaries;
  }

  const byId = new Map<string, RunSummary>();
  for (const s of fsSummaries) byId.set(s.runId, s);
  for (const s of dbSummaries) byId.set(s.runId, s); // DB wins on conflict

  const merged = Array.from(byId.values());
  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return merged;
}

export async function readRun(runId: string): Promise<RunLoadResult> {
  const fromDb = await readRunFromDb(runId);
  if (fromDb) return fromDb;
  return readRunFromFs(runId);
}

/* ─── DB-backed implementation ───────────────────────────────────────── */

/**
 * Resolve the DB-backed run repository, or null when persistence is
 * file-only / DB is misconfigured. Never throws — the loader degrades
 * to filesystem mode on any setup failure.
 */
function tryGetRunRepository() {
  try {
    const p = getStudioPersistence();
    return p.repositories?.run ?? null;
  } catch {
    return null;
  }
}

async function listRunsFromDb(): Promise<RunSummary[] | null> {
  const repo = tryGetRunRepository();
  if (!repo) return null;
  let rows: StudioRunRow[];
  try {
    rows = await repo.listAll({ take: 500 });
  } catch {
    return null;
  }
  return rows.map(rowToSummary);
}

async function readRunFromDb(runId: string): Promise<RunLoadResult | null> {
  const repo = tryGetRunRepository();
  if (!repo) return null;
  let row: StudioRunRow | null;
  try {
    row = await repo.findByRunId(runId);
  } catch {
    return null;
  }
  if (!row) return null;
  const record = runRowToRecord(row);
  return { status: "ok", run: record, filePath: dbFilePathLabel(runId) };
}

/**
 * The "filePath" field on RunLoadResult is rendered in the UI's
 * corrupted-record panel. DB-loaded runs don't have a file, so we
 * synthesise a stable virtual path label that's clearly DB-sourced.
 * Hard to confuse with a real path even at a glance.
 */
function dbFilePathLabel(runId: string): string {
  return `db://studio_run/${runId}`;
}

function rowToSummary(row: StudioRunRow): RunSummary {
  const record = runRowToRecord(row);
  return {
    runId: record.runId,
    storeId: record.storeId,
    status: record.status,
    supplierUrl: record.job.supplierUrl,
    createdAt: record.createdAt,
    finishedAt: record.finishedAt,
    totalCostUsd: record.totalCostUsd,
    stepCount: record.steps.length,
    finalProductId: record.finalProduct?.id,
    errorMessage: record.errorMessage,
  };
}

/* ─── Filesystem-backed implementation (fallback / dev / SSE tail) ────── */

async function listRunsFromFs(): Promise<RunSummary[]> {
  const dir = runsRoot();
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const ids = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  const out: RunSummary[] = [];
  for (const id of ids) {
    const r = await readRunFromFs(id);
    if (r.status === "ok") {
      out.push({
        runId: r.run.runId,
        storeId: r.run.storeId,
        status: r.run.status,
        supplierUrl: r.run.job.supplierUrl,
        createdAt: r.run.createdAt,
        finishedAt: r.run.finishedAt,
        totalCostUsd: r.run.totalCostUsd,
        stepCount: r.run.steps.length,
        finalProductId: r.run.finalProduct?.id,
        errorMessage: r.run.errorMessage,
      });
    } else if (r.status === "corrupted") {
      out.push({
        runId: id,
        storeId: "",
        status: "pending",
        supplierUrl: "",
        createdAt: "",
        totalCostUsd: 0,
        stepCount: 0,
        corrupted: { reason: r.reason },
      });
    }
  }

  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

async function readRunFromFs(runId: string): Promise<RunLoadResult> {
  const filePath = path.join(runsRoot(), `${runId}.json`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { status: "not_found", runId };
    }
    return {
      status: "corrupted",
      runId,
      filePath,
      reason: "read_error",
      details: (err as Error).message,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "corrupted",
      runId,
      filePath,
      reason: "invalid_json",
      details: (err as Error).message,
    };
  }

  const result = RunRecordSchema.safeParse(parsed);
  if (!result.success) {
    return {
      status: "corrupted",
      runId,
      filePath,
      reason: "schema_mismatch",
      details: result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  return { status: "ok", run: result.data, filePath };
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UniversalProductSchema } from "@platform/catalog-schema/schemas";
import { IngestJobSchema } from "@platform/ingest";
import type { RunRecord, RunStatus, StepRecord } from "@platform/ingest";
import { runsRoot } from "./paths";

/**
 * Read M6 worker artefacts from `.platform-data/runs/<runId>.json`.
 *
 * Mirrors the M7 product loader's contract:
 *   • read-only, validation-on-read, typed not-found/corrupted results.
 *
 * Why a Studio-local RunRecord schema?
 *
 * The @platform/ingest FileStore writes its records but exposes no
 * "verify on read" surface — it trusts itself. The Studio reads files
 * the worker wrote earlier on (potentially different worker version),
 * so we cross-validate via Zod here. Drift between the worker's
 * RunRecord shape and the Studio's expectation surfaces as a typed
 * `corrupted` result.
 */

/* ─── Mirror schemas ─────────────────────────────────────────────────── */

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

/* ─── Result types ───────────────────────────────────────────────────── */

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

/** List every run in `.platform-data/runs/`. Newest first. Corrupt
 *  records surface alongside healthy ones — same UX rationale as the
 *  product loader. */
export async function listRuns(): Promise<RunSummary[]> {
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
    const r = await readRun(id);
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

export async function readRun(runId: string): Promise<RunLoadResult> {
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

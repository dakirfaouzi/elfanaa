import type {
  CostRow,
  RunRecord,
  StepRecord,
  StudioRunRow,
  StudioRunStatusValue,
  StudioStepRow,
  StudioStepStatusValue,
} from "./contracts";

/**
 * Mapping helpers between the worker's `RunRecord` (the M6 file-store
 * shape) and the Prisma `Studio*Row` shapes.
 *
 * # Design contract
 *
 * Mappers are PURE functions. They do not touch Prisma, they do not
 * read the file system. This means:
 *
 *   • The mapper test suite has zero external dependencies.
 *   • The mapping logic is reusable from a future Inngest function
 *     that materialises step results from the event stream.
 *
 * # Cost unit conversion
 *
 *   • Worker uses `costUsd: number` (USD floats).
 *   • Prisma stores `costCents: number` (USD-equivalent integer cents).
 *
 * Conversion is `Math.round(costUsd * 100)` on the way in, division
 * on the way out. Round-trips are byte-stable for USD amounts with
 * up to two decimals — anything finer is rounded with the standard
 * banker's-cent precision (acceptable because individual provider
 * calls almost never spend less than $0.001 anyway).
 *
 * # Status mapping
 *
 * The worker's `RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled"`
 * maps to Prisma's `StudioRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"`.
 * The `pending/queued` and `completed/succeeded` synonyms exist for
 * historical reasons (file-store predates the schema).
 */

// ─────────────────────────────────────────────────────────────────────────
// Unit conversion
// ─────────────────────────────────────────────────────────────────────────

export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * 100);
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

// ─────────────────────────────────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────────────────────────────────

export function runStatusToPrisma(
  status: RunRecord["status"],
): StudioRunStatusValue {
  switch (status) {
    case "pending":
      return "queued";
    case "running":
      return "running";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

export function runStatusFromPrisma(
  status: StudioRunStatusValue,
): RunRecord["status"] {
  switch (status) {
    case "queued":
      return "pending";
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

export function stepStatusToPrisma(
  status: StepRecord["status"],
): StudioStepStatusValue {
  switch (status) {
    case "success":
      return "succeeded";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
  }
}

export function stepStatusFromPrisma(
  status: StudioStepStatusValue,
): StepRecord["status"] {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    // `pending` / `running` are mid-flight states the worker never
    // surfaces back as a StepRecord (which is only emitted on
    // terminal status). When read back from the DB we coerce them
    // conservatively to `skipped` so the RunRecord shape stays valid.
    case "pending":
    case "running":
      return "skipped";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// StepRecord ↔ StudioStepRow
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compose the Prisma create-input for a StudioStep row from the
 * worker's `StepRecord`. The DB-side `runId` is the PK of the parent
 * `StudioRun` row, not the worker's runId — callers MUST supply the
 * resolved Prisma run id.
 */
export function stepRecordToCreateInput(
  step: StepRecord,
  prismaRunId: string,
  providerId?: string,
): Omit<StudioStepRow, "id"> {
  return {
    runId: prismaRunId,
    kind: step.stage,
    status: stepStatusToPrisma(step.status),
    providerId: providerId ?? null,
    inputHash: null, // M11 content-addressed caching
    attemptCount: step.attempts,
    costCents: usdToCents(step.costUsd),
    tokensIn: null,
    tokensOut: null,
    latencyMs: step.durationMs,
    startedAt: parseIsoDate(step.startedAt),
    finishedAt: parseIsoDate(step.finishedAt),
    errorMessage: step.errorMessage ?? null,
    errorKind: step.errorKind ?? null,
    output: step.output ?? null,
  };
}

export function stepRowToRecord(row: StudioStepRow): StepRecord {
  return {
    stage: row.kind,
    status: stepStatusFromPrisma(row.status),
    startedAt: (row.startedAt ?? new Date(0)).toISOString(),
    finishedAt: (row.finishedAt ?? new Date(0)).toISOString(),
    durationMs: row.latencyMs ?? 0,
    attempts: row.attemptCount,
    costUsd: centsToUsd(row.costCents),
    output: row.output ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    errorKind: row.errorKind ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// RunRecord ↔ StudioRunRow
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compose the Prisma create-input for a StudioRun row. The `draftId`
 * MUST be resolved by the caller — the M6 RunStore contract doesn't
 * know about drafts, so the persistence layer wraps it with a
 * `draftIdResolver` hook.
 */
export function runRecordToCreateInput(
  record: RunRecord,
  draftId: string,
): Omit<StudioRunRow, "id" | "steps"> {
  return {
    draftId,
    runId: record.runId,
    inngestRunId: null,
    status: runStatusToPrisma(record.status),
    costCents: usdToCents(record.totalCostUsd),
    startedAt: parseIsoDate(record.startedAt),
    finishedAt: parseIsoDate(record.finishedAt),
    errorMessage: record.errorMessage ?? null,
    // Full IngestJob persisted verbatim for deterministic replay.
    inputSnapshot: record.job as unknown,
  };
}

/**
 * Materialise a `RunRecord` from a Prisma row (with steps joined).
 * Used by replay loading + the asset browser's "show run details"
 * endpoint.
 *
 * Cost rows are NOT persisted individually in M10 — they roll up to
 * `studio_step.cost_cents`. We synthesise an empty `costs[]` array
 * to satisfy the RunRecord contract; the per-provider attribution
 * table lands with M11.
 */
export function runRowToRecord(row: StudioRunRow): RunRecord {
  const steps = (row.steps ?? []).map(stepRowToRecord);
  return {
    runId: row.runId,
    storeId: extractStoreIdFromInputSnapshot(row.inputSnapshot),
    status: runStatusFromPrisma(row.status),
    job: row.inputSnapshot as RunRecord["job"],
    steps,
    costs: [] as CostRow[],
    totalCostUsd: centsToUsd(row.costCents),
    createdAt: (row.startedAt ?? new Date(0)).toISOString(),
    startedAt: row.startedAt?.toISOString(),
    finishedAt: row.finishedAt?.toISOString(),
    errorMessage: row.errorMessage ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractStoreIdFromInputSnapshot(snap: unknown): string {
  if (snap && typeof snap === "object" && "storeId" in snap) {
    const v = (snap as Record<string, unknown>).storeId;
    if (typeof v === "string") return v;
  }
  return "";
}

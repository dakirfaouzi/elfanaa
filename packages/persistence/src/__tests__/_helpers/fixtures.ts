import type { IngestJob } from "@platform/ingest";
import type { RunRecord, StepRecord } from "@platform/ingest/store";
import type { StudioDraftRow, StudioRunRow, StudioStepRow } from "../../contracts";

export function makeIngestJob(overrides: Partial<IngestJob> = {}): IngestJob {
  return {
    runId: "run_test_001",
    storeId: "fanaa",
    supplierUrl: "https://example.com/product/abc",
    uploadedImages: [],
    priceHint: { amount: 9900, currency: "SAR" },
    operatorNotes: undefined,
    marginNotes: undefined,
    skipResearch: false,
    createdAt: "2026-05-22T10:00:00.000Z",
    ...overrides,
  };
}

export function makeStepRecord(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    stage: "research",
    status: "success",
    startedAt: "2026-05-22T10:00:00.000Z",
    finishedAt: "2026-05-22T10:00:05.000Z",
    durationMs: 5000,
    attempts: 1,
    costUsd: 0.012,
    output: { foo: "bar" },
    ...overrides,
  };
}

export function makeRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  const job = overrides.job ?? makeIngestJob();
  return {
    runId: job.runId,
    storeId: job.storeId,
    status: "pending",
    job,
    steps: [],
    costs: [],
    totalCostUsd: 0,
    createdAt: "2026-05-22T10:00:00.000Z",
    ...overrides,
  };
}

export function makeStudioDraftRow(overrides: Partial<StudioDraftRow> = {}): StudioDraftRow {
  return {
    id: "draft_test_001",
    storeId: "fanaa",
    slug: "test-product",
    title: "Test product",
    supplierUrl: null,
    notes: null,
    positioning: null,
    status: "intake",
    template: "default",
    costCents: 0,
    publishedAt: null,
    publishedRef: null,
    createdBy: "system",
    createdAt: new Date("2026-05-22T10:00:00.000Z"),
    updatedAt: new Date("2026-05-22T10:00:00.000Z"),
    ...overrides,
  };
}

export function makeStudioRunRow(overrides: Partial<StudioRunRow> = {}): StudioRunRow {
  return {
    id: "run_pk_001",
    draftId: "draft_test_001",
    runId: "run_test_001",
    inngestRunId: null,
    status: "queued",
    costCents: 0,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    inputSnapshot: makeIngestJob(),
    steps: [],
    ...overrides,
  };
}

export function makeStudioStepRow(overrides: Partial<StudioStepRow> = {}): StudioStepRow {
  return {
    id: "step_pk_001",
    runId: "run_pk_001",
    kind: "research",
    status: "succeeded",
    providerId: null,
    inputHash: null,
    attemptCount: 1,
    costCents: 1,
    tokensIn: null,
    tokensOut: null,
    latencyMs: 5000,
    startedAt: new Date("2026-05-22T10:00:00.000Z"),
    finishedAt: new Date("2026-05-22T10:00:05.000Z"),
    errorMessage: null,
    errorKind: null,
    output: { foo: "bar" },
    ...overrides,
  };
}

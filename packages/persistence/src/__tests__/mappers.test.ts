import { describe, expect, it } from "vitest";
import {
  centsToUsd,
  runRecordToCreateInput,
  runRowToRecord,
  runStatusFromPrisma,
  runStatusToPrisma,
  stepRecordToCreateInput,
  stepRowToRecord,
  stepStatusFromPrisma,
  stepStatusToPrisma,
  usdToCents,
} from "../mappers";
import {
  makeIngestJob,
  makeRunRecord,
  makeStepRecord,
  makeStudioRunRow,
  makeStudioStepRow,
} from "./_helpers/fixtures";

describe("usdToCents / centsToUsd", () => {
  it("round-trips a typical amount byte-stable", () => {
    expect(usdToCents(0.12)).toBe(12);
    expect(centsToUsd(12)).toBe(0.12);
  });

  it("rounds banker's-cent: 0.0049 → 0, 0.005 → 1", () => {
    expect(usdToCents(0.0049)).toBe(0);
    expect(usdToCents(0.005)).toBe(1);
  });

  it("rejects NaN / Infinity with 0", () => {
    expect(usdToCents(Number.NaN)).toBe(0);
    expect(usdToCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("status mapping", () => {
  it("RunStatus pending ↔ queued, completed ↔ succeeded", () => {
    expect(runStatusToPrisma("pending")).toBe("queued");
    expect(runStatusToPrisma("completed")).toBe("succeeded");
    expect(runStatusFromPrisma("queued")).toBe("pending");
    expect(runStatusFromPrisma("succeeded")).toBe("completed");
  });

  it("StepStatus success ↔ succeeded round-trips", () => {
    for (const s of ["success", "failed", "skipped"] as const) {
      expect(stepStatusFromPrisma(stepStatusToPrisma(s))).toBe(s);
    }
  });

  it("StepStatus pending/running from Prisma coerce to skipped", () => {
    expect(stepStatusFromPrisma("pending")).toBe("skipped");
    expect(stepStatusFromPrisma("running")).toBe("skipped");
  });
});

describe("runRecordToCreateInput", () => {
  it("produces the StudioRun create input with cost converted to cents", () => {
    const record = makeRunRecord({
      totalCostUsd: 0.55,
      startedAt: "2026-05-22T10:00:01.000Z",
    });
    const out = runRecordToCreateInput(record, "draft_pk_001");
    expect(out).toMatchObject({
      draftId: "draft_pk_001",
      runId: record.runId,
      status: "queued",
      costCents: 55,
      inputSnapshot: record.job,
    });
    expect(out.startedAt).toBeInstanceOf(Date);
    expect(out.startedAt?.toISOString()).toBe("2026-05-22T10:00:01.000Z");
  });

  it("nullifies the snapshot's missing optional fields gracefully", () => {
    const record = makeRunRecord();
    const out = runRecordToCreateInput(record, "draft_pk_001");
    expect(out.startedAt).toBeNull();
    expect(out.finishedAt).toBeNull();
    expect(out.errorMessage).toBeNull();
  });
});

describe("stepRecordToCreateInput / stepRowToRecord", () => {
  it("step → create input applies cost conversion + provider passthrough", () => {
    const step = makeStepRecord({ costUsd: 0.23, attempts: 2 });
    const out = stepRecordToCreateInput(step, "run_pk_001", "anthropic-claude");
    expect(out).toMatchObject({
      runId: "run_pk_001",
      kind: "research",
      status: "succeeded",
      providerId: "anthropic-claude",
      attemptCount: 2,
      costCents: 23,
      latencyMs: 5000,
    });
  });

  it("step row → record round-trip preserves business fields", () => {
    const row = makeStudioStepRow({ costCents: 50, attemptCount: 3 });
    const back = stepRowToRecord(row);
    expect(back).toMatchObject({
      stage: "research",
      status: "success",
      attempts: 3,
      costUsd: 0.5,
      durationMs: 5000,
    });
  });
});

describe("runRowToRecord", () => {
  it("materialises a complete RunRecord from a row + step rows", () => {
    const row = makeStudioRunRow({
      status: "succeeded",
      costCents: 75,
      startedAt: new Date("2026-05-22T10:00:00.000Z"),
      finishedAt: new Date("2026-05-22T10:05:00.000Z"),
      steps: [makeStudioStepRow()],
    });
    const back = runRowToRecord(row);
    expect(back.status).toBe("completed");
    expect(back.totalCostUsd).toBe(0.75);
    expect(back.steps).toHaveLength(1);
    expect(back.steps[0]!.stage).toBe("research");
    expect(back.startedAt).toBe("2026-05-22T10:00:00.000Z");
    expect(back.finishedAt).toBe("2026-05-22T10:05:00.000Z");
  });

  it("extracts storeId from inputSnapshot when available", () => {
    const row = makeStudioRunRow({
      inputSnapshot: makeIngestJob({ storeId: "trendora" }),
    });
    const back = runRowToRecord(row);
    expect(back.storeId).toBe("trendora");
  });

  it("falls back to empty storeId when inputSnapshot lacks it", () => {
    const row = makeStudioRunRow({ inputSnapshot: {} });
    const back = runRowToRecord(row);
    expect(back.storeId).toBe("");
  });
});

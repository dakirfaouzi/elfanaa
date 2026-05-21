import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IngestJob } from "../../jobs";
import { FileStore } from "../file-store";

function makeJob(overrides?: Partial<IngestJob>): IngestJob {
  return {
    runId: "run_file_1",
    storeId: "fanaa",
    supplierUrl: "https://supplier.example/p/1",
    uploadedImages: [],
    priceHint: { amount: 199, currency: "SAR" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FileStore", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "fanaa-fs-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("persists run state across a 're-open' (new instance)", async () => {
    const s1 = new FileStore(root);
    await s1.createRun({
      runId: "run_file_1",
      job: makeJob(),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s1.markRunStarted("run_file_1");

    const s2 = new FileStore(root);
    const run = await s2.getRun("run_file_1");
    expect(run?.status).toBe("running");
  });

  it("appendStep + appendCosts mutate state durably", async () => {
    const s = new FileStore(root);
    await s.createRun({
      runId: "run_file_2",
      job: makeJob({ runId: "run_file_2" }),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s.appendStep("run_file_2", {
      stage: "research",
      status: "success",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
      attempts: 1,
      costUsd: 0.01,
      output: { supplierUrl: "x" },
    });
    await s.appendCosts("run_file_2", [
      {
        runId: "run_file_2",
        stage: "research",
        capability: "scraper",
        providerId: "firecrawl",
        costUsd: 0.01,
        latencyMs: 100,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const fresh = new FileStore(root);
    const run = await fresh.getRun("run_file_2");
    expect(run?.steps).toHaveLength(1);
    expect(run?.costs).toHaveLength(1);
    expect(run?.totalCostUsd).toBeCloseTo(0.01, 5);
  });

  it("listRuns filters by status", async () => {
    const s = new FileStore(root);
    await s.createRun({
      runId: "run_file_3a",
      job: makeJob({ runId: "run_file_3a" }),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s.markRunFailed("run_file_3a", "boom");

    await s.createRun({
      runId: "run_file_3b",
      job: makeJob({ runId: "run_file_3b" }),
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    await s.markRunStarted("run_file_3b");

    const failed = await s.listRuns({ status: "failed" });
    expect(failed.map((r) => r.runId)).toEqual(["run_file_3a"]);

    const running = await s.listRuns({ status: "running" });
    expect(running.map((r) => r.runId)).toEqual(["run_file_3b"]);
  });

  it("returns null when run id does not exist", async () => {
    const s = new FileStore(root);
    expect(await s.getRun("missing")).toBeNull();
  });
});

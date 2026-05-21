import { describe, expect, it } from "vitest";
import type { UniversalProduct } from "@platform/catalog-schema";
import type { IngestJob } from "../../jobs";
import { MemoryStore } from "../memory-store";

function makeJob(overrides?: Partial<IngestJob>): IngestJob {
  return {
    runId: "run_mem_1",
    storeId: "fanaa",
    supplierUrl: "https://supplier.example/p/1",
    uploadedImages: [],
    priceHint: { amount: 199, currency: "SAR" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const FAKE_PRODUCT = {
  id: "up_test",
  slug: "test",
  niche: "beauty_wellness",
  storeContext: "fanaa",
  generationRunId: "run_mem_1",
  generatedAt: "2026-01-01T00:00:00.000Z",
  title: { ar: "ا", en: "Test" },
  description: { ar: "ا", en: "Desc" },
  benefits: [
    {
      icon: "Sparkles",
      title: { ar: "ا", en: "T" },
      body: { ar: "ا", en: "B" },
    },
  ],
  images: [{ src: "x", alt: { ar: "ا", en: "x" } }],
  reviews: [],
  faq: [],
  priceHint: { amount: 199, currency: "SAR" },
  hooks: [],
  sources: {
    supplierUrl: "https://supplier.example/p/1",
    scrapedAt: "2026-01-01T00:00:00.000Z",
    uploadedImages: [],
  },
} satisfies UniversalProduct;

describe("MemoryStore", () => {
  it("creates and retrieves a run by id", async () => {
    const s = new MemoryStore();
    const run = await s.createRun({
      runId: "run_mem_1",
      job: makeJob(),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(run.status).toBe("pending");
    const fetched = await s.getRun("run_mem_1");
    expect(fetched?.runId).toBe("run_mem_1");
  });

  it("aggregates totalCostUsd across cost rows", async () => {
    const s = new MemoryStore();
    await s.createRun({
      runId: "run_mem_2",
      job: makeJob({ runId: "run_mem_2" }),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s.appendCosts("run_mem_2", [
      { runId: "run_mem_2", stage: "strategy", capability: "text", providerId: "anthropic", costUsd: 0.04, latencyMs: 100, timestamp: "2026-01-01T00:00:00.000Z" },
      { runId: "run_mem_2", stage: "copy", capability: "text", providerId: "anthropic", costUsd: 0.08, latencyMs: 200, timestamp: "2026-01-01T00:00:00.000Z" },
    ]);
    const run = await s.getRun("run_mem_2");
    expect(run?.totalCostUsd).toBeCloseTo(0.12, 5);
  });

  it("transitions status pending -> running -> completed", async () => {
    const s = new MemoryStore();
    await s.createRun({
      runId: "run_mem_3",
      job: makeJob({ runId: "run_mem_3" }),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s.markRunStarted("run_mem_3");
    expect((await s.getRun("run_mem_3"))?.status).toBe("running");
    await s.markRunComplete("run_mem_3", FAKE_PRODUCT);
    const run = await s.getRun("run_mem_3");
    expect(run?.status).toBe("completed");
    expect(run?.finalProduct?.id).toBe("up_test");
  });

  it("listRuns returns most-recent-first and respects storeId filter", async () => {
    const s = new MemoryStore();
    await s.createRun({
      runId: "run_mem_4",
      job: makeJob({ runId: "run_mem_4", storeId: "fanaa" }),
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await s.createRun({
      runId: "run_mem_5",
      job: makeJob({ runId: "run_mem_5", storeId: "other_store" }),
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const all = await s.listRuns();
    expect(all.map((r) => r.runId)).toEqual(["run_mem_5", "run_mem_4"]);

    const fanaaOnly = await s.listRuns({ storeId: "fanaa" });
    expect(fanaaOnly.map((r) => r.runId)).toEqual(["run_mem_4"]);
  });

  it("throws when modifying a missing run", async () => {
    const s = new MemoryStore();
    await expect(s.markRunStarted("nope")).rejects.toThrow("run_not_found");
  });
});

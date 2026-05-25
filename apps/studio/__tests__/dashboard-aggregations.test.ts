import { describe, expect, it } from "vitest";

import type { DraftListItem } from "../lib/studio/drafts-service";
import type { ProductSummary } from "../lib/studio/product-loader";
import type { RunSummary } from "../lib/studio/run-loader";
import {
  formatHealthDuration,
  formatHealthPercent,
  pickAttentionDrafts,
  pickRecentPublishes,
  pickRecentRuns,
  pipelineHealth,
  summariseDrafts,
  summariseRuns,
  summarisePublishes,
} from "../lib/studio/dashboard-aggregations";

// ────────────────────────────────────────────────────────────────────────
// Fixtures — minimal, deterministic, no random data
// ────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-05-25T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function mkRun(
  partial: Partial<RunSummary> & Pick<RunSummary, "runId" | "status" | "createdAt">,
): RunSummary {
  return {
    storeId: "fanaa",
    supplierUrl: "https://example.com/p",
    totalCostUsd: 0,
    stepCount: 0,
    ...partial,
  };
}

function mkDraft(
  partial: Partial<DraftListItem> &
    Pick<DraftListItem, "id" | "status" | "updatedAt">,
): DraftListItem {
  return {
    storeId: "fanaa",
    slug: "p",
    title: "P",
    payloadVersion: 1,
    publishedAt: null,
    createdAt: partial.updatedAt,
    ...partial,
  };
}

function mkProduct(
  partial: Partial<ProductSummary> &
    Pick<ProductSummary, "productId" | "slug" | "publishedAt">,
): ProductSummary {
  return {
    storeId: "fanaa",
    title: { ar: "", en: partial.slug },
    niche: "",
    runId: "",
    hasFanaaExtension: false,
    heroImage: null,
    ...partial,
  };
}

// ────────────────────────────────────────────────────────────────────────
// summariseRuns
// ────────────────────────────────────────────────────────────────────────

describe("summariseRuns", () => {
  it("buckets runs by status inside the 24h window", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "r1", status: "completed", createdAt: iso(NOW, -2 * HOUR) }),
      mkRun({ runId: "r2", status: "completed", createdAt: iso(NOW, -23 * HOUR) }),
      mkRun({ runId: "r3", status: "failed", createdAt: iso(NOW, -5 * HOUR) }),
      mkRun({ runId: "r4", status: "running", createdAt: iso(NOW, -1 * HOUR) }),
      mkRun({ runId: "r5", status: "pending", createdAt: iso(NOW, -10 * 60 * 1000) }),
    ];
    expect(summariseRuns(runs, NOW)).toEqual({
      totalToday: 5,
      completedToday: 2,
      failedToday: 1,
      runningNow: 2,
    });
  });

  it("excludes runs created outside the 24h window from `totalToday`", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "r1", status: "completed", createdAt: iso(NOW, -25 * HOUR) }),
      mkRun({ runId: "r2", status: "completed", createdAt: iso(NOW, -2 * HOUR) }),
    ];
    expect(summariseRuns(runs, NOW).totalToday).toBe(1);
  });

  it("still surfaces long-running runs in `runningNow` even when they started >24h ago", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "r1", status: "running", createdAt: iso(NOW, -36 * HOUR) }),
    ];
    expect(summariseRuns(runs, NOW)).toMatchObject({
      runningNow: 1,
      totalToday: 0,
    });
  });

  it("treats corrupted runs as failures (NOT also as completed)", () => {
    const runs: RunSummary[] = [
      mkRun({
        runId: "r1",
        status: "completed",
        createdAt: iso(NOW, -1 * HOUR),
        corrupted: { reason: "invalid_step_log" },
      }),
    ];
    expect(summariseRuns(runs, NOW)).toMatchObject({
      totalToday: 1,
      failedToday: 1,
      completedToday: 0,
    });
    // The corrupted run lands in `failedToday` only, so
    // `completedToday + failedToday <= totalToday` stays an invariant
    // — important for the KPI chips that show both numbers next to
    // the same total.
  });

  it("returns all-zeros for an empty input", () => {
    expect(summariseRuns([], NOW)).toEqual({
      totalToday: 0,
      completedToday: 0,
      failedToday: 0,
      runningNow: 0,
    });
  });

  it("ignores unparseable createdAt strings", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "r1", status: "completed", createdAt: "garbage" }),
    ];
    expect(summariseRuns(runs, NOW).totalToday).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// summariseDrafts + pickAttentionDrafts
// ────────────────────────────────────────────────────────────────────────

describe("summariseDrafts", () => {
  it("aggregates statuses into the dashboard buckets", () => {
    // One draft per StudioDraftStatusValue — covers every branch of
    // `bucketStatus` exactly once. intake/generating/publishing all map
    // to `in_progress`, so that bucket lands at 3.
    const drafts: DraftListItem[] = [
      mkDraft({ id: "d1", status: "intake", updatedAt: iso(NOW, -1 * HOUR) }),
      mkDraft({ id: "d2", status: "generating", updatedAt: iso(NOW, -2 * HOUR) }),
      mkDraft({ id: "d3", status: "ready", updatedAt: iso(NOW, -3 * HOUR) }),
      mkDraft({ id: "d4", status: "publishing", updatedAt: iso(NOW, -4 * HOUR) }),
      mkDraft({ id: "d5", status: "published", updatedAt: iso(NOW, -5 * HOUR) }),
      mkDraft({ id: "d6", status: "archived", updatedAt: iso(NOW, -6 * HOUR) }),
      mkDraft({ id: "d7", status: "failed", updatedAt: iso(NOW, -7 * HOUR) }),
    ];
    expect(summariseDrafts(drafts)).toEqual({
      inProgress: 3,
      ready: 1,
      published: 1,
      archived: 1,
      failed: 1,
    });
  });

  it("returns zeros for an empty input", () => {
    expect(summariseDrafts([])).toEqual({
      inProgress: 0,
      ready: 0,
      published: 0,
      archived: 0,
      failed: 0,
    });
  });
});

describe("pickAttentionDrafts", () => {
  it("returns only ready + failed drafts, newest first", () => {
    const drafts: DraftListItem[] = [
      mkDraft({ id: "old-failed", status: "failed", updatedAt: iso(NOW, -10 * HOUR) }),
      mkDraft({ id: "new-ready", status: "ready", updatedAt: iso(NOW, -1 * HOUR) }),
      mkDraft({ id: "ignored", status: "published", updatedAt: iso(NOW, -2 * HOUR) }),
      mkDraft({ id: "mid", status: "ready", updatedAt: iso(NOW, -5 * HOUR) }),
    ];
    const picked = pickAttentionDrafts(drafts);
    expect(picked.map((d) => d.id)).toEqual(["new-ready", "mid", "old-failed"]);
  });

  it("respects the `take` argument", () => {
    const drafts: DraftListItem[] = [
      mkDraft({ id: "a", status: "ready", updatedAt: iso(NOW, -1 * HOUR) }),
      mkDraft({ id: "b", status: "ready", updatedAt: iso(NOW, -2 * HOUR) }),
      mkDraft({ id: "c", status: "ready", updatedAt: iso(NOW, -3 * HOUR) }),
    ];
    expect(pickAttentionDrafts(drafts, 2).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when nothing matches", () => {
    const drafts: DraftListItem[] = [
      mkDraft({ id: "x", status: "published", updatedAt: iso(NOW, -1 * HOUR) }),
    ];
    expect(pickAttentionDrafts(drafts)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────
// summarisePublishes + pickRecentPublishes
// ────────────────────────────────────────────────────────────────────────

describe("summarisePublishes", () => {
  it("counts live products and the 24h window", () => {
    const products: ProductSummary[] = [
      mkProduct({ productId: "p1", slug: "a", publishedAt: iso(NOW, -1 * HOUR), source: "db" }),
      mkProduct({ productId: "p2", slug: "b", publishedAt: iso(NOW, -25 * HOUR), source: "db" }),
      mkProduct({
        productId: "p3",
        slug: "c",
        publishedAt: iso(NOW, -1 * HOUR),
        source: "db",
        corrupted: { reason: "test" },
      }),
    ];
    expect(summarisePublishes(products, NOW)).toEqual({
      totalLive: 2,
      last24h: 1,
    });
  });

  it("ignores empty/unparseable publishedAt values", () => {
    const products: ProductSummary[] = [
      mkProduct({ productId: "p1", slug: "a", publishedAt: "", source: "db" }),
      mkProduct({ productId: "p2", slug: "b", publishedAt: "garbage", source: "db" }),
    ];
    expect(summarisePublishes(products, NOW)).toEqual({
      totalLive: 2,
      last24h: 0,
    });
  });
});

describe("pickRecentPublishes", () => {
  it("returns the newest non-corrupted products, capped at `take`", () => {
    const products: ProductSummary[] = [
      mkProduct({ productId: "p1", slug: "a", publishedAt: iso(NOW, -1 * HOUR), source: "db" }),
      mkProduct({ productId: "p2", slug: "b", publishedAt: iso(NOW, -2 * HOUR), source: "db" }),
      mkProduct({ productId: "p3", slug: "c", publishedAt: iso(NOW, -3 * HOUR), source: "db" }),
      mkProduct({
        productId: "p-corrupt",
        slug: "x",
        publishedAt: iso(NOW, -30 * 60 * 1000),
        source: "fs",
        corrupted: { reason: "bad" },
      }),
    ];
    const picked = pickRecentPublishes(products, 2);
    expect(picked.map((p) => p.productId)).toEqual(["p1", "p2"]);
  });

  it("filters out products with no publishedAt", () => {
    const products: ProductSummary[] = [
      mkProduct({ productId: "p1", slug: "a", publishedAt: "", source: "db" }),
    ];
    expect(pickRecentPublishes(products)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────
// pickRecentRuns
// ────────────────────────────────────────────────────────────────────────

describe("pickRecentRuns", () => {
  it("returns newest-first, capped at `take`, regardless of status", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "old", status: "completed", createdAt: iso(NOW, -10 * HOUR) }),
      mkRun({ runId: "mid", status: "failed", createdAt: iso(NOW, -2 * HOUR) }),
      mkRun({ runId: "new", status: "running", createdAt: iso(NOW, -10 * 60 * 1000) }),
    ];
    expect(pickRecentRuns(runs, 2).map((r) => r.runId)).toEqual(["new", "mid"]);
  });

  it("does not mutate the input array", () => {
    const runs: RunSummary[] = [
      mkRun({ runId: "a", status: "completed", createdAt: iso(NOW, -1 * HOUR) }),
      mkRun({ runId: "b", status: "completed", createdAt: iso(NOW, -2 * HOUR) }),
    ];
    const snapshot = runs.map((r) => r.runId);
    pickRecentRuns(runs);
    expect(runs.map((r) => r.runId)).toEqual(snapshot);
  });
});

// ────────────────────────────────────────────────────────────────────────
// pipelineHealth
// ────────────────────────────────────────────────────────────────────────

describe("pipelineHealth", () => {
  it("computes success rate over terminal runs only", () => {
    const runs: RunSummary[] = [
      mkRun({
        runId: "ok-1",
        status: "completed",
        createdAt: iso(NOW, -2 * HOUR),
        finishedAt: iso(NOW, -2 * HOUR + 60_000),
      }),
      mkRun({
        runId: "ok-2",
        status: "completed",
        createdAt: iso(NOW, -3 * HOUR),
        finishedAt: iso(NOW, -3 * HOUR + 120_000),
      }),
      mkRun({ runId: "fail-1", status: "failed", createdAt: iso(NOW, -4 * HOUR) }),
      mkRun({ runId: "running", status: "running", createdAt: iso(NOW, -5 * 60 * 1000) }),
      mkRun({ runId: "pending", status: "pending", createdAt: iso(NOW, -1 * 60 * 1000) }),
    ];
    const health = pipelineHealth(runs);
    expect(health.sampleSize).toBe(3); // running + pending excluded
    expect(health.successRate).toBeCloseTo(2 / 3, 5);
    expect(health.avgDurationMs).toBe((60_000 + 120_000) / 2);
  });

  it("treats corrupted completed runs as failures", () => {
    const runs: RunSummary[] = [
      mkRun({
        runId: "ok-1",
        status: "completed",
        createdAt: iso(NOW, -1 * HOUR),
        finishedAt: iso(NOW, -1 * HOUR + 60_000),
      }),
      mkRun({
        runId: "bad",
        status: "completed",
        createdAt: iso(NOW, -2 * HOUR),
        corrupted: { reason: "x" },
      }),
    ];
    const health = pipelineHealth(runs);
    expect(health.sampleSize).toBe(2);
    expect(health.successRate).toBe(0.5);
  });

  it("returns successRate=0 and avgDurationMs=null when the sample is empty", () => {
    expect(pipelineHealth([])).toEqual({
      successRate: 0,
      avgDurationMs: null,
      sampleSize: 0,
    });
  });

  it("respects the take window", () => {
    const runs: RunSummary[] = Array.from({ length: 30 }, (_, i) =>
      mkRun({
        runId: `r-${i}`,
        status: i < 5 ? "failed" : "completed",
        createdAt: iso(NOW, -(i + 1) * 60_000),
      }),
    );
    const health = pipelineHealth(runs, 10);
    expect(health.sampleSize).toBe(10);
    expect(health.successRate).toBe(0.5); // 5 newest are failed, 5 next are completed
  });
});

describe("formatHealthDuration", () => {
  it.each([
    [null, "—"],
    [0, "—"],
    [-1, "—"],
    [Number.NaN, "—"],
    [500, "1s"],          // < 1s rounds up at boundary; here 0.5s → 1s
    [1000, "1s"],
    [59_000, "59s"],
    [60_000, "1m 00s"],
    [61_000, "1m 01s"],
    [125_000, "2m 05s"],
  ])("formats %s → %s", (input, expected) => {
    expect(formatHealthDuration(input as number | null)).toBe(expected);
  });
});

describe("formatHealthPercent", () => {
  it("renders — when sample is empty", () => {
    expect(formatHealthPercent(0, 0)).toBe("—");
    expect(formatHealthPercent(1, 0)).toBe("—");
  });

  it("rounds to nearest integer percent", () => {
    expect(formatHealthPercent(0.667, 3)).toBe("67%");
    expect(formatHealthPercent(1, 10)).toBe("100%");
    expect(formatHealthPercent(0, 10)).toBe("0%");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Helpers (test-only)
// ────────────────────────────────────────────────────────────────────────

function iso(reference: Date, offsetMs: number): string {
  return new Date(reference.getTime() + offsetMs).toISOString();
}

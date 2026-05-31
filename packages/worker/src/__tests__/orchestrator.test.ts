import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { MemoryStore } from "@platform/ingest";
import { runPipeline } from "../runtime/orchestrator";
import { emptyCatalog } from "../runtime/catalog-stub";
import { BufferSink, createLogger } from "../runtime/logger";
import { PIPELINE_STAGES } from "../runtime/types";
import { createMockBundle } from "./_helpers/mock-bundle";
import {
  fixtureCopy,
  fixtureCreativePrompts,
  fixtureIngestJob,
  fixtureSectionContent,
  fixtureSocialProof,
  fixtureStrategy,
  textResult,
} from "./_helpers/fixtures";

/**
 * The orchestrator tests exercise WORKER-LEVEL behavior:
 *
 *   • Happy path: all 11 M5 stages execute, in order, and the final
 *     UniversalProduct is persisted.
 *   • Cost aggregation: every provider call appends a CostRow tagged
 *     with the active stage. totalCostUsd matches the sum.
 *   • Retry semantics: a transient provider failure retries per policy
 *     and persists `attempts` on the StepRecord.
 *   • Logger context: every emit carries runId + storeId + stage.
 *
 * It does NOT re-test the M5 stages themselves — those have their own
 * suite. Worker tests trust the M5 contract and verify the M6 wiring.
 *
 * # The "double-retry" reality
 *
 * Each M5 text stage internally calls `runTextStage` which retries ONCE
 * on JSON-schema failures (2 calls per stage attempt). On TOP of that,
 * the M6 orchestrator retries the stage as a whole per the retry policy.
 * That means to force an orchestrator-level retry, the test must queue
 * TWO consecutive errors so the inner retry exhausts first, then the
 * stage throws PipelineError, then the outer policy retries.
 */

// Fast retry policy for tests — 0 ms backoff, identical structure to default.
const FAST_RETRY = {
  defaults: {
    provider_call: { maxAttempts: 3, backoffMs: () => 0 },
    sharp: { maxAttempts: 1, backoffMs: () => 0 },
    octokit: { maxAttempts: 1, backoffMs: () => 0 },
    assemble: { maxAttempts: 1, backoffMs: () => 0 },
  },
};

describe("runPipeline — happy path", () => {
  it("executes all 11 stages and persists a complete RunRecord", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      catalog: emptyCatalog,
    });

    expect(result.product).toBeDefined();
    expect(result.run.status).toBe("completed");
    expect(result.run.steps).toHaveLength(PIPELINE_STAGES.length);
    expect(result.run.steps.every((s) => s.status === "success")).toBe(true);
    expect(result.run.steps.map((s) => s.stage)).toEqual([...PIPELINE_STAGES]);
  });

  it("threads outputs through downstream stages (copy.title reaches the assembled product)", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
    });

    expect(result.product?.title.en).toBe("Glow Serum");
    expect(result.product?.title.ar).toBe("سيروم النور");
    expect(result.product?.hooks.length).toBeGreaterThan(0);
    expect(result.product?.images.length).toBeGreaterThan(0);
  });
});

describe("runPipeline — cost aggregation", () => {
  it("records one CostRow per provider call, sums into totalCostUsd, and tags each row with its stage", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
    });

    // 5 text + 1 vision + 1 scraper + 2 image = 9 provider calls.
    // (structure is deterministic — no provider call — Step 4 §4.3.)
    expect(result.run.costs.length).toBe(9);

    const stagesInCosts = new Set(result.run.costs.map((r) => r.stage));
    for (const stage of [
      "research",
      "vision",
      "strategy",
      "copy",
      "creative_prompts",
      "image_gen",
      "social_proof",
      "section_content",
    ]) {
      expect(stagesInCosts).toContain(stage);
    }
    // structure produces no cost row (deterministic).
    expect(stagesInCosts).not.toContain("structure");

    const expectedTotal = result.run.costs.reduce(
      (sum, r) => sum + r.costUsd,
      0,
    );
    expect(result.run.totalCostUsd).toBeCloseTo(expectedTotal, 5);
    expect(result.run.totalCostUsd).toBeGreaterThan(0);
  });

  it("tags each StepRecord.costUsd with the sum of that stage's CostRows", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
    });

    for (const step of result.run.steps) {
      const stageRows = result.run.costs.filter((r) => r.stage === step.stage);
      const stageSum = stageRows.reduce((sum, r) => sum + r.costUsd, 0);
      expect(step.costUsd).toBeCloseTo(stageSum, 5);
    }
  });
});

describe("runPipeline — retry semantics", () => {
  it("retries a transient provider failure once and records attempts=2", async () => {
    const bundle = createMockBundle();
    // Strategy's inner runTextStage burns 2 calls before throwing
    // PipelineError. That triggers the M6 orchestrator's outer retry,
    // which re-runs the stage; this time the inner call succeeds.
    bundle.text.setResponses([
      new Error("transient_a"), // strategy attempt 1, inner 1
      new Error("transient_b"), // strategy attempt 1, inner 2 → stage throws
      textResult(fixtureStrategy), // strategy attempt 2, inner 1 → success
      // structure: deterministic, no text call.
      textResult(fixtureCopy),
      textResult(fixtureCreativePrompts),
      textResult(fixtureSocialProof),
      textResult(fixtureSectionContent),
    ]);

    const store = new MemoryStore();
    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      retryPolicy: FAST_RETRY,
    });

    expect(result.run.status).toBe("completed");
    const strategyStep = result.run.steps.find((s) => s.stage === "strategy");
    expect(strategyStep?.status).toBe("success");
    expect(strategyStep?.attempts).toBe(2);
  });

  it("fails the run after retries are exhausted and persists the failed step", async () => {
    const bundle = createMockBundle();
    // 2 errors per orchestrator attempt × 2 attempts = 4 errors total.
    bundle.text.setResponses([
      new Error("transient_a"),
      new Error("transient_b"),
      new Error("transient_c"),
      new Error("transient_d"),
    ]);

    const store = new MemoryStore();
    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      retryPolicy: {
        defaults: {
          provider_call: { maxAttempts: 2, backoffMs: () => 0 },
          sharp: { maxAttempts: 1, backoffMs: () => 0 },
          octokit: { maxAttempts: 1, backoffMs: () => 0 },
          assemble: { maxAttempts: 1, backoffMs: () => 0 },
        },
      },
    });

    expect(result.run.status).toBe("failed");
    expect(result.product).toBeUndefined();
    const failedStep = result.run.steps.find((s) => s.status === "failed");
    expect(failedStep?.stage).toBe("strategy");
    expect(failedStep?.attempts).toBe(2);
    expect(result.run.errorMessage).toContain("strategy");
  });
});

describe("runPipeline — logger", () => {
  it("emits structured JSON with runId + storeId on every event and stage tags on per-stage events", async () => {
    const sink = new BufferSink();
    const logger = createLogger({ sink: sink.write, minLevel: "info" });
    const bundle = createMockBundle();
    const store = new MemoryStore();

    await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      logger,
    });

    const events = sink.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(events.length).toBeGreaterThan(0);

    for (const ev of events) {
      const ctx = ev.context as Record<string, unknown>;
      expect(ctx.runId).toBe(fixtureIngestJob.runId);
      expect(ctx.storeId).toBe(fixtureIngestJob.storeId);
    }

    const stagesSeen = new Set(
      events
        .map((ev) => (ev.context as Record<string, unknown>).stage)
        .filter((s): s is string => typeof s === "string"),
    );
    for (const stage of PIPELINE_STAGES) {
      expect(stagesSeen).toContain(stage);
    }
  });
});

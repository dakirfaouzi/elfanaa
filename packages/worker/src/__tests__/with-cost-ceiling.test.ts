import { describe, expect, it, vi } from "vitest";
import { fanaaStore } from "@platform/stores";
import { MemoryStore } from "@platform/ingest";
import {
  withCostCeiling,
  type WithCostCeilingOptions,
} from "../middleware";
import {
  CostCeilingExceededError,
  type StepRecordedContext,
} from "../runtime/types";
import { runPipeline } from "../runtime/orchestrator";
import { emptyCatalog } from "../runtime/catalog-stub";
import { createMockBundle } from "./_helpers/mock-bundle";
import { fixtureIngestJob } from "./_helpers/fixtures";

/**
 * Tests for the M9 cost-ceiling middleware.
 *
 * Split into two suites:
 *
 *   1. Unit — drive the hook with synthetic StepRecordedContext values
 *      to verify predicate semantics in isolation.
 *   2. Integration — drive the orchestrator with the middleware
 *      attached + force expensive cost rows to verify the abort
 *      propagates through to `run.status === "failed"` with the
 *      stable `cost_exceeded:` marker.
 */

function ctx(
  overrides: Partial<StepRecordedContext> = {},
): StepRecordedContext {
  return {
    runId: "run_test",
    stage: "research",
    status: "success",
    stageCostUsd: 0.1,
    totalCostUsd: 0.5,
    costCeilingUsd: 5,
    ...overrides,
  };
}

const FAST_RETRY = {
  defaults: {
    provider_call: { maxAttempts: 3, backoffMs: () => 0 },
    sharp: { maxAttempts: 1, backoffMs: () => 0 },
    octokit: { maxAttempts: 1, backoffMs: () => 0 },
    assemble: { maxAttempts: 1, backoffMs: () => 0 },
  },
};

describe("withCostCeiling — unit", () => {
  const makeOpts = (over: Partial<WithCostCeilingOptions> = {}) => ({
    storeConfig: fanaaStore,
    ...over,
  });

  it("returns void when totalCostUsd is below the ceiling", async () => {
    const hook = withCostCeiling(makeOpts());
    await expect(hook(ctx({ totalCostUsd: 4.99 }))).resolves.toBeUndefined();
  });

  it("returns void when totalCostUsd lands EXACTLY on the ceiling (`>`-not-`>=`)", async () => {
    const hook = withCostCeiling(makeOpts());
    // fanaaStore.costCeilingPerDraftUsd === 5
    await expect(hook(ctx({ totalCostUsd: 5 }))).resolves.toBeUndefined();
  });

  it("throws CostCeilingExceededError when totalCostUsd crosses the ceiling", async () => {
    const hook = withCostCeiling(makeOpts());
    await expect(hook(ctx({ totalCostUsd: 5.0001 }))).rejects.toBeInstanceOf(
      CostCeilingExceededError,
    );
  });

  it("error message starts with the stable `cost_exceeded:` marker", async () => {
    const hook = withCostCeiling(makeOpts());
    try {
      await hook(ctx({ totalCostUsd: 99 }));
      expect.fail("expected hook to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CostCeilingExceededError);
      expect((err as Error).message.startsWith("cost_exceeded:")).toBe(true);
    }
  });

  it("uses an explicit ceilingUsd override when supplied", async () => {
    const hook = withCostCeiling(makeOpts({ ceilingUsd: 0.5 }));
    await expect(hook(ctx({ totalCostUsd: 0.51 }))).rejects.toBeInstanceOf(
      CostCeilingExceededError,
    );
    const lenient = withCostCeiling(makeOpts({ ceilingUsd: 100 }));
    await expect(lenient(ctx({ totalCostUsd: 1 }))).resolves.toBeUndefined();
  });

  it("rejects non-positive / non-finite ceiling values at construction", () => {
    expect(() => withCostCeiling(makeOpts({ ceilingUsd: 0 }))).toThrow(
      /withCostCeiling_invalid_ceiling/,
    );
    expect(() => withCostCeiling(makeOpts({ ceilingUsd: -1 }))).toThrow(
      /withCostCeiling_invalid_ceiling/,
    );
    expect(() =>
      withCostCeiling(makeOpts({ ceilingUsd: Number.POSITIVE_INFINITY })),
    ).toThrow(/withCostCeiling_invalid_ceiling/);
  });

  it("calls the inner hook AFTER a passing ceiling check", async () => {
    const inner = vi.fn();
    const hook = withCostCeiling(makeOpts({ inner }));
    await hook(ctx({ totalCostUsd: 1 }));
    expect(inner).toHaveBeenCalledOnce();
    expect(inner.mock.calls[0][0].totalCostUsd).toBe(1);
  });

  it("does NOT call the inner hook when the ceiling check fails", async () => {
    const inner = vi.fn();
    const hook = withCostCeiling(makeOpts({ inner }));
    await expect(hook(ctx({ totalCostUsd: 99 }))).rejects.toBeInstanceOf(
      CostCeilingExceededError,
    );
    expect(inner).not.toHaveBeenCalled();
  });
});

describe("withCostCeiling — orchestrator integration", () => {
  it("happy path: pipeline completes when total cost stays under ceiling", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      catalog: emptyCatalog,
      retryPolicy: FAST_RETRY,
      onStepRecorded: withCostCeiling({ storeConfig: fanaaStore }),
    });

    expect(result.run.status).toBe("completed");
    expect(result.run.errorMessage).toBeUndefined();
  });

  it("aborts the run with `cost_exceeded:` when the cumulative cost crosses a tight ceiling", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    // Synthetic ultra-tight ceiling so the first provider call trips it.
    // The mock bundle's text/vision/scraper/image calls each cost > 0 USD,
    // so a $0.0001 cap is guaranteed to abort on stage 1 (research).
    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      catalog: emptyCatalog,
      retryPolicy: FAST_RETRY,
      onStepRecorded: withCostCeiling({
        storeConfig: fanaaStore,
        ceilingUsd: 0.0001,
      }),
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.errorMessage).toBeDefined();
    expect(result.run.errorMessage?.startsWith("cost_exceeded:")).toBe(true);
    // Aborted after the first step, so far fewer than 11 stages ran.
    expect(result.run.steps.length).toBeLessThan(11);
    // No final product on an aborted run.
    expect(result.product).toBeUndefined();
  });

  it("a hook error other than CostCeilingExceededError surfaces as `onStepRecorded_threw:`", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    const result = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      catalog: emptyCatalog,
      retryPolicy: FAST_RETRY,
      onStepRecorded: async () => {
        throw new Error("unexpected_hook_failure");
      },
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.errorMessage).toContain("onStepRecorded_threw:");
    expect(result.run.errorMessage).toContain("unexpected_hook_failure");
  });
});

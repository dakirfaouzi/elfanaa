import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { MemoryStore } from "@platform/ingest";
import { runPipeline } from "../runtime/orchestrator";
import { replayRun } from "../replay";
import { createMockBundle } from "./_helpers/mock-bundle";
import {
  fixtureCopy,
  fixtureCreativePrompts,
  fixtureIngestJob,
  fixtureSocialProof,
  fixtureStrategy,
  fixtureStructureModelResponse,
  textResult,
} from "./_helpers/fixtures";

/**
 * Deterministic-replay tests (PLATFORM.md §15 "Replay").
 *
 * Two scenarios:
 *   • Replay from a failed stage — earlier successful steps must be
 *     reused (no provider calls for them).
 *   • Replay an already-complete run — no work performed, original
 *     final product returned.
 */

const FAST_RETRY = {
  defaults: {
    provider_call: { maxAttempts: 1, backoffMs: () => 0 },
    sharp: { maxAttempts: 1, backoffMs: () => 0 },
    octokit: { maxAttempts: 1, backoffMs: () => 0 },
    assemble: { maxAttempts: 1, backoffMs: () => 0 },
  },
};

describe("replayRun", () => {
  it("resumes from the first failed stage, reusing persisted outputs from earlier stages", async () => {
    // ── First run: succeed up through 'structure' (3 stages of text +
    // research + vision), then fail at 'copy' by exhausting the text
    // provider's response queue.
    const failing = createMockBundle();
    failing.text.setResponses([
      textResult(fixtureStrategy),           // strategy succeeds
      textResult(fixtureStructureModelResponse), // structure succeeds
      // copy: queue exhausted → mockText throws → strategy stage retries
      // exhaust (maxAttempts=1) → orchestrator records 'copy' as failed.
    ]);

    const store = new MemoryStore();
    const firstResult = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: failing.providers,
      store,
      retryPolicy: FAST_RETRY,
    });

    expect(firstResult.run.status).toBe("failed");
    const firstSuccessfulStages = firstResult.run.steps
      .filter((s) => s.status === "success")
      .map((s) => s.stage);
    expect(firstSuccessfulStages).toContain("research");
    expect(firstSuccessfulStages).toContain("vision");
    expect(firstSuccessfulStages).toContain("strategy");
    expect(firstSuccessfulStages).toContain("structure");
    expect(firstSuccessfulStages).not.toContain("copy");

    // Snapshot counts of provider calls made during the first run.
    const firstTextCalls = failing.text.calls.length;
    const firstVisionCalls = failing.vision.calls.length;
    const firstScraperCalls = failing.scraper.calls.length;
    const firstImageCalls = failing.image.calls.length;

    // ── Second run (replay): fresh providers, only 'copy' onward
    // should consume responses.
    const replayBundle = createMockBundle();
    replayBundle.text.setResponses([
      // The orchestrator hydrates strategy + structure from persisted
      // RunRecord, so copy is the first text call.
      textResult(fixtureCopy),
      textResult(fixtureCreativePrompts),
      textResult(fixtureSocialProof),
    ]);

    const replayResult = await replayRun({
      runId: fixtureIngestJob.runId,
      storeConfig: fanaaStore,
      providers: replayBundle.providers,
      store,
      retryPolicy: FAST_RETRY,
    });

    expect(replayResult.run.status).toBe("completed");
    expect(replayResult.product).toBeDefined();

    // Replay should NOT have re-called any provider for already-
    // successful stages. Scraper/vision were done in run 1.
    expect(replayBundle.scraper.calls.length).toBe(0);
    expect(replayBundle.vision.calls.length).toBe(0);
    // Text calls during replay = 3 (copy + creative_prompts + social_proof).
    expect(replayBundle.text.calls.length).toBe(3);
    // Image gen was not done in run 1, so it runs now.
    expect(replayBundle.image.calls.length).toBeGreaterThan(0);

    // Verify the original failing-run counters didn't change.
    expect(failing.text.calls.length).toBe(firstTextCalls);
    expect(failing.vision.calls.length).toBe(firstVisionCalls);
    expect(failing.scraper.calls.length).toBe(firstScraperCalls);
    expect(failing.image.calls.length).toBe(firstImageCalls);
  });

  it("returns the existing product when every stage already succeeded", async () => {
    // Run once to completion.
    const bundle = createMockBundle();
    const store = new MemoryStore();
    const first = await runPipeline({
      job: fixtureIngestJob,
      storeConfig: fanaaStore,
      providers: bundle.providers,
      store,
      retryPolicy: FAST_RETRY,
    });
    expect(first.run.status).toBe("completed");

    // Replay with a fresh (empty) provider bundle. Should not touch any
    // provider because every stage is already complete.
    const fresh = createMockBundle();
    fresh.text.setResponses([]);
    fresh.vision.setResponses([]);
    fresh.scraper.setResponses([]);
    fresh.image.setResponses([]);

    const replay = await replayRun({
      runId: fixtureIngestJob.runId,
      storeConfig: fanaaStore,
      providers: fresh.providers,
      store,
      retryPolicy: FAST_RETRY,
    });

    expect(replay.run.status).toBe("completed");
    expect(replay.product).toBeDefined();
    expect(replay.product?.title.en).toBe(first.product?.title.en);
    expect(fresh.text.calls.length).toBe(0);
    expect(fresh.vision.calls.length).toBe(0);
    expect(fresh.scraper.calls.length).toBe(0);
    expect(fresh.image.calls.length).toBe(0);
  });

  it("throws when the run id does not exist in the store", async () => {
    const bundle = createMockBundle();
    const store = new MemoryStore();

    await expect(
      replayRun({
        runId: "nope_does_not_exist",
        storeConfig: fanaaStore,
        providers: bundle.providers,
        store,
        retryPolicy: FAST_RETRY,
      }),
    ).rejects.toThrow("run_not_found");
  });
});

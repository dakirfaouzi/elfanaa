import { describe, expect, it } from "vitest";
import {
  wrapImageWithCost,
  wrapScraperWithCost,
  wrapTextWithCost,
  wrapVisionWithCost,
} from "../provider-wiring/cost-recorder";
import type { CostRow } from "@platform/ingest";
import { createMockBundle } from "./_helpers/mock-bundle";
import { textResult, visionResult } from "./_helpers/fixtures";

/**
 * Verifies the CostRecorder decorators:
 *   • Each capability records one row per call.
 *   • Rows carry the correct capability + providerId.
 *   • `getStage()` is read at call time (mutating the closure between
 *     calls re-tags subsequent rows).
 */

describe("cost-recorder", () => {
  it("text wrapper records one row per call with capability='text'", async () => {
    const bundle = createMockBundle();
    const rows: CostRow[] = [];
    let stage = "init";
    const wrapped = wrapTextWithCost(bundle.providers.text, {
      runId: "run_cr_1",
      getStage: () => stage,
      push: (row) => rows.push(row),
    });

    stage = "strategy";
    await wrapped.generate({
      system: "s",
      prompt: "p",
      storeId: "fanaa",
      runId: "run_cr_1",
    });

    stage = "copy";
    await wrapped.generate({
      system: "s",
      prompt: "p",
      storeId: "fanaa",
      runId: "run_cr_1",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.capability).toBe("text");
    expect(rows[0]?.stage).toBe("strategy");
    expect(rows[0]?.providerId).toBe("anthropic");
    expect(rows[0]?.costUsd).toBeGreaterThan(0);
    expect(rows[1]?.stage).toBe("copy");
  });

  it("vision wrapper records one row per call with capability='vision'", async () => {
    const bundle = createMockBundle();
    const rows: CostRow[] = [];
    const wrapped = wrapVisionWithCost(bundle.providers.vision, {
      runId: "run_cr_2",
      getStage: () => "vision",
      push: (row) => rows.push(row),
    });

    await wrapped.analyze({
      images: [{ src: "https://x" }],
      instructions: "go",
      storeId: "fanaa",
      runId: "run_cr_2",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.capability).toBe("vision");
    expect(rows[0]?.stage).toBe("vision");
  });

  it("image wrapper records one row per call with capability='image' and preserves the cost knob", async () => {
    const bundle = createMockBundle({ perImageUsd: 0.07 });
    const rows: CostRow[] = [];
    const wrapped = wrapImageWithCost(bundle.providers.image, {
      runId: "run_cr_3",
      getStage: () => "image_gen",
      push: (row) => rows.push(row),
    });

    // The wrapper must preserve the readonly `cost` budget so callers
    // can pre-flight a cost ceiling check.
    expect(wrapped.cost.perImageUsd).toBe(0.07);

    await wrapped.generate({
      prompt: "p",
      size: { w: 1024, h: 1024 },
      storeId: "fanaa",
      runId: "run_cr_3",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.capability).toBe("image");
    expect(rows[0]?.stage).toBe("image_gen");
  });

  it("scraper wrapper records one row per call with capability='scraper'", async () => {
    const bundle = createMockBundle();
    const rows: CostRow[] = [];
    const wrapped = wrapScraperWithCost(bundle.providers.scraper, {
      runId: "run_cr_4",
      getStage: () => "research",
      push: (row) => rows.push(row),
    });

    await wrapped.fetch("https://example.com");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.capability).toBe("scraper");
    expect(rows[0]?.providerId).toBe("firecrawl");
  });

  it("does NOT record a row when the underlying provider throws", async () => {
    const bundle = createMockBundle();
    bundle.text.setResponses([new Error("boom")]);
    const rows: CostRow[] = [];
    const wrapped = wrapTextWithCost(bundle.providers.text, {
      runId: "run_cr_5",
      getStage: () => "strategy",
      push: (row) => rows.push(row),
    });

    await expect(
      wrapped.generate({
        system: "s",
        prompt: "p",
        storeId: "fanaa",
        runId: "run_cr_5",
      }),
    ).rejects.toThrow("boom");

    expect(rows).toHaveLength(0);
  });

  // Ensure imports compile even if some helpers aren't yet exercised in
  // this file — keeps fixtures/exports in sync without dead-code rot.
  void textResult;
  void visionResult;
});

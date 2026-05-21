import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { vision } from "../vision";
import {
  mockVision,
  visionResult,
} from "./_helpers/mock-providers";

describe("vision (stage 03)", () => {
  it("returns a valid output when the model parses successfully", async () => {
    const v = mockVision({
      responses: [
        visionResult({
          productCategory: "face serum",
          formFactor: "amber glass dropper, 30ml",
          visibleColors: ["#3B2A1E", "#C7A27C"],
          packagingMaterial: "amber glass",
          visualHooks: ["amber glass dropper", "minimalist label"],
          confidence: 0.8,
        }),
      ],
    });

    const out = await vision({
      input: { images: [{ src: "https://test/img.jpg" }] },
      providers: { vision: v.provider },
      storeConfig: fanaaStore,
      runId: "run_test_vision_1",
    });

    expect(out.skipped).toBe(false);
    expect(out.productCategory).toBe("face serum");
    expect(out.visualHooks).toEqual([
      "amber glass dropper",
      "minimalist label",
    ]);
    expect(out.confidence).toBe(0.8);
    expect(v.calls).toHaveLength(1);
  });

  it("returns skipped=true when no images are provided (no provider call)", async () => {
    const v = mockVision();

    const out = await vision({
      input: { images: [] },
      providers: { vision: v.provider },
      storeConfig: fanaaStore,
      runId: "run_test_vision_2",
    });

    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("no_images_provided");
    expect(v.calls).toHaveLength(0);
  });

  it("retries once with a higher temperature on first failure", async () => {
    const v = mockVision({
      responses: [
        new Error("transient_error"),
        visionResult({ productCategory: "hair oil", confidence: 0.7 }),
      ],
    });

    const out = await vision({
      input: { images: [{ src: "https://test/img.jpg" }] },
      providers: { vision: v.provider },
      storeConfig: fanaaStore,
      runId: "run_test_vision_3",
    });

    expect(out.skipped).toBe(false);
    expect(out.productCategory).toBe("hair oil");
    expect(v.calls).toHaveLength(2);
    expect(v.calls[1].temperature).toBeGreaterThan(v.calls[0].temperature ?? 0);
  });

  it("returns skipped=true (does NOT throw) when both retries fail", async () => {
    const v = mockVision({
      responses: [new Error("a"), new Error("b")],
    });

    const out = await vision({
      input: { images: [{ src: "https://test/img.jpg" }] },
      providers: { vision: v.provider },
      storeConfig: fanaaStore,
      runId: "run_test_vision_4",
    });

    expect(out.skipped).toBe(true);
    expect(out.skipReason).toContain("vision_failed");
    expect(v.calls).toHaveLength(2);
  });
});

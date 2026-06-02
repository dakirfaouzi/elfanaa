import { describe, expect, it } from "vitest";
import {
  assessImage,
  buildImageQaInstructions,
  classifyQa,
  type ImageQaResponse,
} from "../image-qa";
import { mockVision, visionResult } from "./_helpers/mock-providers";

const clean: ImageQaResponse = {
  blackOrBlank: false,
  productVisible: true,
  productMatchesReference: true,
  assetTypeCorrect: true,
  productScaleRealistic: true,
  placementRealistic: true,
  anatomyRealistic: true,
};

describe("classifyQa (Phase 4.6.4d severity gate)", () => {
  it("passes a clean image", () => {
    expect(classifyQa(clean, true)).toEqual({ verdict: "pass", severity: "none" });
  });

  it("HARD-fails a black/blank image", () => {
    expect(classifyQa({ ...clean, blackOrBlank: true }, true)).toEqual({
      verdict: "regenerate",
      severity: "hard",
    });
  });

  it("HARD-fails an absent product", () => {
    expect(classifyQa({ ...clean, productVisible: false }, true)).toEqual({
      verdict: "regenerate",
      severity: "hard",
    });
  });

  it("HARD-fails a wrong/substituted product ONLY when a reference exists", () => {
    const wrong = { ...clean, productMatchesReference: false };
    expect(classifyQa(wrong, true).severity).toBe("hard");
    // Without a reference the identity criterion is ignored.
    expect(classifyQa(wrong, false)).toEqual({ verdict: "pass", severity: "none" });
  });

  it("SOFT-fails off-type / unrealistic scale / placement / anatomy", () => {
    expect(classifyQa({ ...clean, assetTypeCorrect: false }, true).severity).toBe("soft");
    expect(classifyQa({ ...clean, productScaleRealistic: false }, true).severity).toBe("soft");
    expect(classifyQa({ ...clean, placementRealistic: false }, true).severity).toBe("soft");
    expect(classifyQa({ ...clean, anatomyRealistic: false }, true).severity).toBe("soft");
  });
});

describe("buildImageQaInstructions", () => {
  it("demands NO model for an ingredient macro", () => {
    const i = buildImageQaInstructions({ intent: "ingredient", role: "lifestyle", hasReference: true });
    expect(i).toMatch(/INGREDIENT MACRO/i);
    expect(i).toMatch(/NO model/i);
    expect(i).toMatch(/IMAGE 2/); // reference comparison wording
  });

  it("describes the application contract for mechanism", () => {
    const i = buildImageQaInstructions({ intent: "mechanism", role: "lifestyle", hasReference: false });
    expect(i).toMatch(/APPLICATION close-up/i);
    expect(i).not.toMatch(/productMatchesReference/); // no reference → criterion omitted
  });
});

describe("assessImage (fail-open)", () => {
  it("returns a regenerate verdict from the vision model", async () => {
    const v = mockVision({
      responses: [visionResult<ImageQaResponse>({ ...clean, assetTypeCorrect: false, feedback: "make it a macro" })],
    });
    const verdict = await assessImage({
      provider: v.provider,
      imageUrl: "https://cdn.mock/x.webp",
      referenceUrl: "https://cdn.mock/ref.webp",
      intent: "ingredient",
      role: "lifestyle",
      storeId: "fanaa",
      runId: "run_qa_1",
    });
    expect(verdict.verdict).toBe("regenerate");
    expect(verdict.severity).toBe("soft");
    expect(verdict.feedback).toBe("make it a macro");
  });

  it("fails OPEN (verdict=pass) when the vision provider throws", async () => {
    const v = mockVision({ responses: [new Error("vision_down")] });
    const verdict = await assessImage({
      provider: v.provider,
      imageUrl: "https://cdn.mock/x.webp",
      role: "lifestyle",
      storeId: "fanaa",
      runId: "run_qa_2",
    });
    expect(verdict.verdict).toBe("pass");
  });
});

import { describe, expect, it } from "vitest";
import { isFalImageSafetyFiltered } from "../fal";

describe("isFalImageSafetyFiltered (Phase 4.6.4b black-frame guard)", () => {
  it("flags an image when the safety checker tripped (would be a black frame)", () => {
    expect(isFalImageSafetyFiltered({ has_nsfw_concepts: [true] })).toBe(true);
  });

  it("does not flag a clean image", () => {
    expect(isFalImageSafetyFiltered({ has_nsfw_concepts: [false] })).toBe(false);
  });

  it("does not flag when the field is absent (older models / no checker)", () => {
    expect(isFalImageSafetyFiltered({})).toBe(false);
    expect(isFalImageSafetyFiltered({ has_nsfw_concepts: [] })).toBe(false);
  });
});

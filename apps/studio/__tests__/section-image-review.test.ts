import { describe, it, expect } from "vitest";
import { reducer, initialState } from "@platform/builder-state";
import type { DraftDocument } from "@platform/builder-schema";
import { DraftDocumentSchema } from "@platform/builder-schema";
import {
  collectReviewKeys,
  getReviewedKeys,
  heroReviewKey,
  reviewProgress,
  sceneReviewKey,
} from "../lib/studio/section-image-review";

/**
 * Sprint 3 — Image QA Workflow. The reviewed state must (a) use the same key
 * scheme everywhere, (b) round-trip through the draft schema (so it survives
 * autosave + publish), and (c) toggle without history churn when unchanged.
 */

function makeDoc(): DraftDocument {
  return {
    version: 1,
    meta: { title: { en: "Test" }, slug: "test-product" },
    sections: [
      {
        id: "hero1",
        kind: "hero",
        enabled: true,
        title: { en: "Hero" },
        media: { kind: "image", desktopSrc: "r2://hero.jpg" },
        align: "center",
      },
    ],
    croContent: {
      images: [{ src: "r2://packshot.jpg" }],
      lifestyleImages: [{ src: "r2://a.jpg" }, { src: "r2://b.jpg" }],
    },
  } as unknown as DraftDocument;
}

describe("section-image-review keys", () => {
  it("lists hero first, then each scene", () => {
    expect(collectReviewKeys(makeDoc())).toEqual([
      heroReviewKey("hero1"),
      sceneReviewKey(0),
      sceneReviewKey(1),
    ]);
  });

  it("reports total = hero + scenes", () => {
    expect(reviewProgress(makeDoc())).toEqual({ reviewed: 0, total: 3 });
  });

  it("tolerates a missing croContent / review bag", () => {
    expect(getReviewedKeys(undefined).size).toBe(0);
    expect(getReviewedKeys({}).size).toBe(0);
    expect(getReviewedKeys({ __review: { reviewedKeys: ["x", 1, null] } }).size).toBe(1);
  });
});

describe("SET_IMAGE_REVIEWED reducer", () => {
  it("adds and removes a key in croContent.__review", () => {
    let state = initialState(makeDoc());

    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: sceneReviewKey(0),
      reviewed: true,
    });
    expect(getReviewedKeys(state.document.croContent).has("scene:0")).toBe(true);
    expect(reviewProgress(state.document).reviewed).toBe(1);

    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: sceneReviewKey(0),
      reviewed: false,
    });
    expect(getReviewedKeys(state.document.croContent).has("scene:0")).toBe(false);
    expect(reviewProgress(state.document).reviewed).toBe(0);
  });

  it("is a no-op (no version bump) when already in the desired state", () => {
    let state = initialState(makeDoc());
    const v0 = state.documentVersion;
    // Toggling OFF something already off does nothing.
    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: heroReviewKey("hero1"),
      reviewed: false,
    });
    expect(state.documentVersion).toBe(v0);

    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: heroReviewKey("hero1"),
      reviewed: true,
    });
    const v1 = state.documentVersion;
    expect(v1).toBeGreaterThan(v0);
    // Re-marking ON the same key is also a no-op.
    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: heroReviewKey("hero1"),
      reviewed: true,
    });
    expect(state.documentVersion).toBe(v1);
  });

  it("survives the draft schema parse (autosave + publish round-trip)", () => {
    let state = initialState(makeDoc());
    state = reducer(state, {
      type: "SET_IMAGE_REVIEWED",
      key: heroReviewKey("hero1"),
      reviewed: true,
    });
    const parsed = DraftDocumentSchema.safeParse(state.document);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(getReviewedKeys(parsed.data.croContent).has("hero:hero1")).toBe(true);
    }
  });
});

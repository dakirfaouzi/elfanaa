import { describe, expect, it } from "vitest";
import { makeBlankDraft, makeBlankSection } from "@platform/builder-schema";
import { reducer } from "../reducer";
import { initialState, canUndo, canRedo, isDirty } from "../state";

let counter = 0;
const id = () => `sec_${++counter}`;

function freshState() {
  counter = 0;
  const doc = makeBlankDraft({
    slug: "glow-serum",
    title: { en: "Glow Serum" },
    newId: id,
  });
  return initialState(doc);
}

describe("reducer — section list", () => {
  it("ADD_SECTION appends when no afterId", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "ADD_SECTION",
      kind: "faq",
      section: makeBlankSection("faq", id),
    });
    expect(next.document.sections.length).toBe(3);
    expect(next.document.sections[2].kind).toBe("faq");
    expect(next.documentVersion).toBe(1);
  });

  it("ADD_SECTION inserts after the given id", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const next = reducer(state, {
      type: "ADD_SECTION",
      kind: "faq",
      afterId: hero.id,
      section: makeBlankSection("faq", id),
    });
    expect(next.document.sections[1].kind).toBe("faq");
  });

  it("DELETE_SECTION removes by id and is reflected in history", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const next = reducer(state, {
      type: "DELETE_SECTION",
      sectionId: hero.id,
    });
    expect(next.document.sections.length).toBe(1);
    expect(canUndo(next)).toBe(true);
  });

  it("DELETE_SECTION is a no-op for unknown id", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "DELETE_SECTION",
      sectionId: "ghost",
    });
    expect(next).toBe(state);
  });

  it("MOVE_SECTION up/down swaps positions", () => {
    const state = freshState();
    const cta = state.document.sections[1];
    const moved = reducer(state, {
      type: "MOVE_SECTION",
      sectionId: cta.id,
      direction: "up",
    });
    expect(moved.document.sections[0].id).toBe(cta.id);
    const back = reducer(moved, {
      type: "MOVE_SECTION",
      sectionId: cta.id,
      direction: "down",
    });
    expect(back.document.sections[1].id).toBe(cta.id);
  });

  it("MOVE_SECTION at the edge is a no-op", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const next = reducer(state, {
      type: "MOVE_SECTION",
      sectionId: hero.id,
      direction: "up",
    });
    expect(next).toBe(state);
  });

  it("REORDER_SECTIONS reorders by the supplied id list", () => {
    const state = freshState();
    const [hero, cta] = state.document.sections;
    const next = reducer(state, {
      type: "REORDER_SECTIONS",
      orderedIds: [cta.id, hero.id],
    });
    expect(next.document.sections.map((s) => s.id)).toEqual([cta.id, hero.id]);
  });

  it("DUPLICATE_SECTION inserts the new section immediately after the source", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const dup = makeBlankSection("hero", id);
    const next = reducer(state, {
      type: "DUPLICATE_SECTION",
      sectionId: hero.id,
      newSection: dup,
    });
    expect(next.document.sections[1].id).toBe(dup.id);
    expect(next.document.sections[1].kind).toBe("hero");
  });

  it("TOGGLE_SECTION flips the enabled flag", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const off = reducer(state, { type: "TOGGLE_SECTION", sectionId: hero.id });
    expect(off.document.sections[0].enabled).toBe(false);
    const on = reducer(off, {
      type: "TOGGLE_SECTION",
      sectionId: hero.id,
      enabled: true,
    });
    expect(on.document.sections[0].enabled).toBe(true);
  });
});

describe("reducer — meta", () => {
  it("UPDATE_META shallow-merges", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "UPDATE_META",
      meta: { keywords: ["serum", "skin"] },
    });
    expect(next.document.meta.keywords).toEqual(["serum", "skin"]);
    expect(next.document.meta.slug).toBe("glow-serum");
  });

  it("SET_SLUG changes only the slug", () => {
    const state = freshState();
    const next = reducer(state, { type: "SET_SLUG", slug: "new-glow" });
    expect(next.document.meta.slug).toBe("new-glow");
  });

  it("SET_SLUG no-ops when the slug is unchanged", () => {
    const state = freshState();
    const next = reducer(state, { type: "SET_SLUG", slug: "glow-serum" });
    expect(next).toBe(state);
  });
});

describe("reducer — section content", () => {
  it("UPDATE_SECTION patches a section", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    if (hero.kind !== "hero") throw new Error("expected hero");
    const next = reducer(state, {
      type: "UPDATE_SECTION",
      sectionId: hero.id,
      patch: { title: { en: "New Glow" }, align: "left" } as Partial<typeof hero>,
    });
    const updated = next.document.sections[0];
    if (updated.kind !== "hero") throw new Error("expected hero");
    expect(updated.title.en).toBe("New Glow");
    expect(updated.align).toBe("left");
  });

  it("UPDATE_SECTION cannot change the discriminator", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const next = reducer(state, {
      type: "UPDATE_SECTION",
      sectionId: hero.id,
      patch: { kind: "faq" } as never,
    });
    expect(next.document.sections[0].kind).toBe("hero");
    expect(next).toBe(state);
  });

  it("SET_SECTION_MEDIA assigns a media ref", () => {
    const state = freshState();
    const hero = state.document.sections[0];
    const next = reducer(state, {
      type: "SET_SECTION_MEDIA",
      sectionId: hero.id,
      slot: "media",
      media: {
        kind: "image",
        desktopSrc: "https://cdn.example.com/a.jpg",
        alt: "x",
      },
    });
    const updated = next.document.sections[0];
    if (updated.kind !== "hero") throw new Error("expected hero");
    expect(updated.media?.desktopSrc).toBe("https://cdn.example.com/a.jpg");
  });
});

describe("reducer — catalog metadata (Phase 2.3)", () => {
  it("UPDATE_CATALOG_METADATA merges patch fields", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "UPDATE_CATALOG_METADATA",
      patch: { priceMinor: 19_900, sku: "FN-SERUM-001" },
    });
    expect(next.document.catalogMetadata?.priceMinor).toBe(19_900);
    expect(next.document.catalogMetadata?.sku).toBe("FN-SERUM-001");
    // Untouched fields preserve their prior values.
    expect(next.document.catalogMetadata?.priceCurrency).toBe("SAR");
    expect(next.documentVersion).toBe(1);
  });

  it("UPDATE_CATALOG_METADATA replaces array fields wholesale", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "UPDATE_CATALOG_METADATA",
      patch: {
        offerTiers: [
          { quantity: 1, total: { amount: 19_900, currency: "SAR" } },
        ],
        problems: ["dryness", "barrier-damage"],
      },
    });
    expect(next.document.catalogMetadata?.offerTiers).toHaveLength(1);
    expect(next.document.catalogMetadata?.problems).toEqual([
      "dryness",
      "barrier-damage",
    ]);
  });

  it("UPDATE_CATALOG_METADATA seeds a default object for legacy drafts", () => {
    // Simulate a draft that was hydrated from a pre-Phase-2.3 payload
    // (no catalogMetadata field).
    const blank = makeBlankDraft({
      slug: "legacy",
      title: { en: "Legacy" },
      newId: id,
    });
    const legacy = { ...blank, catalogMetadata: undefined };
    const state = initialState(legacy);
    expect(state.document.catalogMetadata).toBeUndefined();
    const next = reducer(state, {
      type: "UPDATE_CATALOG_METADATA",
      patch: { priceMinor: 12_345 },
    });
    expect(next.document.catalogMetadata).toBeDefined();
    expect(next.document.catalogMetadata?.priceMinor).toBe(12_345);
    expect(next.document.catalogMetadata?.priceCurrency).toBe("SAR");
  });

  it("UPDATE_CATALOG_METADATA participates in undo/redo history", () => {
    const state = freshState();
    const edited = reducer(state, {
      type: "UPDATE_CATALOG_METADATA",
      patch: { priceMinor: 19_900 },
    });
    const undone = reducer(edited, { type: "UNDO" });
    expect(undone.document.catalogMetadata?.priceMinor).toBe(0);
    expect(canRedo(undone)).toBe(true);
    const redone = reducer(undone, { type: "REDO" });
    expect(redone.document.catalogMetadata?.priceMinor).toBe(19_900);
  });
});

describe("reducer — history", () => {
  it("UNDO restores the prior document", () => {
    const state = freshState();
    const after = reducer(state, {
      type: "UPDATE_META",
      meta: { keywords: ["a"] },
    });
    const undone = reducer(after, { type: "UNDO" });
    expect(undone.document.meta.keywords).toEqual([]);
    expect(canRedo(undone)).toBe(true);
  });

  it("REDO re-applies an undone change", () => {
    const state = freshState();
    const after = reducer(state, {
      type: "UPDATE_META",
      meta: { keywords: ["a"] },
    });
    const undone = reducer(after, { type: "UNDO" });
    const redone = reducer(undone, { type: "REDO" });
    expect(redone.document.meta.keywords).toEqual(["a"]);
  });

  it("UNDO with empty past is a no-op", () => {
    const state = freshState();
    const next = reducer(state, { type: "UNDO" });
    expect(next).toBe(state);
  });

  it("History cap is respected", async () => {
    let state = freshState();
    for (let i = 0; i < 80; i++) {
      state = reducer(state, {
        type: "UPDATE_META",
        meta: { keywords: [`k${i}`] },
      });
    }
    expect(state.past.length).toBeLessThanOrEqual(50);
  });
});

describe("reducer — save lifecycle", () => {
  it("MARK_SAVED clears dirty state", () => {
    const state = freshState();
    const dirty = reducer(state, {
      type: "UPDATE_META",
      meta: { keywords: ["x"] },
    });
    expect(isDirty(dirty)).toBe(true);
    const saved = reducer(dirty, {
      type: "MARK_SAVED",
      savedAt: 1_000_000,
      savedDocumentVersion: dirty.documentVersion,
    });
    expect(isDirty(saved)).toBe(false);
    expect(saved.saveState).toBe("saved");
  });

  it("MARK_SAVE_ERROR stores the message", () => {
    const state = freshState();
    const next = reducer(state, {
      type: "MARK_SAVE_ERROR",
      message: "boom",
    });
    expect(next.lastError).toBe("boom");
    expect(next.saveState).toBe("error");
  });
});

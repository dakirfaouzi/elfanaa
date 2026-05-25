import { describe, expect, it } from "vitest";
import { SectionKindSchema } from "@platform/builder-schema";
import { SECTION_PICKER_GROUPS } from "../lib/studio/section-picker-groups";

/**
 * Coverage + uniqueness tests for the picker grouping.
 *
 * Load-bearing: every section kind in `@platform/builder-schema`
 * MUST appear in exactly one group. If the schema gains a new kind
 * the picker would silently drop it; if it removes one the group
 * would render a broken chip.
 */

describe("SECTION_PICKER_GROUPS — schema coverage", () => {
  it("every SectionKind in the schema is in exactly one group", () => {
    const expected = new Set(SectionKindSchema.options);
    const seen = new Set<string>();
    for (const group of SECTION_PICKER_GROUPS) {
      for (const kind of group.kinds) {
        if (seen.has(kind)) {
          throw new Error(`Duplicate kind in picker groups: ${kind}`);
        }
        seen.add(kind);
      }
    }
    expect(seen).toEqual(expected);
  });

  it("no group contains an unknown kind", () => {
    const known = new Set<string>(SectionKindSchema.options);
    for (const group of SECTION_PICKER_GROUPS) {
      for (const kind of group.kinds) {
        expect(known.has(kind)).toBe(true);
      }
    }
  });

  it("every group has a non-empty label", () => {
    for (const group of SECTION_PICKER_GROUPS) {
      expect(group.label).toBeTruthy();
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  it("group ids are unique", () => {
    const ids = SECTION_PICKER_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every group has at least one kind", () => {
    for (const group of SECTION_PICKER_GROUPS) {
      expect(group.kinds.length).toBeGreaterThan(0);
    }
  });
});

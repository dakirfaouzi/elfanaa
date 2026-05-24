import { describe, expect, it } from "vitest";
import { TargetingSchema } from "@platform/ingest/metadata";
import {
  TARGETING_PRESETS,
  applyPreset,
  isPresetActive,
  togglePreset,
  type TargetingPreset,
} from "../lib/studio/intake/targeting-presets";

/**
 * Schema-guard + behavioural tests for the audience presets
 * (Phase B6 / intake polish).
 *
 * The schema-guard half is the load-bearing one: every preset's
 * `picks` MUST parse cleanly under `TargetingSchema`. If a future
 * contracts change tightens an enum or renames a value, this test
 * fails loudly in CI rather than shipping silently-invalid presets
 * to operators.
 *
 * The behavioural half locks in the apply / toggle / merge semantics
 * the operator UX depends on:
 *   • Composability — applying two presets sequentially preserves
 *     non-overlapping keys.
 *   • Toggle-off — re-applying a fully-active preset clears exactly
 *     the keys it set.
 *   • Manual-edit protection — `togglePreset` does NOT clobber a key
 *     the operator has manually changed away from the preset value.
 */

describe("TARGETING_PRESETS — schema conformance", () => {
  it("has at least one preset", () => {
    expect(TARGETING_PRESETS.length).toBeGreaterThan(0);
  });

  it("every preset has a unique id", () => {
    const ids = TARGETING_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a non-empty label", () => {
    for (const p of TARGETING_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("every preset's picks parses under TargetingSchema", () => {
    for (const p of TARGETING_PRESETS) {
      const result = TargetingSchema.safeParse(p.picks);
      if (!result.success) {
        throw new Error(
          `Preset ${p.id} fails schema: ${JSON.stringify(result.error.format())}`,
        );
      }
      expect(result.success).toBe(true);
    }
  });

  it("preset picks never set both ageMin and ageMax in an invalid order", () => {
    for (const p of TARGETING_PRESETS) {
      const { ageMin, ageMax } = p.picks;
      if (typeof ageMin === "number" && typeof ageMax === "number") {
        expect(ageMin).toBeLessThanOrEqual(ageMax);
      }
    }
  });
});

describe("isPresetActive", () => {
  const beauty: TargetingPreset = TARGETING_PRESETS.find(
    (p) => p.id === "beauty",
  )!;

  it("returns false when no keys overlap", () => {
    expect(isPresetActive({}, beauty)).toBe(false);
  });

  it("returns true when every key the preset sets matches the current value", () => {
    expect(isPresetActive(beauty.picks, beauty)).toBe(true);
  });

  it("returns false when one key differs", () => {
    expect(
      isPresetActive({ ...beauty.picks, toneStyle: "clinical" }, beauty),
    ).toBe(false);
  });

  it("ignores extra unrelated keys in current", () => {
    expect(
      isPresetActive({ ...beauty.picks, gender: "female" }, beauty),
    ).toBe(true);
  });
});

describe("applyPreset", () => {
  const gccWomen = TARGETING_PRESETS.find((p) => p.id === "gcc_women")!;
  const beauty = TARGETING_PRESETS.find((p) => p.id === "beauty")!;

  it("returns a NEW object (no mutation)", () => {
    const before = {};
    const after = applyPreset(before, gccWomen);
    expect(after).not.toBe(before);
    expect(before).toEqual({});
  });

  it("merges preset picks over an empty current", () => {
    expect(applyPreset({}, gccWomen)).toEqual(gccWomen.picks);
  });

  it("composes two non-overlapping presets in either order", () => {
    const a = applyPreset(applyPreset({}, gccWomen), beauty);
    const b = applyPreset(applyPreset({}, beauty), gccWomen);
    // Different orders may produce different overrides on shared
    // keys, but gcc_women + beauty share NO keys, so order doesn't
    // matter here — the result must equal the union of both pick sets.
    const expected = { ...gccWomen.picks, ...beauty.picks };
    expect(a).toEqual(expected);
    expect(b).toEqual(expected);
  });

  it("overrides existing values on overlapping keys (last apply wins)", () => {
    const start = { toneStyle: "clinical" as const };
    const next = applyPreset(start, beauty);
    expect(next.toneStyle).toBe(beauty.picks.toneStyle);
  });

  it("preserves operator-set keys the preset does not touch", () => {
    const start = { gender: "any" as const };
    const next = applyPreset(start, beauty);
    expect(next.gender).toBe("any");
  });
});

describe("togglePreset", () => {
  const beauty = TARGETING_PRESETS.find((p) => p.id === "beauty")!;
  const gccWomen = TARGETING_PRESETS.find((p) => p.id === "gcc_women")!;

  it("applies the preset when not active", () => {
    expect(togglePreset({}, beauty)).toEqual(beauty.picks);
  });

  it("clears exactly the preset's keys when fully active", () => {
    const next = togglePreset(beauty.picks, beauty);
    for (const key of Object.keys(beauty.picks)) {
      expect((next as Record<string, unknown>)[key]).toBeUndefined();
    }
  });

  it("re-applies the preset if any of its keys was manually changed (no clobber path)", () => {
    // Operator picked beauty, then manually changed toneStyle to
    // clinical. Re-toggling should NOT clear the other beauty keys
    // (the preset is no longer "active"); it should re-apply,
    // restoring beauty's toneStyle.
    const current = { ...beauty.picks, toneStyle: "clinical" as const };
    const next = togglePreset(current, beauty);
    expect(next.toneStyle).toBe(beauty.picks.toneStyle);
    expect(next.emotionalAngle).toBe(beauty.picks.emotionalAngle);
    expect(next.sophisticationLevel).toBe(beauty.picks.sophisticationLevel);
  });

  it("preserves unrelated operator-set keys when clearing", () => {
    // Operator clicked GCC Women, then Beauty (composed). Toggling
    // Beauty off should clear only the Beauty keys; GCC Women's
    // picks must remain.
    const composed = applyPreset(applyPreset({}, gccWomen), beauty);
    const next = togglePreset(composed, beauty);
    expect(next.gender).toBe(gccWomen.picks.gender);
    expect(next.market).toBe(gccWomen.picks.market);
    expect(next.primaryLanguage).toBe(gccWomen.picks.primaryLanguage);
    expect(next.ageMin).toBe(gccWomen.picks.ageMin);
    expect(next.ageMax).toBe(gccWomen.picks.ageMax);
    // Beauty's keys were cleared.
    expect(next.toneStyle).toBeUndefined();
    expect(next.emotionalAngle).toBeUndefined();
    expect(next.sophisticationLevel).toBeUndefined();
  });

  it("toggling a non-active preset that partially overlaps does not clear (re-applies)", () => {
    const current = { gender: "female" as const };
    const next = togglePreset(current, beauty);
    // None of beauty's keys are in current → not active → apply.
    expect(next.gender).toBe("female");
    expect(next.toneStyle).toBe(beauty.picks.toneStyle);
  });
});

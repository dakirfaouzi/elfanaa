import { describe, expect, it } from "vitest";
import { TargetingSchema, IntakeMetadataSchema } from "../index";

/**
 * Targeting schema tests (Phase B2).
 *
 * Coverage focuses on the contract-level invariants:
 *
 *   • Every field is optional — `{}` validates, partial picks
 *     validate, full object validates.
 *   • Enum membership is enforced (no free-text leakage).
 *   • Cross-field constraint: ageMin ≤ ageMax when both present.
 *   • Market regex pins ISO-3166 alpha-2 (uppercase).
 *   • Integrates cleanly into IntakeMetadataSchema (the namespace
 *     accepts `{ targeting: ... }` and strips unknown siblings).
 */

describe("TargetingSchema", () => {
  it("accepts an empty object (operator made no picks)", () => {
    expect(TargetingSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully-populated object", () => {
    const parsed = TargetingSchema.safeParse({
      gender: "female",
      market: "SA",
      primaryLanguage: "ar",
      ageMin: 25,
      ageMax: 40,
      awarenessLevel: "solution-aware",
      sophisticationLevel: "intermediate",
      emotionalAngle: "transformation",
      toneStyle: "luxurious",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts partial objects (e.g. just gender)", () => {
    expect(
      TargetingSchema.safeParse({ gender: "female" }).success,
    ).toBe(true);
    expect(
      TargetingSchema.safeParse({ ageMin: 18 }).success,
    ).toBe(true);
  });

  it("rejects unknown enum values for gender", () => {
    expect(
      TargetingSchema.safeParse({ gender: "alien" as never }).success,
    ).toBe(false);
  });

  it("rejects unknown enum values for awarenessLevel", () => {
    expect(
      TargetingSchema.safeParse({
        awarenessLevel: "deeply-aware" as never,
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range ages", () => {
    expect(TargetingSchema.safeParse({ ageMin: 5 }).success).toBe(false);
    expect(TargetingSchema.safeParse({ ageMax: 250 }).success).toBe(false);
    expect(TargetingSchema.safeParse({ ageMin: 12 }).success).toBe(false);
    expect(TargetingSchema.safeParse({ ageMax: 101 }).success).toBe(false);
  });

  it("rejects non-integer ages", () => {
    expect(TargetingSchema.safeParse({ ageMin: 25.5 }).success).toBe(false);
  });

  it("enforces ageMin ≤ ageMax when both present", () => {
    // Invalid — min > max.
    const bad = TargetingSchema.safeParse({ ageMin: 40, ageMax: 25 });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe("age_min_must_not_exceed_max");
    }
    // Valid — equal endpoints OK (single-age cohort).
    expect(
      TargetingSchema.safeParse({ ageMin: 30, ageMax: 30 }).success,
    ).toBe(true);
    // Valid — only one endpoint set.
    expect(TargetingSchema.safeParse({ ageMin: 25 }).success).toBe(true);
    expect(TargetingSchema.safeParse({ ageMax: 40 }).success).toBe(true);
  });

  it("market accepts uppercase ISO-3166 alpha-2 only", () => {
    expect(TargetingSchema.safeParse({ market: "SA" }).success).toBe(true);
    expect(TargetingSchema.safeParse({ market: "AE" }).success).toBe(true);
    // Lowercase rejected — strict to keep the strategy stage's
    // serialized form deterministic.
    expect(TargetingSchema.safeParse({ market: "sa" }).success).toBe(false);
    // 3-letter (alpha-3) rejected.
    expect(TargetingSchema.safeParse({ market: "USA" }).success).toBe(false);
    // Numbers / symbols rejected.
    expect(TargetingSchema.safeParse({ market: "12" }).success).toBe(false);
    expect(TargetingSchema.safeParse({ market: "" }).success).toBe(false);
  });
});

describe("IntakeMetadataSchema with targeting", () => {
  it("accepts targeting under the metadata namespace", () => {
    const parsed = IntakeMetadataSchema.safeParse({
      targeting: { gender: "female", market: "SA" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.targeting?.gender).toBe("female");
    }
  });

  it("empty metadata still validates (targeting absent)", () => {
    const parsed = IntakeMetadataSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.targeting).toBeUndefined();
    }
  });

  it("invalid targeting fields fail the parent schema", () => {
    expect(
      IntakeMetadataSchema.safeParse({
        targeting: { gender: "alien" as never },
      }).success,
    ).toBe(false);
  });
});

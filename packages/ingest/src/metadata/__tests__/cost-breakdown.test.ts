import { describe, expect, it } from "vitest";
import { CostBreakdownSchema, IntakeMetadataSchema } from "../index";

/**
 * Cost-breakdown schema tests (Phase B3).
 *
 * Coverage:
 *   • Every field optional; empty object validates.
 *   • Non-negative constraints reject negative costs.
 *   • targetMarginPercent capped at 95 (anything higher is
 *     almost certainly a units mistake).
 *   • Integrates cleanly into IntakeMetadataSchema alongside
 *     the existing Phase B2 targeting namespace.
 */

describe("CostBreakdownSchema", () => {
  it("accepts an empty object", () => {
    expect(CostBreakdownSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully populated breakdown", () => {
    const parsed = CostBreakdownSchema.safeParse({
      productCost: 4.2,
      shipping: 1.8,
      codFee: 0.5,
      packaging: 0.3,
      targetMarginPercent: 35,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts partial inputs (just productCost)", () => {
    expect(CostBreakdownSchema.safeParse({ productCost: 4.2 }).success).toBe(
      true,
    );
  });

  it("rejects negative numbers in any cost field", () => {
    for (const field of ["productCost", "shipping", "codFee", "packaging"]) {
      expect(
        CostBreakdownSchema.safeParse({ [field]: -1 }).success,
      ).toBe(false);
    }
  });

  it("rejects targetMarginPercent > 95 (likely units mistake)", () => {
    expect(
      CostBreakdownSchema.safeParse({ targetMarginPercent: 96 }).success,
    ).toBe(false);
  });

  it("rejects targetMarginPercent < 0", () => {
    expect(
      CostBreakdownSchema.safeParse({ targetMarginPercent: -5 }).success,
    ).toBe(false);
  });

  it("accepts targetMarginPercent at the boundaries (0 and 95)", () => {
    expect(
      CostBreakdownSchema.safeParse({ targetMarginPercent: 0 }).success,
    ).toBe(true);
    expect(
      CostBreakdownSchema.safeParse({ targetMarginPercent: 95 }).success,
    ).toBe(true);
  });

  it("rejects extreme cost values that suggest a units error", () => {
    // Cap is 1_000_000 — anyone entering 9_999_999 in productCost
    // almost certainly meant to put it in priceHintMinor.
    expect(
      CostBreakdownSchema.safeParse({ productCost: 9_999_999 }).success,
    ).toBe(false);
  });
});

describe("IntakeMetadataSchema with costBreakdown", () => {
  it("accepts costBreakdown alongside targeting", () => {
    const parsed = IntakeMetadataSchema.safeParse({
      targeting: { gender: "female" },
      costBreakdown: { productCost: 4.2, targetMarginPercent: 40 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.costBreakdown?.productCost).toBe(4.2);
      expect(parsed.data.targeting?.gender).toBe("female");
    }
  });

  it("accepts costBreakdown alone (no targeting)", () => {
    const parsed = IntakeMetadataSchema.safeParse({
      costBreakdown: { productCost: 4.2 },
    });
    expect(parsed.success).toBe(true);
  });

  it("invalid costBreakdown fields fail the parent schema", () => {
    expect(
      IntakeMetadataSchema.safeParse({
        costBreakdown: { productCost: -1 },
      }).success,
    ).toBe(false);
  });
});

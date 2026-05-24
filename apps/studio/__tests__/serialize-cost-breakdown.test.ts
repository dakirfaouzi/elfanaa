import { describe, expect, it } from "vitest";
import {
  computeLandedCost,
  computeRealisedMarginPercent,
  renderCostBreakdownAsNotes,
} from "../lib/studio/intake/serialize-cost-breakdown";

/**
 * Cost-breakdown serializer + math tests (Phase B3).
 *
 * The math helpers (`computeLandedCost`, `computeRealisedMarginPercent`)
 * are reused by the UI for the live preview AND by the serializer
 * for the persisted bullet list — same formula, no drift.
 */

describe("computeLandedCost", () => {
  it("returns null for undefined / empty breakdown", () => {
    expect(computeLandedCost(undefined)).toBeNull();
    expect(computeLandedCost({})).toBeNull();
  });

  it("sums populated components only", () => {
    expect(
      computeLandedCost({ productCost: 4.2, shipping: 1.8 }),
    ).toBeCloseTo(6.0, 5);
    expect(
      computeLandedCost({
        productCost: 4.2,
        shipping: 1.8,
        codFee: 0.5,
        packaging: 0.3,
      }),
    ).toBeCloseTo(6.8, 5);
  });

  it("ignores undefined / missing fields", () => {
    // Only productCost set — landed = productCost.
    expect(computeLandedCost({ productCost: 4.2 })).toBe(4.2);
  });

  it("targetMarginPercent doesn't contribute to landed cost", () => {
    expect(
      computeLandedCost({ productCost: 4.2, targetMarginPercent: 40 }),
    ).toBe(4.2);
  });
});

describe("computeRealisedMarginPercent", () => {
  it("computes the standard (price - cost) / price * 100", () => {
    expect(computeRealisedMarginPercent(10, 4)).toBeCloseTo(60, 5);
    expect(computeRealisedMarginPercent(199, 6.8)).toBeCloseTo(96.58, 1);
  });

  it("returns null when price is missing", () => {
    expect(computeRealisedMarginPercent(null, 4)).toBeNull();
    expect(computeRealisedMarginPercent(undefined, 4)).toBeNull();
  });

  it("returns null when landed cost is null", () => {
    expect(computeRealisedMarginPercent(10, null)).toBeNull();
  });

  it("returns null for non-positive price (avoid div-by-zero)", () => {
    expect(computeRealisedMarginPercent(0, 4)).toBeNull();
    expect(computeRealisedMarginPercent(-5, 4)).toBeNull();
  });

  it("can return negative margin (selling below cost)", () => {
    // The form's preview colour-codes this red — we don't clamp.
    expect(computeRealisedMarginPercent(4, 10)).toBeCloseTo(-150, 5);
  });
});

describe("renderCostBreakdownAsNotes", () => {
  it("returns empty string for empty breakdown + no freeform", () => {
    expect(renderCostBreakdownAsNotes(undefined, "SAR", undefined)).toBe("");
    expect(renderCostBreakdownAsNotes({}, "SAR", "")).toBe("");
    expect(renderCostBreakdownAsNotes({}, "SAR", "   ")).toBe("");
  });

  it("emits only Notes block when freeform is set but no structured fields", () => {
    expect(
      renderCostBreakdownAsNotes({}, "SAR", "supplier quoted in CNY"),
    ).toBe("Notes: supplier quoted in CNY");
  });

  it("emits structured bullets + landed cost when components are present", () => {
    const out = renderCostBreakdownAsNotes(
      { productCost: 4.2, shipping: 1.8 },
      "USD",
      undefined,
    );
    expect(out).toContain("Cost breakdown (per unit):");
    expect(out).toContain("• Product: 4.20 USD");
    expect(out).toContain("• Shipping: 1.80 USD");
    expect(out).toContain("• Landed cost: 6.00 USD");
  });

  it("does NOT emit Landed cost when no components are set (only targetMarginPercent)", () => {
    const out = renderCostBreakdownAsNotes(
      { targetMarginPercent: 40 },
      "USD",
      undefined,
    );
    expect(out).not.toContain("Landed cost");
    expect(out).toContain("• Target margin: 40%");
  });

  it("formats target margin as an integer percent", () => {
    expect(
      renderCostBreakdownAsNotes(
        { targetMarginPercent: 35.7 },
        "SAR",
        undefined,
      ),
    ).toContain("• Target margin: 36%");
  });

  it("combines structured + freeform with a blank-line separator", () => {
    const out = renderCostBreakdownAsNotes(
      { productCost: 4.2 },
      "USD",
      "FX assumed 0.38",
    );
    expect(out).toMatch(/Landed cost: 4\.20 USD\n\nNotes: FX assumed 0\.38/);
  });

  it("respects the supplied currency in every cost line", () => {
    const out = renderCostBreakdownAsNotes(
      { productCost: 4.2, shipping: 1.8, codFee: 0.5, packaging: 0.3 },
      "AED",
      undefined,
    );
    expect(out).toContain("Product: 4.20 AED");
    expect(out).toContain("Shipping: 1.80 AED");
    expect(out).toContain("COD fee: 0.50 AED");
    expect(out).toContain("Packaging: 0.30 AED");
    expect(out).toContain("Landed cost: 6.80 AED");
  });

  it("produces deterministic output for the same input (run-to-run stability)", () => {
    const breakdown = {
      productCost: 4.2,
      shipping: 1.8,
      targetMarginPercent: 35,
    };
    const a = renderCostBreakdownAsNotes(breakdown, "SAR", "freeform");
    const b = renderCostBreakdownAsNotes(breakdown, "SAR", "freeform");
    expect(a).toBe(b);
  });

  it("trims surrounding whitespace from freeform notes", () => {
    expect(renderCostBreakdownAsNotes({}, "SAR", "  x  ")).toBe("Notes: x");
  });
});

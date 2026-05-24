import { describe, expect, it } from "vitest";
import type { OfferTier } from "@platform/ingest";
import {
  baselinePerUnit,
  bundleMarginPercent,
  mostPopularTier,
  pricePerUnit,
  savingsPercentVsBaseline,
} from "../lib/studio/intake/offer-math";

/**
 * Offer math tests (Phase B4).
 *
 * These helpers are shared between the live UI preview and the
 * future Phase C assemble-stage adapter — getting them right is
 * worth a thorough test surface.
 */

describe("pricePerUnit", () => {
  it("divides bundlePrice by quantity", () => {
    expect(
      pricePerUnit({ label: "x", quantity: 2, bundlePrice: 338 }),
    ).toBe(169);
  });

  it("returns 0 for quantity = 0 (defensive — schema bans this)", () => {
    expect(
      pricePerUnit({ label: "x", quantity: 0, bundlePrice: 100 }),
    ).toBe(0);
  });
});

describe("baselinePerUnit", () => {
  const baseTier = (over: Partial<OfferTier>): OfferTier => ({
    label: "x",
    quantity: 1,
    bundlePrice: 100,
    ...over,
  });

  it("prefers the explicit single-unit tier when present", () => {
    const offers: OfferTier[] = [
      baseTier({ quantity: 1, bundlePrice: 199 }),
      baseTier({ quantity: 2, bundlePrice: 338 }),
    ];
    expect(baselinePerUnit(offers, 50)).toBe(199);
  });

  it("falls back to priceHintMajor when no single-unit tier exists", () => {
    const offers: OfferTier[] = [
      baseTier({ quantity: 2, bundlePrice: 338 }),
      baseTier({ quantity: 3, bundlePrice: 497 }),
    ];
    expect(baselinePerUnit(offers, 199)).toBe(199);
  });

  it("returns null when neither single-tier nor priceHint is usable", () => {
    expect(baselinePerUnit([], null)).toBeNull();
    expect(baselinePerUnit([], 0)).toBeNull();
    expect(baselinePerUnit([], -10)).toBeNull();
  });

  it("treats a single-unit tier with bundlePrice 0 as not-a-baseline (uses priceHint)", () => {
    // An incomplete single-tier (price 0) shouldn't override
    // the operator's explicit price hint.
    const offers: OfferTier[] = [baseTier({ quantity: 1, bundlePrice: 0 })];
    expect(baselinePerUnit(offers, 199)).toBe(199);
  });
});

describe("savingsPercentVsBaseline", () => {
  it("computes savings vs the supplied baseline", () => {
    const tier: OfferTier = { label: "x", quantity: 2, bundlePrice: 338 };
    // perUnit = 169; baseline 199 → savings = (199 - 169) / 199 ≈ 15.08%
    const out = savingsPercentVsBaseline(tier, 199);
    expect(out).not.toBeNull();
    expect(out!).toBeCloseTo(15.08, 1);
  });

  it("returns negative savings when perUnit exceeds baseline (price-up tier)", () => {
    const tier: OfferTier = { label: "x", quantity: 1, bundlePrice: 250 };
    const out = savingsPercentVsBaseline(tier, 199);
    expect(out).not.toBeNull();
    expect(out!).toBeLessThan(0);
  });

  it("returns null when baseline is null/0/negative", () => {
    const tier: OfferTier = { label: "x", quantity: 1, bundlePrice: 100 };
    expect(savingsPercentVsBaseline(tier, null)).toBeNull();
    expect(savingsPercentVsBaseline(tier, 0)).toBeNull();
    expect(savingsPercentVsBaseline(tier, -5)).toBeNull();
  });

  it("returns null when tier quantity ≤ 0 (defensive)", () => {
    expect(
      savingsPercentVsBaseline(
        { label: "x", quantity: 0, bundlePrice: 100 },
        199,
      ),
    ).toBeNull();
  });
});

describe("bundleMarginPercent", () => {
  it("computes (bundlePrice - cogs) / bundlePrice * 100", () => {
    // qty=2, bundle=338, landed=4.20 → cogs=8.40; margin ≈ 97.51%
    const tier: OfferTier = { label: "x", quantity: 2, bundlePrice: 338 };
    const out = bundleMarginPercent(tier, 4.2);
    expect(out).not.toBeNull();
    expect(out!).toBeCloseTo(97.51, 1);
  });

  it("returns null when landedCostPerUnit is null (no cost data yet)", () => {
    const tier: OfferTier = { label: "x", quantity: 1, bundlePrice: 100 };
    expect(bundleMarginPercent(tier, null)).toBeNull();
  });

  it("returns null for non-positive bundlePrice (avoid div-by-zero)", () => {
    const tier: OfferTier = { label: "x", quantity: 1, bundlePrice: 0 };
    expect(bundleMarginPercent(tier, 4.2)).toBeNull();
  });

  it("can return negative margin (selling below COGS)", () => {
    // qty=1, bundle=10, landed=50 → cogs=50; margin = (10 - 50) / 10 = -400
    const tier: OfferTier = { label: "x", quantity: 1, bundlePrice: 10 };
    const out = bundleMarginPercent(tier, 50);
    expect(out).toBe(-400);
  });
});

describe("mostPopularTier", () => {
  const tier = (over: Partial<OfferTier>): OfferTier => ({
    label: "x",
    quantity: 1,
    bundlePrice: 100,
    ...over,
  });

  it("returns the explicitly flagged tier when present", () => {
    const offers: OfferTier[] = [
      tier({ label: "Single" }),
      tier({ label: "2-Pack", quantity: 2, bundlePrice: 180, mostPopular: true }),
      tier({ label: "3-Pack", quantity: 3, bundlePrice: 240 }),
    ];
    expect(mostPopularTier(offers)?.label).toBe("2-Pack");
  });

  it("falls back to the highest-quantity tier when none flagged", () => {
    const offers: OfferTier[] = [
      tier({ label: "Single" }),
      tier({ label: "2-Pack", quantity: 2, bundlePrice: 180 }),
      tier({ label: "3-Pack", quantity: 3, bundlePrice: 240 }),
    ];
    expect(mostPopularTier(offers)?.label).toBe("3-Pack");
  });

  it("returns null for empty array", () => {
    expect(mostPopularTier([])).toBeNull();
  });

  it("returns the flagged tier even when it's not the largest quantity", () => {
    const offers: OfferTier[] = [
      tier({ label: "Single", mostPopular: true }),
      tier({ label: "2-Pack", quantity: 2, bundlePrice: 180 }),
      tier({ label: "3-Pack", quantity: 3, bundlePrice: 240 }),
    ];
    expect(mostPopularTier(offers)?.label).toBe("Single");
  });
});

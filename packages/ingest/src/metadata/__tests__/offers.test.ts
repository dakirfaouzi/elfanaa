import { describe, expect, it } from "vitest";
import {
  IntakeMetadataSchema,
  OfferTierSchema,
  OffersSchema,
} from "../index";

/**
 * Offers schema tests (Phase B4).
 *
 * Coverage:
 *   • Tier-level validation: label / quantity / bundlePrice
 *     bounds, optional mostPopular + id.
 *   • Array-level constraints: max 10 tiers, at most ONE
 *     mostPopular per array (the only cross-tier invariant).
 *   • IntakeMetadata composition: stacks cleanly with targeting
 *     and costBreakdown.
 */

describe("OfferTierSchema", () => {
  it("accepts a minimal tier (label + qty + price)", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "Single",
        quantity: 1,
        bundlePrice: 199,
      }).success,
    ).toBe(true);
  });

  it("accepts mostPopular + id additions", () => {
    expect(
      OfferTierSchema.safeParse({
        id: "tier_a",
        label: "Most Popular Pack",
        quantity: 3,
        bundlePrice: 497,
        mostPopular: true,
      }).success,
    ).toBe(true);
  });

  it("rejects empty label", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "",
        quantity: 1,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
  });

  it("rejects label > 80 chars (overflow guard)", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x".repeat(81),
        quantity: 1,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
  });

  it("rejects quantity ≤ 0", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: 0,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: -1,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
  });

  it("rejects quantity > 99 (units mistake guard)", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: 100,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
  });

  it("rejects negative bundlePrice", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: 1,
        bundlePrice: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects extreme bundlePrice (units mistake guard)", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: 1,
        bundlePrice: 100_000_000,
      }).success,
    ).toBe(false);
  });

  it("rejects non-integer quantity (no fractional packs)", () => {
    expect(
      OfferTierSchema.safeParse({
        label: "x",
        quantity: 1.5,
        bundlePrice: 100,
      }).success,
    ).toBe(false);
  });
});

describe("OffersSchema", () => {
  const validTier = {
    label: "Single",
    quantity: 1,
    bundlePrice: 199,
  };

  it("accepts an empty array (no structured offers)", () => {
    expect(OffersSchema.safeParse([]).success).toBe(true);
  });

  it("accepts up to 10 tiers", () => {
    const tiers = Array.from({ length: 10 }, (_, i) => ({
      label: `Tier ${i + 1}`,
      quantity: i + 1,
      bundlePrice: 100 + i * 50,
    }));
    expect(OffersSchema.safeParse(tiers).success).toBe(true);
  });

  it("rejects more than 10 tiers", () => {
    const tiers = Array.from({ length: 11 }, () => validTier);
    expect(OffersSchema.safeParse(tiers).success).toBe(false);
  });

  it("accepts zero tiers flagged mostPopular", () => {
    expect(
      OffersSchema.safeParse([validTier, { ...validTier, label: "2-Pack" }]).success,
    ).toBe(true);
  });

  it("accepts exactly one tier flagged mostPopular", () => {
    expect(
      OffersSchema.safeParse([
        validTier,
        { ...validTier, label: "2-Pack", mostPopular: true },
      ]).success,
    ).toBe(true);
  });

  it("REJECTS two tiers flagged mostPopular (the cross-tier invariant)", () => {
    const result = OffersSchema.safeParse([
      { ...validTier, mostPopular: true },
      { ...validTier, label: "2-Pack", mostPopular: true },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "at_most_one_offer_may_be_most_popular",
      );
    }
  });
});

describe("IntakeMetadataSchema with offers", () => {
  it("accepts offers alongside targeting + costBreakdown", () => {
    const parsed = IntakeMetadataSchema.safeParse({
      targeting: { gender: "female" },
      costBreakdown: { productCost: 4.2 },
      offers: [
        { label: "Single", quantity: 1, bundlePrice: 199 },
        { label: "2-Pack", quantity: 2, bundlePrice: 338, mostPopular: true },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.offers?.length).toBe(2);
      expect(parsed.data.offers?.[1]?.mostPopular).toBe(true);
    }
  });

  it("accepts offers as the only intake-metadata field", () => {
    expect(
      IntakeMetadataSchema.safeParse({
        offers: [{ label: "Single", quantity: 1, bundlePrice: 199 }],
      }).success,
    ).toBe(true);
  });

  it("propagates the two-mostPopular invariant up through the parent schema", () => {
    expect(
      IntakeMetadataSchema.safeParse({
        offers: [
          { label: "a", quantity: 1, bundlePrice: 100, mostPopular: true },
          { label: "b", quantity: 2, bundlePrice: 180, mostPopular: true },
        ],
      }).success,
    ).toBe(false);
  });
});

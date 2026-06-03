import { describe, it, expect } from "vitest";
import {
  buildConfiguredPostPurchaseUpsell,
  POST_PURCHASE_OFFER_PRICE,
} from "@/lib/upsell/strategy";
import { products } from "@/data/products";
import type { Product } from "@/lib/types";

const base = products[0];

function withPrice(amount: number, currency = "SAR"): Product {
  return { ...base, price: { amount, currency } };
}

describe("buildConfiguredPostPurchaseUpsell (operator-pinned 99-SAR offer)", () => {
  it("always reprices to the fixed 99-SAR offer price", () => {
    const offer = buildConfiguredPostPurchaseUpsell(withPrice(19_900));
    expect(offer.offerPrice).toEqual(POST_PURCHASE_OFFER_PRICE);
    expect(offer.basePrice.amount).toBe(19_900);
    expect(offer.reason).toBe("curated");
  });

  it("computes honest savings vs the base price for a normal anchor", () => {
    const offer = buildConfiguredPostPurchaseUpsell(withPrice(19_900));
    expect(offer.savings.amount).toBe(19_900 - 9_900);
    expect(offer.discountPercent).toBe(50);
  });

  it("honours an out-of-window operator pick (bypasses the credibility gate)", () => {
    // 1000 SAR base is far ABOVE the 6x credibility ceiling — the heuristic
    // would reject it, but an explicit operator pick must still resolve.
    const offer = buildConfiguredPostPurchaseUpsell(withPrice(100_000));
    expect(offer.product.id).toBe(base.id);
    expect(offer.offerPrice.amount).toBe(9_900);
  });

  it("clamps savings/percent to >=0 when the pick is cheaper than 99 SAR", () => {
    const offer = buildConfiguredPostPurchaseUpsell(withPrice(4_900));
    expect(offer.savings.amount).toBe(0);
    expect(offer.discountPercent).toBe(0);
  });

  it("never divides by zero on a zero-priced product", () => {
    const offer = buildConfiguredPostPurchaseUpsell(withPrice(0));
    expect(offer.discountPercent).toBe(0);
    expect(offer.savings.amount).toBe(0);
  });
});

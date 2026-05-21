import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildHeroProps,
  buildGalleryProps,
  buildBenefitsProps,
  buildIngredientsProps,
  buildReviewsProps,
  buildFaqProps,
  buildOfferTiersProps,
  buildTaxonomyProps,
  buildNicheProps,
  buildProvenanceProps,
  buildHooksProps,
  buildSpecsProps,
  resolveImageUrl,
  formatMoney,
} from "../lib/studio/preview-props";
import { fixturePublishedBundle } from "./_helpers/fixture-bundle";

/**
 * Tests for the preview prop-builders.
 *
 * Pure functions — no IO, no env (except `resolveImageUrl`'s CDN
 * lookup, which we save/restore around each test).
 *
 * The builders are the testable core of the preview rendering layer.
 * If these are correct, the JSX components in `_components/preview/`
 * are correct by construction (they just spread the props).
 */
describe("preview-props builders", () => {
  it("buildHeroProps composes title + headline + hero image + price", () => {
    const b = fixturePublishedBundle();
    const props = buildHeroProps(b.universalProduct, b.fanaaExtension);
    expect(props.title.ar).toBe("سيروم العناية المضيء");
    expect(props.title.en).toBe("Glow Care Serum");
    expect(props.headline?.ar).toBeTruthy();
    expect(props.hero.placeholder).toBe(true); // R2 key → placeholder in tests
    expect(props.price?.display).toBe("199.00 SAR");
  });

  it("buildGalleryProps flags the hero image", () => {
    const b = fixturePublishedBundle();
    const props = buildGalleryProps(b.universalProduct);
    expect(props.images[0].isHero).toBe(true);
    expect(props.images.every((i) => i.placeholder === true)).toBe(true);
  });

  it("buildBenefitsProps defaults missing icons to Sparkles", () => {
    const b = fixturePublishedBundle();
    b.universalProduct.benefits[0].icon = "";
    const props = buildBenefitsProps(b.universalProduct);
    expect(props.items[0].iconKey).toBe("Sparkles");
  });

  it("buildIngredientsProps returns [] when ingredients is undefined", () => {
    const b = fixturePublishedBundle();
    delete b.universalProduct.ingredients;
    const props = buildIngredientsProps(b.universalProduct);
    expect(props.items).toEqual([]);
  });

  it("buildReviewsProps computes distribution and clamps ratings", () => {
    const b = fixturePublishedBundle();
    b.universalProduct.reviews = [
      ...b.universalProduct.reviews,
      { ...b.universalProduct.reviews[0], rating: 3.6, body: { ar: "x", en: "x" } },
      { ...b.universalProduct.reviews[0], rating: 1, body: { ar: "y", en: "y" } },
    ];
    const props = buildReviewsProps(b.universalProduct);
    expect(props.distribution[5]).toBe(1);
    expect(props.distribution[4]).toBe(1);
    expect(props.distribution[1]).toBe(1);
  });

  it("buildFaqProps returns FAQs as-is", () => {
    const b = fixturePublishedBundle();
    const props = buildFaqProps(b.universalProduct);
    expect(props.items).toHaveLength(b.universalProduct.faq.length);
  });

  it("buildOfferTiersProps formats per-unit and savings", () => {
    const b = fixturePublishedBundle();
    const props = buildOfferTiersProps(b.fanaaExtension);
    expect(props).toBeDefined();
    if (!props) return;
    expect(props.tiers).toHaveLength(3);
    expect(props.tiers[0].savingsVsTier1Percent).toBe(0);
    expect(props.tiers[1].savingsVsTier1Percent).toBeGreaterThan(0);
    expect(props.tiers[2].savingsVsTier1Percent).toBeGreaterThan(
      props.tiers[1].savingsVsTier1Percent,
    );
  });

  it("buildOfferTiersProps returns undefined when no tiers", () => {
    const b = fixturePublishedBundle();
    delete b.fanaaExtension?.offerTiers;
    const props = buildOfferTiersProps(b.fanaaExtension);
    expect(props).toBeUndefined();
  });

  it("buildTaxonomyProps surfaces every fanaa-extension field", () => {
    const b = fixturePublishedBundle();
    const props = buildTaxonomyProps(b.fanaaExtension);
    expect(props.sku).toBe("FN-GLOW-001");
    expect(props.productType).toBe("serum");
    expect(props.target).toBe("women");
    expect(props.problems).toContain("dryness");
  });

  it("buildNicheProps returns undefined when extension is missing", () => {
    const props = buildNicheProps(undefined);
    expect(props).toBeUndefined();
  });

  it("buildProvenanceProps mirrors UniversalProduct.sources", () => {
    const b = fixturePublishedBundle();
    const props = buildProvenanceProps(b.universalProduct);
    expect(props.supplierUrl).toBe("https://example.com/glow-serum");
    expect(props.generationRunId).toBe("run_test_001");
  });

  it("buildHooksProps returns the hooks unchanged", () => {
    const b = fixturePublishedBundle();
    const props = buildHooksProps(b.universalProduct);
    expect(props.items).toHaveLength(b.universalProduct.hooks.length);
  });

  it("buildSpecsProps returns [] when missing", () => {
    const b = fixturePublishedBundle();
    const props = buildSpecsProps(b.universalProduct);
    expect(props.items).toEqual([]);
    expect(props.certifications).toEqual([]);
  });
});

describe("resolveImageUrl", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.STUDIO_ASSETS_CDN_BASE;
    delete process.env.STUDIO_ASSETS_CDN_BASE;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.STUDIO_ASSETS_CDN_BASE;
    else process.env.STUDIO_ASSETS_CDN_BASE = prev;
  });

  it("passes absolute https URLs through unchanged", () => {
    expect(resolveImageUrl("https://example.com/x.jpg")).toBe(
      "https://example.com/x.jpg",
    );
  });

  it("passes data: URLs through unchanged", () => {
    expect(resolveImageUrl("data:image/svg+xml;base64,abc")).toBe(
      "data:image/svg+xml;base64,abc",
    );
  });

  it("returns placeholder:// for R2 keys when no CDN configured", () => {
    expect(resolveImageUrl("stores/fanaa/products/up_x/hero.webp")).toBe(
      "placeholder://stores/fanaa/products/up_x/hero.webp",
    );
  });

  it("prepends STUDIO_ASSETS_CDN_BASE when set", () => {
    process.env.STUDIO_ASSETS_CDN_BASE = "https://cdn.fanaa.com";
    expect(resolveImageUrl("stores/fanaa/products/up_x/hero.webp")).toBe(
      "https://cdn.fanaa.com/stores/fanaa/products/up_x/hero.webp",
    );
  });

  it("handles trailing slash on CDN base", () => {
    process.env.STUDIO_ASSETS_CDN_BASE = "https://cdn.fanaa.com/";
    expect(resolveImageUrl("stores/fanaa/x.webp")).toBe(
      "https://cdn.fanaa.com/stores/fanaa/x.webp",
    );
  });

  it("returns placeholder://missing for empty src", () => {
    expect(resolveImageUrl("")).toBe("placeholder://missing");
  });
});

describe("formatMoney", () => {
  it("formats SAR minor units as XXX.XX SAR", () => {
    expect(formatMoney({ amount: 19900, currency: "SAR" })).toBe("199.00 SAR");
  });

  it("formats with thousand separators", () => {
    expect(formatMoney({ amount: 1234500, currency: "USD" })).toBe("12,345.00 USD");
  });
});

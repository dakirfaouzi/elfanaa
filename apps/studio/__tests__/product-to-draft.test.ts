import { describe, expect, it } from "vitest";
import type { UniversalProduct } from "@platform/catalog-schema";
import {
  DraftDocumentSchema,
  type DraftDocument,
} from "@platform/builder-schema";
import { productToDraftDocument } from "../lib/studio/product-to-draft";

/**
 * Deterministic id generator — tests pin section ids so payload diffs
 * are diff-readable.
 */
function makeIdGen(): () => string {
  let n = 0;
  return () => `sec_${++n}`;
}

function makeFixture(overrides: Partial<UniversalProduct> = {}): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-serum",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: "2026-01-15T10:00:00.000Z",
    title: { ar: "سيروم العناية", en: "Glow Serum" },
    description: {
      ar: "سيروم مرطب يومي للبشرة الجافة.",
      en: "Daily hydrating serum for dry skin.",
    },
    headline: { ar: "بشرة مشرقة", en: "Radiant skin" },
    subheadline: { ar: "ترطيب مكثّف.", en: "Deep hydration." },
    benefits: [
      {
        icon: "Droplets",
        title: { ar: "ترطيب عميق", en: "Deep hydration" },
        body: { ar: "ترطيب ٢٤ ساعة.", en: "24-hour hydration." },
      },
      {
        icon: "Sparkles",
        title: { ar: "إشراقة", en: "Glow" },
        body: { ar: "إشراقة فورية.", en: "Instant glow." },
      },
    ],
    images: [
      {
        src: "stores/fanaa/products/up_test_001/hero.webp",
        alt: { ar: "زجاجة السيروم", en: "Serum bottle" },
        width: 1200,
        height: 1500,
      },
      {
        src: "stores/fanaa/products/up_test_001/gallery-1.webp",
        alt: { ar: "تطبيق", en: "Application" },
        width: 1200,
        height: 1500,
      },
    ],
    reviews: [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: { ar: "ممتاز.", en: "Excellent." },
        date: "2026-01-10",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل آمن؟", en: "Is it safe?" },
        a: { ar: "نعم.", en: "Yes." },
      },
    ],
    priceHint: { amount: 19900, currency: "SAR" },
    hooks: [
      {
        angle: "emotional",
        body: { ar: "تألقي.", en: "Glow up." },
        cta: { ar: "اطلبي", en: "Order" },
      },
    ],
    sources: {
      supplierUrl: "https://example.com/serum",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: ["uploads/intake-1.jpg"],
    },
    ...overrides,
  };
}

describe("productToDraftDocument", () => {
  // ── Shape + schema validation ──────────────────────────────────────

  it("produces a DraftDocument that round-trips through the builder schema", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "glow-serum",
      newId: makeIdGen(),
    });
    // Round-trip through the schema to guarantee the payload won't
    // bounce when the operator opens the canvas. This is the most
    // load-bearing assertion in this file.
    const parsed = DraftDocumentSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
    if (!parsed.success) console.error(parsed.error.format());
  });

  it("populates meta with title (bilingual), description, and OG image", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "glow-serum",
      newId: makeIdGen(),
    });
    expect(doc.meta.slug).toBe("glow-serum");
    expect(doc.meta.title).toEqual({ ar: "سيروم العناية", en: "Glow Serum" });
    expect(doc.meta.description?.en).toBe("Daily hydrating serum for dry skin.");
    expect(doc.meta.ogImage).toBe(
      "stores/fanaa/products/up_test_001/hero.webp",
    );
  });

  // ── Hero ───────────────────────────────────────────────────────────

  it("hero prefers headline/subheadline over title/description and uses first image as media", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const hero = doc.sections.find((s) => s.kind === "hero");
    expect(hero).toBeDefined();
    if (hero?.kind !== "hero") throw new Error("not a hero");
    expect(hero.title.ar).toBe("بشرة مشرقة");
    expect(hero.subtitle?.en).toBe("Deep hydration.");
    expect(hero.media?.kind).toBe("image");
    expect(hero.media?.desktopSrc).toBe(
      "stores/fanaa/products/up_test_001/hero.webp",
    );
    expect(hero.ctaLabel?.ar).toBe("اطلبي"); // hook CTA
    expect(hero.ctaHref).toBe("#order");
  });

  it("hero falls back to title when headline missing", () => {
    const doc = productToDraftDocument(
      makeFixture({ headline: undefined, subheadline: undefined }),
      { slug: "x", newId: makeIdGen() },
    );
    const hero = doc.sections.find((s) => s.kind === "hero");
    if (hero?.kind !== "hero") throw new Error("not a hero");
    expect(hero.title.ar).toBe("سيروم العناية");
    expect(hero.subtitle?.en).toBe("Daily hydrating serum for dry skin.");
  });

  // ── Conditional sections ───────────────────────────────────────────

  it("omits benefits section when benefits empty", () => {
    const doc = productToDraftDocument(
      makeFixture({ benefits: [] }),
      { slug: "x", newId: makeIdGen() },
    );
    expect(doc.sections.find((s) => s.kind === "benefits")).toBeUndefined();
  });

  it("emits benefits with carried-through icon names", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const benefits = doc.sections.find((s) => s.kind === "benefits");
    if (benefits?.kind !== "benefits") throw new Error("not a benefits section");
    expect(benefits.items.map((i) => i.icon)).toEqual(["Droplets", "Sparkles"]);
  });

  it("benefits with exactly 4 items uses 2 columns (balanced 2x2)", () => {
    const fourBenefits = [...Array(4)].map((_, i) => ({
      icon: "Star",
      title: { ar: `ميزة ${i}`, en: `Benefit ${i}` },
      body: { ar: "نص", en: "body" },
    }));
    const doc = productToDraftDocument(
      makeFixture({ benefits: fourBenefits }),
      { slug: "x", newId: makeIdGen() },
    );
    const benefits = doc.sections.find((s) => s.kind === "benefits");
    if (benefits?.kind !== "benefits") throw new Error("not a benefits section");
    expect(benefits.columns).toBe(2);
  });

  it("omits gallery when only one image (already in hero)", () => {
    const fixture = makeFixture();
    fixture.images = [fixture.images[0]];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    expect(doc.sections.find((s) => s.kind === "image_gallery")).toBeUndefined();
  });

  it("gallery skips the hero image when emitted", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const gallery = doc.sections.find((s) => s.kind === "image_gallery");
    if (gallery?.kind !== "image_gallery") throw new Error("not a gallery");
    expect(gallery.items).toHaveLength(1);
    expect(gallery.items[0].desktopSrc).toBe(
      "stores/fanaa/products/up_test_001/gallery-1.webp",
    );
  });

  // ── Testimonials / FAQ ─────────────────────────────────────────────

  it("testimonials prefer Arabic name and carry rating + city", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const t = doc.sections.find((s) => s.kind === "testimonials");
    if (t?.kind !== "testimonials") throw new Error("not testimonials");
    expect(t.items[0].author).toBe("نورة");
    expect(t.items[0].city).toBe("الرياض");
    expect(t.items[0].rating).toBe(5);
  });

  it("FAQ items carry q + a as localised pairs", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const faq = doc.sections.find((s) => s.kind === "faq");
    if (faq?.kind !== "faq") throw new Error("not faq");
    expect(faq.items[0].question.ar).toBe("هل آمن؟");
    expect(faq.items[0].answer.en).toBe("Yes.");
  });

  // ── CTA + Sticky CTA ───────────────────────────────────────────────

  it("CTA always emitted; uses hook CTA labels when present", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const cta = doc.sections.find((s) => s.kind === "cta");
    if (cta?.kind !== "cta") throw new Error("not cta");
    expect(cta.primaryLabel.ar).toBe("اطلبي");
    expect(cta.primaryLabel.en).toBe("Order");
    expect(cta.primaryHref).toBe("#order");
  });

  it("CTA falls back to generic bilingual labels when no hooks", () => {
    const doc = productToDraftDocument(
      makeFixture({ hooks: [] }),
      { slug: "x", newId: makeIdGen() },
    );
    const cta = doc.sections.find((s) => s.kind === "cta");
    if (cta?.kind !== "cta") throw new Error("not cta");
    expect(cta.primaryLabel.ar).toBe("اطلبي الآن");
    expect(cta.primaryLabel.en).toBe("Order now");
  });

  it("sticky CTA emitted iff at least one hook exists", () => {
    const withHooks = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    const withoutHooks = productToDraftDocument(
      makeFixture({ hooks: [] }),
      { slug: "x", newId: makeIdGen() },
    );
    expect(
      withHooks.sections.some((s) => s.kind === "sticky_cta"),
    ).toBe(true);
    expect(
      withoutHooks.sections.some((s) => s.kind === "sticky_cta"),
    ).toBe(false);
  });

  // ── Determinism / ids ──────────────────────────────────────────────

  it("section ids come from the supplied newId callback", () => {
    const ids: string[] = [];
    const newId = (): string => {
      const id = `pin_${ids.length}`;
      ids.push(id);
      return id;
    };
    const doc: DraftDocument = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId,
    });
    // Every section id should be one of the issued pins.
    for (const s of doc.sections) {
      expect(s.id.startsWith("pin_")).toBe(true);
    }
  });
});

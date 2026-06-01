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

  it("carries the FULL lifestyle scene pool into croContent (Phase 4.6.2)", () => {
    const doc = productToDraftDocument(
      makeFixture({
        lifestyleImages: [
          { src: "stores/fanaa/products/up_test_001/scene-1.webp", alt: { ar: "أ", en: "ritual" } },
          { src: "stores/fanaa/products/up_test_001/scene-2.webp", alt: { ar: "ب", en: "result" } },
          { src: "stores/fanaa/products/up_test_001/scene-3.webp", alt: { ar: "ج", en: "detail" } },
        ],
      }),
      { slug: "glow-serum", newId: makeIdGen() },
    );
    const cro = doc.croContent as {
      lifestyleImages?: { src: string }[];
      lifestyleImage?: { src: string };
    };
    expect(cro.lifestyleImages).toHaveLength(3);
    expect(cro.lifestyleImages?.[2]?.src).toContain("scene-3.webp");
    // Back-compat single still points at the first scene.
    expect(cro.lifestyleImage?.src).toContain("scene-1.webp");
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

  // ── Founder's note (Step 4 — reclaimed from assemble drop) ─────────

  it("emits a narrow rich_text founders note iff foundersNote has a locale", () => {
    const withNote = productToDraftDocument(
      makeFixture({
        foundersNote: {
          ar: "بدأنا من مطبخنا.",
          en: "We started in our own kitchen.",
        },
      }),
      { slug: "x", newId: makeIdGen() },
    );
    const note = withNote.sections.find((s) => s.kind === "rich_text");
    expect(note).toBeDefined();
    if (note?.kind !== "rich_text") throw new Error("not rich_text");
    expect(note.width).toBe("narrow");
    expect(note.body.en).toBe("We started in our own kitchen.");

    const withoutNote = productToDraftDocument(makeFixture(), {
      slug: "x",
      newId: makeIdGen(),
    });
    expect(
      withoutNote.sections.some((s) => s.kind === "rich_text"),
    ).toBe(false);
  });

  it("orders the founders note after testimonials and before faq", () => {
    const doc = productToDraftDocument(
      makeFixture({
        foundersNote: { ar: "قصتنا.", en: "Our story." },
      }),
      { slug: "x", newId: makeIdGen() },
    );
    const kinds = doc.sections.map((s) => s.kind);
    const testimonialsIdx = kinds.indexOf("testimonials");
    const noteIdx = kinds.indexOf("rich_text");
    const faqIdx = kinds.indexOf("faq");
    expect(testimonialsIdx).toBeGreaterThanOrEqual(0);
    expect(noteIdx).toBeGreaterThan(testimonialsIdx);
    expect(faqIdx).toBeGreaterThan(noteIdx);
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

  // ── Hardening against Claude's realistic output quirks ─────────────
  //
  // These tests are derived from the production failure where the
  // mapper produced a payload that failed `DraftDocumentSchema.safeParse`
  // and the editor fell back to `makeBlankDraft()`. The root causes
  // were: (a) Claude emits `null` (not undefined) for missing locale
  // fields, and (b) `??` chains in the previous mapper let empty
  // strings through into MediaRef.desktopSrc which then failed
  // `min(1)` validation.
  //
  // Each test below sets up a realistic-but-hostile UniversalProduct
  // shape, runs the mapper, and asserts the output STILL passes the
  // schema — i.e. the mapper is robust to the quirk.

  it("survives null locale fields anywhere in the product (Claude quirk)", () => {
    // Anthropic's structured outputs sometimes serialise a missing
    // locale as JSON null instead of omitting the key. The builder
    // schema rejects null for `z.string().optional()` so we MUST
    // normalise.
    //
    // The compile-time `LocalizedString` shape is strict
    // (`Record<Locale, string>`) — production runtime is looser. We
    // cast the whole fixture through `unknown` to simulate the
    // runtime shape; the entire point of this test is that the
    // mapper survives values that the type system would normally
    // forbid.
    const hostile = {
      ...makeFixture(),
      title: { ar: "العنوان", en: null },
      headline: { ar: null, en: "Radiant skin" },
      subheadline: { ar: null, en: null },
      benefits: [
        {
          icon: "Droplets",
          title: { ar: "ترطيب", en: null },
          body: { ar: null, en: null },
        },
      ],
      reviews: [
        {
          name: { ar: null, en: "Sarah" },
          city: { ar: null, en: null },
          rating: 5,
          body: { ar: "نص", en: null },
          date: "2026-01-10",
        },
      ],
    } as unknown as UniversalProduct;
    const doc = productToDraftDocument(hostile, {
      slug: "x",
      newId: makeIdGen(),
    });
    const parsed = DraftDocumentSchema.safeParse(doc);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("\n");
      throw new Error(`schema parse failed:\n${issues}`);
    }
  });

  it("does not emit a hero MediaRef when image src is empty", () => {
    // MediaRefSchema requires `desktopSrc.min(1)`. An empty src in
    // the hero image must result in `media: null`, not a half-built
    // MediaRef that would fail array validation downstream.
    const fixture = makeFixture();
    fixture.images = [{ ...fixture.images[0], src: "" }];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const hero = doc.sections.find((s) => s.kind === "hero");
    if (hero?.kind !== "hero") throw new Error("not a hero");
    expect(hero.media).toBeNull();
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("filters gallery items with empty src instead of breaking the section", () => {
    const fixture = makeFixture();
    fixture.images = [
      fixture.images[0],
      { ...fixture.images[1], src: "" }, // poisoned gallery item
      { ...fixture.images[1], src: "stores/fanaa/products/up/g2.webp" },
    ];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const gallery = doc.sections.find((s) => s.kind === "image_gallery");
    if (gallery?.kind !== "image_gallery") throw new Error("not a gallery");
    expect(gallery.items).toHaveLength(1);
    expect(gallery.items[0].desktopSrc).toBe(
      "stores/fanaa/products/up/g2.webp",
    );
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("review with missing author name falls back to 'Verified buyer' instead of empty string", () => {
    // TestimonialItemSchema requires `author: z.string().max(160)` —
    // empty string is technically valid but renders as a missing
    // name in the canvas. Fall back to a sensible default.
    const fixture = {
      ...makeFixture(),
      reviews: [
        {
          name: { ar: undefined, en: undefined },
          city: { ar: "الرياض", en: "Riyadh" },
          rating: 5,
          body: { ar: "ممتاز", en: "Great" },
          date: "2026-01-10",
        },
      ],
    } as unknown as UniversalProduct;
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const t = doc.sections.find((s) => s.kind === "testimonials");
    if (t?.kind !== "testimonials") throw new Error("not testimonials");
    expect(t.items[0].author).toBe("Verified buyer");
  });

  it("rating out of bounds is dropped, not emitted as an invalid value", () => {
    // RatingSchema is z.number().min(1).max(5). A model that emits 0
    // or 6 must NOT take down the whole DraftDocument parse.
    const fixture = makeFixture();
    fixture.reviews = [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 0 as unknown as number,
        body: { ar: "ن", en: "n" },
        date: "2026-01-10",
      },
    ];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const t = doc.sections.find((s) => s.kind === "testimonials");
    if (t?.kind !== "testimonials") throw new Error("not testimonials");
    expect(t.items[0].rating).toBeUndefined();
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("CTA never emits empty primaryLabel even when hook.cta is empty", () => {
    const fixture = makeFixture();
    fixture.hooks = [
      {
        angle: "emotional",
        body: { ar: "ن", en: "n" },
        cta: { ar: "", en: "" }, // empty bilingual CTA
      },
    ];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const cta = doc.sections.find((s) => s.kind === "cta");
    if (cta?.kind !== "cta") throw new Error("not cta");
    // Falls back to the bilingual defaults, not the empty hook CTA.
    expect(cta.primaryLabel.ar).toBe("اطلبي الآن");
    expect(cta.primaryLabel.en).toBe("Order now");
  });

  // ── Schema constraint enforcement (length / pattern) ──────────────
  //
  // These tests are the regression suite for the third production
  // failure mode: the mapper produced valid-shaped output, but the
  // root DraftMetaSchema constraints (slug pattern, title 200 chars,
  // description 500 chars) were violated and the editor again fell
  // back to a blank canvas.

  it("normalises a runId-style slug with underscores into SLUG_PATTERN form", () => {
    const doc = productToDraftDocument(makeFixture(), {
      // Exact shape from production: dispatch wrote the runId
      // verbatim as `studio_draft.slug` because the original
      // runIdToSlug regex didn't strip a store prefix (no hyphen
      // in the runId to anchor on).
      slug: "run_mpiptq9l_pligqded",
      newId: makeIdGen(),
    });
    expect(doc.meta.slug).toBe("run-mpiptq9l-pligqded");
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("falls back to 'draft' when the slug source contains no ASCII alphanumerics", () => {
    // All-Arabic / all-emoji inputs collapse to an empty string
    // after the strip phase. DraftSlugSchema requires `min(1)` so
    // a fallback is mandatory.
    const doc = productToDraftDocument(makeFixture(), {
      slug: "العربية فقط 🌟",
      newId: makeIdGen(),
    });
    expect(doc.meta.slug).toBe("draft");
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("collapses repeated hyphens and strips leading/trailing dashes from slug", () => {
    const doc = productToDraftDocument(makeFixture(), {
      slug: "--abc...def!!!ghi--",
      newId: makeIdGen(),
    });
    expect(doc.meta.slug).toBe("abc-def-ghi");
  });

  it("clamps an over-length description to 500 chars with trailing ellipsis", () => {
    const longEn = "x".repeat(700);
    const longAr = "ي".repeat(700);
    const doc = productToDraftDocument(
      {
        ...makeFixture(),
        description: { ar: longAr, en: longEn },
      } as UniversalProduct,
      { slug: "x", newId: makeIdGen() },
    );
    expect(doc.meta.description?.en?.length).toBe(500);
    expect(doc.meta.description?.en?.endsWith("…")).toBe(true);
    expect(doc.meta.description?.ar?.length).toBe(500);
    expect(doc.meta.description?.ar?.endsWith("…")).toBe(true);
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("clamps an over-length title to 200 chars with trailing ellipsis", () => {
    const longEn = "Glow Serum ".repeat(40); // ~440 chars
    const doc = productToDraftDocument(
      { ...makeFixture(), title: { ar: "سيروم", en: longEn } } as UniversalProduct,
      { slug: "x", newId: makeIdGen() },
    );
    expect(doc.meta.title.en?.length).toBe(200);
    expect(doc.meta.title.en?.endsWith("…")).toBe(true);
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("clamps testimonial author at 160 chars (defends against model emitting a bio)", () => {
    const fixture = makeFixture();
    fixture.reviews = [
      {
        name: { ar: "نورة", en: "N".repeat(300) },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: { ar: "ن", en: "n" },
        date: "2026-01-10",
      },
    ];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const t = doc.sections.find((s) => s.kind === "testimonials");
    if (t?.kind !== "testimonials") throw new Error("not testimonials");
    // Author preferred ar="نورة" (4 chars) — under cap, no clamp.
    expect(t.items[0].author).toBe("نورة");
  });

  it("clamps testimonial city at 80 chars when ar/en preference forces a long value", () => {
    const fixture = makeFixture();
    fixture.reviews = [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "ر".repeat(200), en: "Riyadh" },
        rating: 5,
        body: { ar: "ن", en: "n" },
        date: "2026-01-10",
      },
    ];
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const t = doc.sections.find((s) => s.kind === "testimonials");
    if (t?.kind !== "testimonials") throw new Error("not testimonials");
    // City picks ar first (200 chars), clamped to 80 with ellipsis.
    expect(t.items[0].city?.length).toBe(80);
    expect(t.items[0].city?.endsWith("…")).toBe(true);
    expect(DraftDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("whitespace-only locale values are treated as missing", () => {
    // A model that emits "  " for a locale should be treated the
    // same as "" or null — render the placeholder, not a misleadingly
    // empty input field that hides the real signal from the operator.
    const fixture = {
      ...makeFixture(),
      headline: { ar: "   ", en: "\t\n" },
      subheadline: { ar: "ترطيب فعلي", en: "Real hydration" },
    } as UniversalProduct;
    const doc = productToDraftDocument(fixture, {
      slug: "x",
      newId: makeIdGen(),
    });
    const hero = doc.sections.find((s) => s.kind === "hero");
    if (hero?.kind !== "hero") throw new Error("not a hero");
    // Headline was whitespace-only → fell back to title.
    expect(hero.title.ar).toBe("سيروم العناية");
    expect(hero.title.en).toBe("Glow Serum");
    expect(hero.subtitle?.en).toBe("Real hydration");
  });
});

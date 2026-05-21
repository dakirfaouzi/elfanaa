import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { socialProof } from "../social-proof";
import { PipelineError } from "../types";
import type { SocialProofOutput } from "../types-social-proof";
import type { StrategyOutput } from "../types-strategy";
import {
  mockText,
  textResult,
} from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "إشراق.", en: "Glow." },
  persona: { ar: "ا", en: "a" },
  benefitAngles: [
    { label: "x", title: { ar: "ا", en: "x" }, body: { ar: "ا", en: "x" } },
    { label: "y", title: { ar: "ا", en: "y" }, body: { ar: "ا", en: "y" } },
    { label: "z", title: { ar: "ا", en: "z" }, body: { ar: "ا", en: "z" } },
  ],
  objections: [
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
  ],
  adAngles: ["emotional_transformation", "ingredient_authority", "ritual_aesthetic"],
};

const goodSocial: SocialProofOutput = {
  reviews: [
    {
      name: { ar: "نورة العتيبي", en: "Noura A." },
      city: { ar: "الرياض", en: "Riyadh" },
      rating: 5,
      body: {
        ar: "استخدمت السيروم لأسبوعين وفعلًا لاحظت فرق واضح في توحيد لون بشرتي.",
        en: "After two weeks of using this serum I genuinely noticed my skin tone evening out.",
      },
      date: "2025-12-15",
      verified: true,
    },
    {
      name: { ar: "سارة القحطاني", en: "Sarah Q." },
      city: { ar: "جدة", en: "Jeddah" },
      rating: 4,
      body: {
        ar: "خفيف وامتصاصه سريع، النتيجة حلوة بس ودي ريحته تكون أقل قوة شوي.",
        en: "Light and absorbs quickly, the result is nice but I wish the scent was a bit milder.",
      },
      date: "2025-12-10",
      verified: true,
    },
    {
      name: { ar: "هاجر الشمري", en: "Hajar S." },
      city: { ar: "الدمام", en: "Dammam" },
      rating: 5,
      body: {
        ar: "وصلت قبل اليوم الموعود، التغليف فخم والمنتج أفخم.",
        en: "Arrived before the expected day, the packaging is luxe and the product even better.",
      },
      date: "2025-12-05",
      verified: false,
    },
    {
      name: { ar: "ريم البلوي", en: "Reem B." },
      city: { ar: "مكة", en: "Mecca" },
      rating: 5,
      body: {
        ar: "أفضل سيروم جربته من حيث الترطيب، وبشرتي ما عادت تطفّش في البرد.",
        en: "Best serum I have tried for hydration; my skin no longer feels tight in cold weather.",
      },
      date: "2025-11-28",
      verified: true,
    },
  ],
  faq: [
    { q: { ar: "كم مدة الشحن؟", en: "How long is shipping?" }, a: { ar: "٢-٤ أيام عمل.", en: "2–4 business days." } },
    { q: { ar: "هل أدفع الآن؟", en: "Do I pay now?" }, a: { ar: "لا، الدفع عند الاستلام.", en: "No, pay on delivery." } },
    { q: { ar: "هل أقدر ألغي الطلب؟", en: "Can I cancel?" }, a: { ar: "نعم خلال ٤ ساعات.", en: "Yes within 4 hours." } },
    { q: { ar: "هل المنتج آمن للحامل؟", en: "Is it safe for pregnancy?" }, a: { ar: "استشيري طبيبك.", en: "Consult your physician." } },
    { q: { ar: "لماذا يتصل رقم سعودي؟", en: "Why a Saudi number?" }, a: { ar: "فريقنا في السعودية.", en: "Our team is based in Saudi Arabia." } },
  ],
  hooks: [
    { angle: "emotional_transformation", body: { ar: "بشرة تشرق من الداخل.", en: "Skin that glows from within." }, cta: { ar: "اطلبي الآن", en: "Shop now" } },
    { angle: "ingredient_authority", body: { ar: "تركيبة بمكونات نشطة مدروسة.", en: "Formulated with proven actives." }, cta: { ar: "اكتشفي", en: "Discover" } },
    { angle: "ritual_aesthetic", body: { ar: "روتين راقٍ كل صباح.", en: "A refined morning ritual." }, cta: { ar: "ابدئي", en: "Begin" } },
    { angle: "scarcity_urgency", body: { ar: "الكمية محدودة هذا الشهر.", en: "Limited stock this month." }, cta: { ar: "احجزي", en: "Reserve" } },
    { angle: "saudi_authenticity", body: { ar: "بفهمنا لبشرة المنطقة.", en: "Crafted with regional skin in mind." }, cta: { ar: "تعرفي", en: "Learn more" } },
  ],
};

describe("social-proof (stage 10)", () => {
  it("returns reviews / FAQ / hooks on the happy path", async () => {
    const t = mockText({ responses: [textResult(goodSocial)] });

    const out = await socialProof({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_social_1",
    });

    expect(out.reviews).toHaveLength(4);
    expect(out.faq).toHaveLength(5);
    expect(out.hooks).toHaveLength(5);
    expect(t.calls).toHaveLength(1);
  });

  it("retries once when reviewer names are not varied enough", async () => {
    const sameName: SocialProofOutput = {
      ...goodSocial,
      reviews: goodSocial.reviews.map((r) => ({
        ...r,
        name: { ar: "نورة العتيبي", en: "Noura A." },
      })),
    };

    const t = mockText({
      responses: [textResult(sameName), textResult(goodSocial)],
    });

    const out = await socialProof({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_social_2",
    });

    expect(out.reviews[0]?.name.ar).toBe("نورة العتيبي");
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].system).toContain("realism checks");
  });

  it("retries once when reviews lack Arabic content", async () => {
    const englishOnlyReviews: SocialProofOutput = {
      ...goodSocial,
      reviews: goodSocial.reviews.map((r, i) => ({
        ...r,
        body: {
          ar: `n/a${i}`,
          en: "Decent product, did the job and I would buy again next month.",
        },
      })),
    };

    const t = mockText({
      responses: [textResult(englishOnlyReviews), textResult(goodSocial)],
    });

    const out = await socialProof({
      input: { strategy: dummyStrategy },
      providers: { text: t.provider },
      storeConfig: fanaaStore,
      runId: "run_test_social_3",
    });

    expect(out.reviews[0]?.body.ar.length).toBeGreaterThan(30);
    expect(t.calls).toHaveLength(2);
  });

  it("throws PipelineError when realism keeps failing after retry", async () => {
    const tooShortReviews: SocialProofOutput = {
      ...goodSocial,
      reviews: goodSocial.reviews.map((r) => ({
        ...r,
        body: { ar: "حلو.", en: "Nice." },
      })),
    };

    const t = mockText({
      responses: [textResult(tooShortReviews), textResult(tooShortReviews)],
    });

    await expect(
      socialProof({
        input: { strategy: dummyStrategy },
        providers: { text: t.provider },
        storeConfig: fanaaStore,
        runId: "run_test_social_4",
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});

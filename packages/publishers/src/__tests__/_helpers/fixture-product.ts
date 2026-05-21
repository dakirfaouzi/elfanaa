import type { UniversalProduct } from "@platform/catalog-schema";

/**
 * Canonical UniversalProduct fixture used by the M7 test suite.
 *
 * # Choices baked into this fixture
 *
 *   • niche = "beauty_wellness" — exercises BeautyWellnessExtension
 *     inference and the ingredient code path.
 *   • storeContext = "fanaa"    — matches fanaaStore.id so the
 *     consistency check passes.
 *   • title contains "Serum" / "سيروم" — productType inference hits
 *     "serum".
 *   • copy contains "dryness" / "جفاف" — problems inference hits
 *     "dryness".
 *   • copy contains "women" / "للنساء" — target inference hits "women".
 *   • copy contains "hydration" / "ترطيب" — concerns inference hits
 *     "hydration".
 *   • priceHint = 199.00 SAR (19900 minor units) — triggers a
 *     three-tier offerTiers ladder.
 *   • generatedAt is FIXED — publishedAt mirrors it for replay parity.
 *
 * Mutating this fixture invalidates the schema-drift test by design.
 */
export const FIXTURE_GENERATED_AT = "2026-01-15T10:00:00.000Z";

export function fixtureUniversalProduct(): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-serum-test",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: FIXTURE_GENERATED_AT,

    title: {
      ar: "سيروم العناية المضيء",
      en: "Glow Care Serum",
    },
    description: {
      ar: "سيروم مرطب للبشرة، يعالج جفاف البشرة ويمنحها الترطيب اليومي. مناسب للنساء.",
      en: "A hydrating serum for women that targets dryness and delivers daily hydration.",
    },
    headline: { ar: "بشرة مشرقة في 14 يوم", en: "Radiant skin in 14 days" },
    subheadline: {
      ar: "ترطيب يومي مكثّف بدون لمعة.",
      en: "Deep daily hydration, never greasy.",
    },

    benefits: [
      {
        icon: "Droplets",
        title: { ar: "ترطيب عميق", en: "Deep hydration" },
        body: {
          ar: "ترطيب عميق يدوم 24 ساعة ويعالج جفاف البشرة.",
          en: "24-hour hydration that addresses dryness.",
        },
      },
      {
        icon: "Sparkles",
        title: { ar: "إشراقة فورية", en: "Instant glow" },
        body: {
          ar: "مظهر مشرق فور التطبيق.",
          en: "Glowing skin from first use.",
        },
      },
    ],

    ingredients: [
      {
        name: { ar: "حمض الهيالورونيك", en: "Hyaluronic acid" },
        role: { ar: "يرطّب البشرة بعمق", en: "Hydrates deeply" },
        inci: "Sodium Hyaluronate",
      },
      {
        name: { ar: "نياسيناميد", en: "Niacinamide" },
        role: { ar: "يوحّد لون البشرة", en: "Evens skin tone" },
        inci: "Niacinamide",
      },
    ],

    images: [
      {
        src: "stores/fanaa/products/up_test_001/hero.webp",
        alt: { ar: "سيروم العناية المضيء", en: "Glow Care Serum bottle" },
        width: 1200,
        height: 1500,
      },
      {
        src: "stores/fanaa/products/up_test_001/gallery-1.webp",
        alt: { ar: "تطبيق السيروم", en: "Serum application" },
        width: 1200,
        height: 1500,
      },
    ],

    reviews: [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "بشرتي صارت مرطبة وأكثر إشراقاً.",
          en: "My skin feels hydrated and glowing.",
        },
        date: "2026-01-10",
        verified: true,
      },
      {
        name: { ar: "سارة", en: "Sara" },
        city: { ar: "جدة", en: "Jeddah" },
        rating: 4,
        body: {
          ar: "ترطيب رائع وملمس خفيف.",
          en: "Great hydration, light texture.",
        },
        date: "2026-01-12",
      },
    ],

    faq: [
      {
        q: { ar: "هل مناسب للبشرة الحساسة؟", en: "Is it suitable for sensitive skin?" },
        a: {
          ar: "نعم، خالٍ من العطور والكحول.",
          en: "Yes — fragrance-free and alcohol-free.",
        },
      },
      {
        q: { ar: "متى تظهر النتائج؟", en: "How quickly will I see results?" },
        a: {
          ar: "ترطيب فوري، وإشراقة ملحوظة خلال أسبوعين.",
          en: "Hydration is instant; visible glow within two weeks.",
        },
      },
    ],

    priceHint: { amount: 19900, currency: "SAR" },

    hooks: [
      {
        angle: "emotional",
        body: {
          ar: "أعيدي لبشرتكِ التألق الذي تستحقّينه.",
          en: "Bring back the glow your skin deserves.",
        },
        cta: { ar: "اطلبي الآن", en: "Order now" },
      },
    ],

    sources: {
      supplierUrl: "https://example.com/glow-serum",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: ["uploads/op_test/intake-1.jpg"],
    },
  };
}

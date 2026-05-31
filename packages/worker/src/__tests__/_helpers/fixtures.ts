/**
 * Worker-test happy-path fixtures.
 *
 * Provides:
 *   • Canned MODEL responses for the 5 text-providered stages.
 *   • Canned vision MODEL response for stage 03.
 *   • Canned scrape result for stage 02.
 *   • Canned image-gen results for stage 08.
 *   • Canned embedding for stage 11.
 *   • A reusable IngestJob shaped for the Fanaa store.
 *
 * These fixtures match the M5 per-stage tests so the orchestrator can
 * run the full 11-stage pipeline end-to-end with mocked providers.
 */
import type {
  CopyOutput,
  CreativePromptsOutput,
  ImageGenOutput,
  ImagePostOutput,
  ResearchOutput,
  SectionContentOutput,
  SocialProofOutput,
  StrategyOutput,
  UpsellMatchOutput,
  VisionOutput,
} from "@platform/ai-engine";
import type {
  ImageResult,
  ScrapeResult,
  TextResult,
  VisionResult,
} from "@platform/ai-engine";
import type { IngestJob } from "@platform/ingest";

export const FIXTURE_RUN_ID = "run_worker_test";

export const fixtureIngestJob: IngestJob = {
  runId: FIXTURE_RUN_ID,
  storeId: "fanaa",
  supplierUrl: "https://supplier.example/p/serum",
  uploadedImages: [
    { src: "https://supplier.example/img/1.jpg", alt: "front" },
  ],
  priceHint: { amount: 199, currency: "SAR" },
  operatorNotes: "luxury beauty product",
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ── Stage 02 — Research ──────────────────────────────────────────────────

export const fixtureScrapeResult: ScrapeResult = {
  url: "https://supplier.example/p/serum",
  title: "Mock Serum",
  description: "Mock serum description.",
  markdown: "# Mock Serum\n\nNice product.",
  images: [
    {
      src: "https://supplier.example/img/1.jpg",
      alt: "front",
      width: 800,
      height: 800,
    },
  ],
  links: [],
  language: "en",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  durationMs: 100,
  providerId: "firecrawl",
  costUsd: 0.01,
};

// ── Stage 03 — Vision (model response shape) ──────────────────────────────

export const fixtureVisionModelResponse = {
  productCategory: "face serum",
  formFactor: "30ml dropper bottle",
  visibleColors: ["amber", "gold"],
  packagingMaterial: "glass",
  visibleText: "GLOW SERUM",
  labelLanguages: ["en"],
  approximateSize: "small",
  visualHooks: ["dropper", "amber_glass"],
  confidence: 0.85,
  notes: "Standard editorial product shot.",
};

// ── Stage 04 — Strategy ──────────────────────────────────────────────────

export const fixtureStrategy: StrategyOutput = {
  heroPromise: { ar: "إشراق يومي طبيعي.", en: "Daily natural glow." },
  persona: {
    ar: "امرأة سعودية تهتم بالعناية بالبشرة.",
    en: "A Saudi woman who values her skincare ritual.",
  },
  benefitAngles: [
    {
      label: "tone",
      title: { ar: "توحيد لون البشرة", en: "Even skin tone" },
      body: {
        ar: "يساعد على تفتيح البقع تدريجيًا.",
        en: "Gradually brightens uneven patches.",
      },
    },
    {
      label: "hydration",
      title: { ar: "ترطيب عميق", en: "Deep hydration" },
      body: {
        ar: "يحبس الرطوبة طوال اليوم.",
        en: "Locks in moisture all day.",
      },
    },
    {
      label: "glow",
      title: { ar: "إشراق طبيعي", en: "Natural glow" },
      body: {
        ar: "نتيجة طبيعية من أول استعمال.",
        en: "Natural finish from the first use.",
      },
    },
  ],
  objections: [
    {
      objection: {
        ar: "هل آمن للبشرة الحساسة؟",
        en: "Is it safe for sensitive skin?",
      },
      neutraliser: {
        ar: "تركيبة خفيفة بدون كحول.",
        en: "Lightweight alcohol-free formula.",
      },
    },
    {
      objection: { ar: "متى أشوف النتائج؟", en: "When will I see results?" },
      neutraliser: {
        ar: "تحسن ملحوظ خلال أسبوعين.",
        en: "Noticeable improvement within two weeks.",
      },
    },
  ],
  adAngles: [
    "emotional_transformation",
    "ingredient_authority",
    "ritual_aesthetic",
  ],
};

// ── Stage 05 — Structure ─────────────────────────────────────────────────
// The structure stage is DETERMINISTIC as of Step 4 §4.3 (ADR-S4-2): it
// computes the section ordering from awareness/sophistication targeting and
// makes no provider call, so there is no model-response fixture for it.

// ── Stage 06 — Copy ──────────────────────────────────────────────────────

export const fixtureCopy: CopyOutput = {
  title: { ar: "سيروم النور", en: "Glow Serum" },
  headline: { ar: "إشراق يومي طبيعي.", en: "Daily natural glow." },
  subheadline: {
    ar: "للبشرة الحساسة والعادية.",
    en: "For sensitive and normal skin.",
  },
  description: {
    ar: "سيروم خفيف يمنح البشرة ترطيبًا وإشراقًا من أول استعمال.",
    en: "A lightweight serum that hydrates and brightens from the first use.",
  },
  benefits: [
    {
      icon: "Sparkles",
      title: { ar: "إشراق طبيعي", en: "Natural glow" },
      body: {
        ar: "نتيجة فورية مع الاستعمال المنتظم.",
        en: "Immediate finish with regular use.",
      },
    },
    {
      icon: "Droplet",
      title: { ar: "ترطيب عميق", en: "Deep hydration" },
      body: {
        ar: "يحبس الرطوبة لمدة طويلة.",
        en: "Locks in moisture for hours.",
      },
    },
    {
      icon: "Shield",
      title: { ar: "حماية يومية", en: "Daily protection" },
      body: {
        ar: "يحمي البشرة من التهيج.",
        en: "Protects skin from daily irritation.",
      },
    },
  ],
};

// ── Stage 07 — Creative prompts ───────────────────────────────────────────

export const fixtureCreativePrompts: CreativePromptsOutput = {
  hero: {
    prompt:
      "Studio product photograph of an amber glass dropper serum bottle on a warm cream backdrop, soft directional light from the upper left, subtle olive-tan accents, premium minimalist composition, shallow depth of field, high resolution.",
    negative: "text, watermark, hands, glare, blur",
    aspectRatio: "1:1",
  },
  lifestyle: [
    {
      prompt:
        "Editorial lifestyle photograph of a Saudi woman applying serum at a sunlit Riyadh window, soft warm tones, brand palette of cream and rose gold, premium beauty editorial aesthetic.",
      negative: "text, watermark",
      aspectRatio: "4:5",
      intent: "morning_ritual",
    },
  ],
};

// ── Stage 08 — Image gen (3 results: 1 hero + 1 lifestyle) ────────────────

export function fixtureImageResults(): ImageResult[] {
  return [
    {
      url: "https://cdn.mock/hero.webp",
      width: 1024,
      height: 1024,
      costUsd: 0.04,
      latencyMs: 100,
      model: "mock-flux",
      providerId: "fal",
    },
    {
      url: "https://cdn.mock/lifestyle-1.webp",
      width: 1024,
      height: 1280,
      costUsd: 0.04,
      latencyMs: 100,
      model: "mock-flux",
      providerId: "fal",
    },
  ];
}

// ── Stage 09 — Image post (purely derived; not mocked) ────────────────────
// Stage 09 takes imageGen + copy and produces ImagePostOutput. No mock needed.

// ── Stage 10 — Social proof ───────────────────────────────────────────────

export const fixtureSocialProof: SocialProofOutput = {
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
        en: "Light and absorbs quickly; the result is nice but I wish the scent were milder.",
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
        ar: "أفضل سيروم جربته من حيث الترطيب.",
        en: "Best serum I have tried for hydration.",
      },
      date: "2025-11-28",
      verified: true,
    },
  ],
  faq: [
    {
      q: { ar: "كم مدة الشحن؟", en: "How long is shipping?" },
      a: { ar: "٢-٤ أيام عمل.", en: "2–4 business days." },
    },
    {
      q: { ar: "هل أدفع الآن؟", en: "Do I pay now?" },
      a: { ar: "لا، الدفع عند الاستلام.", en: "No, pay on delivery." },
    },
    {
      q: { ar: "هل أقدر ألغي الطلب؟", en: "Can I cancel?" },
      a: { ar: "نعم خلال ٤ ساعات.", en: "Yes within 4 hours." },
    },
    {
      q: { ar: "هل المنتج آمن للحامل؟", en: "Is it safe for pregnancy?" },
      a: { ar: "استشيري طبيبك.", en: "Consult your physician." },
    },
    {
      q: { ar: "لماذا يتصل رقم سعودي؟", en: "Why a Saudi number?" },
      a: { ar: "فريقنا في السعودية.", en: "Our team is based in Saudi Arabia." },
    },
  ],
  hooks: [
    {
      angle: "emotional",
      body: { ar: "بشرتك تستحق الإشراق.", en: "Your skin deserves to glow." },
      cta: { ar: "اطلبيه الآن.", en: "Order now." },
    },
    {
      angle: "story",
      body: {
        ar: "صنعنا هذا السيروم بحب.",
        en: "We crafted this serum with care.",
      },
      cta: { ar: "جربيه الآن.", en: "Try it now." },
    },
  ],
};

// ── Stage 11b — Section content (Step 4) ────────────────────────────────────

export const fixtureSectionContent: SectionContentOutput = {
  howItWorks: {
    summary: {
      ar: "يعمل السيروم على ترطيب البشرة وتوحيد لونها من أول استخدام.",
      en: "The serum hydrates the skin and evens its tone from the first use.",
    },
    steps: [
      {
        title: { ar: "يخترق الطبقات", en: "Penetrates deeply" },
        body: {
          ar: "تركيبة خفيفة تصل إلى عمق البشرة بسرعة.",
          en: "A light formula reaches deep into the skin quickly.",
        },
      },
      {
        title: { ar: "يرطب ويوحد", en: "Hydrates and evens" },
        body: {
          ar: "يحبس الترطيب ويعمل على توحيد اللون تدريجيًا.",
          en: "It locks in moisture and evens tone gradually.",
        },
      },
    ],
  },
  ingredients: [
    {
      name: { ar: "حمض الهيالورونيك", en: "Hyaluronic acid" },
      role: {
        ar: "يرطب البشرة ويملؤها.",
        en: "Hydrates and plumps the skin.",
      },
    },
    {
      name: { ar: "فيتامين سي", en: "Vitamin C" },
      role: {
        ar: "يوحد لون البشرة ويمنحها إشراقة.",
        en: "Evens tone and adds radiance.",
      },
    },
  ],
  results: {
    timeline: [
      {
        when: { ar: "أول استخدام", en: "First use" },
        outcome: {
          ar: "ترطيب فوري وملمس أنعم.",
          en: "Instant hydration and a softer feel.",
        },
      },
      {
        when: { ar: "بعد أسبوعين", en: "After two weeks" },
        outcome: {
          ar: "لون أكثر توحدًا وإشراقة واضحة.",
          en: "More even tone and visible radiance.",
        },
      },
    ],
  },
  guarantee: {
    title: { ar: "الدفع عند الاستلام", en: "Cash on delivery" },
    body: {
      ar: "ادفع عند الاستلام، وإرجاع سهل خلال أيام.",
      en: "Pay on delivery, with easy returns within days.",
    },
  },
  comparison: {
    ours: [
      { ar: "تركيبة خفيفة سريعة الامتصاص.", en: "Light, fast-absorbing formula." },
      { ar: "نتائج مرئية خلال أسبوعين.", en: "Visible results within two weeks." },
    ],
    usual: [
      { ar: "ملمس دهني يبقى طويلًا.", en: "Greasy feel that lingers." },
      { ar: "نتائج بطيئة وغير ثابتة.", en: "Slow and inconsistent results." },
    ],
  },
};

// ── Stage 11 — Upsell match (we test with `emptyCatalog` so source: "empty") ─

export const fixtureUpsellEmpty: UpsellMatchOutput = {
  suggestedProductIds: [],
  source: "empty",
  durationMs: 0,
};

// Lifestyle-only image post output baseline (computed by stage 09 from the
// inputs above). Used for assertion convenience in some tests.
export const fixtureImagePost: ImagePostOutput = {
  hero: {
    src: "https://cdn.mock/hero.webp",
    alt: { ar: "إشراق يومي طبيعي.", en: "Daily natural glow." },
    width: 1024,
    height: 1024,
  },
  gallery: [],
  lifestyle: [
    {
      src: "https://cdn.mock/lifestyle-1.webp",
      alt: {
        ar: "إشراق يومي طبيعي. — morning_ritual",
        en: "Daily natural glow. — morning_ritual",
      },
      width: 1024,
      height: 1280,
    },
  ],
  postProcessed: false,
};

// Marker exports so tests can reference the canonical research/vision outputs
// without depending on the M5 stage's internal mapping logic.
export const fixtureResearchExpected: ResearchOutput = {
  supplierUrl: "https://supplier.example/p/serum",
  scrapedAt: fixtureScrapeResult.fetchedAt,
  skipped: false,
  title: "Mock Serum",
  description: "Mock serum description.",
  markdown: "# Mock Serum\n\nNice product.",
  language: "en",
  images: fixtureScrapeResult.images,
  links: [],
  costUsd: 0.01,
  providerId: "firecrawl",
  durationMs: 100,
};

export const fixtureVisionExpected: VisionOutput = {
  skipped: false,
  productCategory: "face serum",
  formFactor: "30ml dropper bottle",
  visibleColors: ["amber", "gold"],
  packagingMaterial: "glass",
  visibleText: "GLOW SERUM",
  labelLanguages: ["en"],
  approximateSize: "small",
  visualHooks: ["dropper", "amber_glass"],
  confidence: 0.85,
  notes: "Standard editorial product shot.",
  costUsd: 0,
};

// Helpers to build TextResult / VisionResult wrappers around the parsed shapes.
export function textResult<T>(
  parsed: T,
  overrides?: Partial<TextResult<T>>,
): TextResult<T> {
  return {
    text: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
    parsed,
    usage: { tokensIn: 100, tokensOut: 200 },
    costUsd: 0.05,
    latencyMs: 50,
    model: "mock-text",
    providerId: "anthropic",
    ...overrides,
  };
}

export function visionResult<T>(
  parsed: T,
  overrides?: Partial<VisionResult<T>>,
): VisionResult<T> {
  return {
    text: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
    parsed,
    usage: { tokensIn: 100, tokensOut: 200 },
    costUsd: 0.02,
    latencyMs: 80,
    model: "mock-vision",
    providerId: "anthropic",
    ...overrides,
  };
}

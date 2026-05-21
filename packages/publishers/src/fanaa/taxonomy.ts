import type {
  UniversalProduct,
  FanaaProductType,
  FanaaProductTarget,
  FanaaProductProblem,
} from "@platform/catalog-schema";

/**
 * Fanaa filter taxonomy inference (PLATFORM.md §10 → FanaaProductExtension).
 *
 * The storefront's filter UI depends on three closed enums:
 *   • productType  ("serum" | "cream" | "mask" | …)
 *   • target       ("women" | "men" | "unisex")
 *   • problems     ("dark-spots" | "dryness" | …)
 *
 * The AI pipeline produces an open-content UniversalProduct. The
 * publisher's job is to map that content into the closed taxonomy
 * deterministically. Heuristic mapping:
 *
 *   1. Title-token match (highest signal) — "serum"/"سيروم" → "serum".
 *   2. Benefit / description keyword match (medium signal).
 *   3. Fallback to `undefined` — the storefront treats missing taxonomy
 *      as "unfiltered" rather than crashing.
 *
 * Misclassifications are PREFERABLE to crashes here: the Studio (M8)
 * will show the inferred taxonomy and let the operator override
 * before final commit. Operator overrides flow through
 * `PublishInput.fanaaExtensionOverride`.
 *
 * # Locale-coverage
 *
 * The publisher matches across `ar` AND `en` strings so an Arabic-only
 * product still resolves to a productType. The match is case-
 * insensitive for latin chars; Arabic strings match by substring.
 */

/* ─── productType ──────────────────────────────────────────────────────── */

type Match<T> = { value: T; keywords: { ar: string[]; en: string[] } };

const PRODUCT_TYPE_MATCHES: Match<FanaaProductType>[] = [
  {
    value: "serum",
    keywords: { ar: ["سيروم"], en: ["serum"] },
  },
  {
    value: "cream",
    keywords: { ar: ["كريم", "لوسيون"], en: ["cream", "lotion", "moisturizer", "moisturiser"] },
  },
  {
    value: "mask",
    keywords: { ar: ["ماسك", "قناع"], en: ["mask"] },
  },
  {
    value: "oil",
    keywords: { ar: ["زيت"], en: ["oil"] },
  },
  {
    value: "capsules",
    keywords: { ar: ["كبسولات", "حبوب"], en: ["capsule", "capsules", "tablet", "tablets", "softgel"] },
  },
  {
    value: "spray",
    keywords: { ar: ["بخاخ"], en: ["spray", "mist"] },
  },
  {
    value: "device",
    keywords: { ar: ["جهاز"], en: ["device", "tool", "wand"] },
  },
  {
    value: "bundle",
    keywords: { ar: ["باقة", "مجموعة"], en: ["bundle", "set", "kit"] },
  },
];

export function inferProductType(
  product: UniversalProduct,
): FanaaProductType | undefined {
  const corpus = buildSearchCorpus(product);
  return firstMatch(corpus, PRODUCT_TYPE_MATCHES);
}

/* ─── target ───────────────────────────────────────────────────────────── */

const PRODUCT_TARGET_MATCHES: Match<FanaaProductTarget>[] = [
  {
    value: "men",
    keywords: { ar: ["للرجال", "للذكور"], en: ["men", "male", "him", "masculine"] },
  },
  {
    value: "unisex",
    keywords: { ar: ["للجنسين", "الجميع"], en: ["unisex", "for everyone", "all skin"] },
  },
  {
    value: "women",
    keywords: { ar: ["للنساء", "للسيدات", "للمرأة", "النساء"], en: ["women", "woman", "her", "feminine", "ladies"] },
  },
];

/** Default to `women` for beauty/wellness — matches Fanaa's current catalog mix.
 *  Other niches default to `unisex`. */
export function inferTarget(
  product: UniversalProduct,
): FanaaProductTarget | undefined {
  const corpus = buildSearchCorpus(product);
  const matched = firstMatch(corpus, PRODUCT_TARGET_MATCHES);
  if (matched) return matched;
  if (product.niche === "beauty_wellness") return "women";
  return "unisex";
}

/* ─── problems ─────────────────────────────────────────────────────────── */

const PRODUCT_PROBLEM_MATCHES: Match<FanaaProductProblem>[] = [
  {
    value: "dark-spots",
    keywords: { ar: ["تصبغات", "بقع داكنة", "كلف"], en: ["dark spots", "hyperpigmentation", "discoloration", "discolouration", "melasma"] },
  },
  {
    value: "uneven-tone",
    keywords: { ar: ["توحيد لون", "لون موحد"], en: ["uneven tone", "even tone", "even out", "uneven skin"] },
  },
  {
    value: "dryness",
    keywords: { ar: ["جفاف", "ترطيب"], en: ["dryness", "dry skin", "hydration", "hydrate"] },
  },
  {
    value: "barrier-damage",
    keywords: { ar: ["حاجز البشرة", "ترميم البشرة"], en: ["barrier", "repair", "compromised skin"] },
  },
  {
    value: "sensitive-skin",
    keywords: { ar: ["بشرة حساسة", "حساسية"], en: ["sensitive", "sensitivity", "irritated"] },
  },
  {
    value: "oily-skin",
    keywords: { ar: ["بشرة دهنية", "زيتية"], en: ["oily", "oiliness", "sebum"] },
  },
  {
    value: "pores",
    keywords: { ar: ["مسامات", "مسام"], en: ["pores", "pore"] },
  },
  {
    value: "hair-damage",
    keywords: { ar: ["تلف الشعر"], en: ["damaged hair", "hair damage"] },
  },
  {
    value: "hair-dryness",
    keywords: { ar: ["جفاف الشعر"], en: ["dry hair", "hair dryness"] },
  },
  {
    value: "breakage",
    keywords: { ar: ["تكسر الشعر", "تساقط"], en: ["breakage", "split ends"] },
  },
  {
    value: "color-treated",
    keywords: { ar: ["شعر مصبوغ", "مصبوغ"], en: ["color treated", "colour treated", "dyed hair"] },
  },
  {
    value: "hair-loss",
    keywords: { ar: ["تساقط الشعر", "تساقط"], en: ["hair loss", "thinning", "thinning hair"] },
  },
];

export function inferProblems(
  product: UniversalProduct,
): FanaaProductProblem[] | undefined {
  const corpus = buildSearchCorpus(product);
  const matched = new Set<FanaaProductProblem>();
  for (const candidate of PRODUCT_PROBLEM_MATCHES) {
    if (matchesAny(corpus, candidate.keywords)) {
      matched.add(candidate.value);
    }
  }
  if (matched.size === 0) return undefined;
  return Array.from(matched);
}

/* ─── search corpus ────────────────────────────────────────────────────── */

interface SearchCorpus {
  ar: string;
  en: string;
}

function buildSearchCorpus(product: UniversalProduct): SearchCorpus {
  const ar: string[] = [];
  const en: string[] = [];

  ar.push(product.title.ar);
  en.push(product.title.en);
  ar.push(product.description.ar);
  en.push(product.description.en);

  if (product.headline) {
    ar.push(product.headline.ar);
    en.push(product.headline.en);
  }
  if (product.subheadline) {
    ar.push(product.subheadline.ar);
    en.push(product.subheadline.en);
  }

  for (const b of product.benefits) {
    ar.push(b.title.ar, b.body.ar);
    en.push(b.title.en, b.body.en);
  }
  if (product.ingredients) {
    for (const ing of product.ingredients) {
      ar.push(ing.name.ar, ing.role.ar);
      en.push(ing.name.en, ing.role.en);
    }
  }

  return {
    ar: ar.filter(Boolean).join(" ").toLowerCase(),
    en: en.filter(Boolean).join(" ").toLowerCase(),
  };
}

function firstMatch<T>(corpus: SearchCorpus, matches: Match<T>[]): T | undefined {
  for (const m of matches) {
    if (matchesAny(corpus, m.keywords)) return m.value;
  }
  return undefined;
}

/**
 * Keyword match:
 *   • Arabic — substring search (Arabic morphology + lack of ASCII word
 *     boundaries make regex word-boundary matching unreliable).
 *   • English — word-boundary regex so `men` doesn't falsely match
 *     `women`, `oil` doesn't match `oily`, etc.
 *
 * Latin-side terms may contain spaces (e.g. "dark spots") — the helper
 * builds the appropriate regex either way.
 */
export function matchesAny(
  corpus: SearchCorpus,
  keywords: { ar: string[]; en: string[] },
): boolean {
  for (const kw of keywords.ar) {
    if (kw && corpus.ar.includes(kw.toLowerCase())) return true;
  }
  for (const kw of keywords.en) {
    if (!kw) continue;
    if (latinWordRegex(kw).test(corpus.en)) return true;
  }
  return false;
}

function latinWordRegex(keyword: string): RegExp {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

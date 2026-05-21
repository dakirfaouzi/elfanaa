import type {
  UniversalProduct,
  FanaaProductExtension,
  BeautyWellnessExtension,
  SkinType,
  SkinConcern,
} from "@platform/catalog-schema";
import type { StoreConfig } from "@platform/stores";
import { deriveSku } from "./sku";
import { deriveOfferTiers } from "./offer-tiers";
import {
  inferProductType,
  inferTarget,
  inferProblems,
  matchesAny,
} from "./taxonomy";

/**
 * UniversalProduct → FanaaProductExtension materialisation.
 *
 * # What this function does
 *
 * Computes every field in `FanaaProductExtension` (PLATFORM.md §10)
 * deterministically from the universal product + store config + an
 * optional operator override. The override is applied LAST so the
 * Studio can correct any heuristic miss before final commit.
 *
 * # What this function does NOT do
 *
 *   • Persist anything (the FilePublishStore does that).
 *   • Mutate the UniversalProduct.
 *   • Run schema validation (the publisher calls validators around it).
 *
 * # Replay safety
 *
 *   • SKU: derived from id + slug (deriveSku).
 *   • offerTiers: derived from priceHint (deriveOfferTiers).
 *   • productType / target / problems: keyword-based, stable across runs.
 *
 * Given the same UniversalProduct, this function produces an
 * identical extension object across machines / runs.
 */
export function toFanaaExtension(args: {
  product: UniversalProduct;
  storeConfig: StoreConfig;
  override?: Partial<FanaaProductExtension>;
}): FanaaProductExtension {
  const { product, override } = args;

  const sku = deriveSku({ id: product.id, slug: product.slug });
  const offerTiers = deriveOfferTiers(product.priceHint);

  const ext: FanaaProductExtension = {
    sku,
    offerTiers,
    productType: inferProductType(product),
    target: inferTarget(product),
    problems: inferProblems(product),
    upsellIds: product.upsellSuggestions,
  };

  if (override) {
    return { ...ext, ...override };
  }
  return ext;
}

/**
 * BeautyWellnessExtension inference.
 *
 * When the M5 pipeline doesn't pass a pre-computed
 * `BeautyWellnessExtension`, the publisher derives a conservative one
 * from the UniversalProduct content. This keeps the M7 publisher
 * useful before the niche-specific pipeline stage lands.
 *
 * # Strategy
 *
 *   • `skinTypes`     — keyword match against the SkinType enum.
 *   • `concerns`      — same approach; uses the open-union escape so
 *                       novel concerns from the AI ("post-acne marks")
 *                       still surface.
 *   • `routineSuggestion` — NOT inferred. The publisher cannot make
 *                           up routine steps without hallucinating.
 *                           Returns undefined; the Studio operator
 *                           can hand-author one.
 *
 * Returns `undefined` for the whole extension when no signals matched
 * — the publisher writes no niche extension in that case rather than
 * emitting an empty object.
 */
export function deriveBeautyWellnessExtension(
  product: UniversalProduct,
): BeautyWellnessExtension | undefined {
  const corpus = lowerCorpus(product);
  const skinTypes = matchSkinTypes(corpus);
  const concerns = matchConcerns(corpus);

  if (!skinTypes && !concerns) return undefined;
  return {
    skinTypes,
    concerns,
  };
}

interface Corpus {
  ar: string;
  en: string;
}

function lowerCorpus(product: UniversalProduct): Corpus {
  const arParts: string[] = [
    product.title.ar,
    product.description.ar,
    ...product.benefits.flatMap((b) => [b.title.ar, b.body.ar]),
    ...(product.ingredients ?? []).flatMap((ing) => [ing.name.ar, ing.role.ar]),
  ];
  const enParts: string[] = [
    product.title.en,
    product.description.en,
    ...product.benefits.flatMap((b) => [b.title.en, b.body.en]),
    ...(product.ingredients ?? []).flatMap((ing) => [ing.name.en, ing.role.en]),
  ];
  return {
    ar: arParts.filter(Boolean).join(" ").toLowerCase(),
    en: enParts.filter(Boolean).join(" ").toLowerCase(),
  };
}

const SKIN_TYPE_KEYWORDS: { value: SkinType; ar: string[]; en: string[] }[] = [
  { value: "oily", ar: ["دهنية", "زيتية"], en: ["oily"] },
  { value: "dry", ar: ["جافة"], en: ["dry"] },
  { value: "combination", ar: ["مختلطة"], en: ["combination"] },
  { value: "sensitive", ar: ["حساسة"], en: ["sensitive"] },
  { value: "normal", ar: ["عادية"], en: ["normal"] },
  { value: "all", ar: ["كل أنواع", "جميع أنواع"], en: ["all skin", "every skin"] },
];

function matchSkinTypes(c: Corpus): SkinType[] | undefined {
  const out = new Set<SkinType>();
  for (const m of SKIN_TYPE_KEYWORDS) {
    if (matchesAny(c, { ar: m.ar, en: m.en })) out.add(m.value);
  }
  return out.size === 0 ? undefined : Array.from(out);
}

const CONCERN_KEYWORDS: { value: SkinConcern; ar: string[]; en: string[] }[] = [
  { value: "aging", ar: ["تجاعيد", "شيخوخة"], en: ["aging", "wrinkles", "fine lines"] },
  { value: "hydration", ar: ["ترطيب"], en: ["hydration", "hydrate", "moisturize", "moisturise"] },
  { value: "pigmentation", ar: ["تصبغات", "بقع داكنة"], en: ["pigmentation", "dark spots", "hyperpigmentation"] },
  { value: "acne", ar: ["حب الشباب", "بثور"], en: ["acne", "breakouts", "blemishes"] },
  { value: "barrier", ar: ["حاجز البشرة", "ترميم"], en: ["barrier", "repair"] },
  { value: "redness", ar: ["احمرار"], en: ["redness", "rosacea"] },
  { value: "dullness", ar: ["باهت", "بشرة باهتة"], en: ["dull", "dullness", "radiance"] },
  { value: "fine-lines", ar: ["خطوط دقيقة"], en: ["fine lines"] },
  { value: "dark-circles", ar: ["هالات سوداء"], en: ["dark circles", "puffiness"] },
];

function matchConcerns(c: Corpus): SkinConcern[] | undefined {
  const out = new Set<SkinConcern>();
  for (const m of CONCERN_KEYWORDS) {
    if (matchesAny(c, { ar: m.ar, en: m.en })) out.add(m.value);
  }
  return out.size === 0 ? undefined : Array.from(out);
}

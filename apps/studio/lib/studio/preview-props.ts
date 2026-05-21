import type {
  UniversalProduct,
  FanaaProductExtension,
  BeautyWellnessExtension,
  ProductImage,
  ProductBenefit,
  ProductIngredient,
  ProductReview,
  ProductFaq,
  ProductSpec,
  ProductCert,
  AdHook,
  Money,
} from "@platform/catalog-schema";

/**
 * Preview prop-builders.
 *
 * Every preview component in `app/_components/preview/*` is a thin
 * server component that receives a fully-prepared props object. The
 * data preparation lives HERE — pure functions, deterministic, easy
 * to unit-test.
 *
 * # Why separated from the JSX
 *
 * Next.js server components can't be imported into a Node test runner
 * directly (they require the React server-component runtime). Keeping
 * the logic in plain TS lets us:
 *   • Test the data prep in isolation (preview-props.test.ts)
 *   • Reuse the same logic if a future client component or PDF
 *     renderer needs the same shape
 *
 * # Locale handling
 *
 * The Studio is an English-only operator UI, but the preview must
 * surface BOTH `ar` and `en` so the operator can verify Arabic copy
 * before publishing. Each builder returns both locales when present.
 */

/* ─── Image resolution ─────────────────────────────────────────────── */

/**
 * Resolve an image src to a URL the browser can render.
 *
 * The M5 pipeline emits R2 keys ("stores/fanaa/products/up_xx/hero.webp")
 * which need a CDN base. M9 wires the real CDN URL; M8 ships a graceful
 * fallback that:
 *   • Returns absolute URLs as-is.
 *   • Prepends `STUDIO_ASSETS_CDN_BASE` if set.
 *   • Falls back to a `placeholder://` scheme — the renderer maps this
 *     to a CSS-only placeholder card. NEVER returns a broken URL.
 */
export function resolveImageUrl(src: string): string {
  const trimmed = src.trim();
  if (trimmed === "") return "placeholder://missing";
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  if (trimmed.startsWith("data:")) return trimmed;
  const cdn = process.env.STUDIO_ASSETS_CDN_BASE;
  if (cdn && cdn.trim() !== "") {
    return `${cdn.replace(/\/$/, "")}/${trimmed.replace(/^\//, "")}`;
  }
  return `placeholder://${trimmed}`;
}

export interface HeroProps {
  title: { ar: string; en: string };
  headline?: { ar: string; en: string };
  subheadline?: { ar: string; en: string };
  hero: {
    src: string;
    resolvedSrc: string;
    alt: { ar: string; en: string };
    width?: number;
    height?: number;
    placeholder: boolean;
  };
  price?: { amount: number; currency: string; display: string };
  compareAtPrice?: { amount: number; currency: string; display: string };
  badges?: Array<{ ar: string; en: string }>;
}

export function buildHeroProps(
  product: UniversalProduct,
  fanaa?: FanaaProductExtension,
): HeroProps {
  const hero: ProductImage = product.images[0];
  const resolved = resolveImageUrl(hero.src);

  return {
    title: product.title,
    headline: product.headline,
    subheadline: product.subheadline,
    hero: {
      src: hero.src,
      resolvedSrc: resolved,
      alt: hero.alt,
      width: hero.width,
      height: hero.height,
      placeholder: resolved.startsWith("placeholder://"),
    },
    price: {
      amount: product.priceHint.amount,
      currency: product.priceHint.currency,
      display: formatMoney(product.priceHint),
    },
    compareAtPrice: fanaa?.compareAtPrice
      ? {
          amount: fanaa.compareAtPrice.amount,
          currency: fanaa.compareAtPrice.currency,
          display: formatMoney(fanaa.compareAtPrice),
        }
      : undefined,
    badges: fanaa?.badges,
  };
}

/* ─── Gallery ───────────────────────────────────────────────────────── */

export interface GalleryProps {
  images: Array<{
    src: string;
    resolvedSrc: string;
    alt: { ar: string; en: string };
    width?: number;
    height?: number;
    placeholder: boolean;
    isHero: boolean;
  }>;
  lifestyle?: Array<{
    src: string;
    resolvedSrc: string;
    alt: { ar: string; en: string };
    placeholder: boolean;
  }>;
}

export function buildGalleryProps(product: UniversalProduct): GalleryProps {
  return {
    images: product.images.map((img, i) => {
      const resolved = resolveImageUrl(img.src);
      return {
        src: img.src,
        resolvedSrc: resolved,
        alt: img.alt,
        width: img.width,
        height: img.height,
        placeholder: resolved.startsWith("placeholder://"),
        isHero: i === 0,
      };
    }),
    lifestyle: product.lifestyleImages?.map((img) => {
      const resolved = resolveImageUrl(img.src);
      return {
        src: img.src,
        resolvedSrc: resolved,
        alt: img.alt,
        placeholder: resolved.startsWith("placeholder://"),
      };
    }),
  };
}

/* ─── Benefits / Ingredients / Specs / Certs / Reviews / FAQ / Hooks ─── */

export interface BenefitsProps {
  items: Array<ProductBenefit & { iconKey: string }>;
}
export function buildBenefitsProps(product: UniversalProduct): BenefitsProps {
  return {
    items: product.benefits.map((b) => ({
      ...b,
      iconKey: (b.icon || "").trim() || "Sparkles",
    })),
  };
}

export interface IngredientsProps {
  items: ProductIngredient[];
}
export function buildIngredientsProps(
  product: UniversalProduct,
): IngredientsProps {
  return { items: product.ingredients ?? [] };
}

export interface SpecsProps {
  items: ProductSpec[];
  certifications: ProductCert[];
}
export function buildSpecsProps(product: UniversalProduct): SpecsProps {
  return {
    items: product.specifications ?? [],
    certifications: product.certifications ?? [],
  };
}

export interface ReviewsProps {
  rating?: { value: number; count: number };
  items: ProductReview[];
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
export function buildReviewsProps(product: UniversalProduct): ReviewsProps {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const r of product.reviews) {
    const k = Math.max(1, Math.min(5, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[k] += 1;
  }
  return {
    rating: product.rating,
    items: product.reviews,
    distribution,
  };
}

export interface FaqProps {
  items: ProductFaq[];
}
export function buildFaqProps(product: UniversalProduct): FaqProps {
  return { items: product.faq };
}

export interface HooksProps {
  items: AdHook[];
}
export function buildHooksProps(product: UniversalProduct): HooksProps {
  return { items: product.hooks };
}

/* ─── Fanaa-extension specifics ────────────────────────────────────── */

export interface OfferTiersProps {
  tiers: Array<{
    quantity: number;
    total: { amount: number; currency: string; display: string };
    pricePerUnitDisplay: string;
    savingsVsTier1Percent: number;
  }>;
}

export function buildOfferTiersProps(
  fanaa: FanaaProductExtension | undefined,
): OfferTiersProps | undefined {
  const tiers = fanaa?.offerTiers;
  if (!tiers || tiers.length === 0) return undefined;
  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  const tier1Unit = sorted[0].total.amount / sorted[0].quantity;
  return {
    tiers: sorted.map((t) => {
      const unit = t.total.amount / t.quantity;
      const savingsPct = tier1Unit > 0 ? Math.round(((tier1Unit - unit) / tier1Unit) * 100) : 0;
      return {
        quantity: t.quantity,
        total: {
          amount: t.total.amount,
          currency: t.total.currency,
          display: formatMoney(t.total),
        },
        pricePerUnitDisplay: formatMoney({
          amount: Math.round(unit),
          currency: t.total.currency,
        }),
        savingsVsTier1Percent: Math.max(0, savingsPct),
      };
    }),
  };
}

export interface TaxonomyProps {
  productType?: string;
  target?: string;
  problems: string[];
  collection?: string;
  sku?: string;
  upsellIds: string[];
  stockLeft?: number;
  recentBuyers?: number;
}

export function buildTaxonomyProps(
  fanaa: FanaaProductExtension | undefined,
): TaxonomyProps {
  return {
    productType: fanaa?.productType,
    target: fanaa?.target,
    problems: fanaa?.problems ?? [],
    collection: fanaa?.collection,
    sku: fanaa?.sku,
    upsellIds: fanaa?.upsellIds ?? [],
    stockLeft: fanaa?.stockLeft,
    recentBuyers: fanaa?.recentBuyers,
  };
}

export interface NicheProps {
  skinTypes: string[];
  concerns: string[];
  routine: Array<{ order: number; step: { ar: string; en: string }; product?: { ar: string; en: string } }>;
}

export function buildNicheProps(
  niche: BeautyWellnessExtension | undefined,
): NicheProps | undefined {
  if (!niche) return undefined;
  return {
    skinTypes: niche.skinTypes ?? [],
    concerns: niche.concerns ?? [],
    routine: niche.routineSuggestion ?? [],
  };
}

/* ─── Provenance / pipeline metadata panel ─────────────────────────── */

export interface ProvenanceProps {
  supplierUrl: string;
  scrapedAt: string;
  uploadedImages: string[];
  generationRunId: string;
  generatedAt: string;
}

export function buildProvenanceProps(
  product: UniversalProduct,
): ProvenanceProps {
  return {
    supplierUrl: product.sources.supplierUrl,
    scrapedAt: product.sources.scrapedAt,
    uploadedImages: product.sources.uploadedImages,
    generationRunId: product.generationRunId,
    generatedAt: product.generatedAt,
  };
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

/**
 * Format Money minor-units → "199.00 SAR".
 *
 * `Money.amount` is integer minor units (`19900 SAR` = 199.00 SAR).
 * We use Intl.NumberFormat with explicit fraction digits — currency
 * symbol is appended by code so the result is locale-stable across
 * the Studio's English-only UI.
 */
export function formatMoney(m: Money): string {
  const major = m.amount / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${formatted} ${m.currency}`;
}

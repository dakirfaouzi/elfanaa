import type {
  UniversalProduct,
  ProductImage,
  ProductReview,
  ProductFaq,
  ProductIngredient,
  ProductSpec,
} from "@platform/catalog-schema";

/**
 * Content normalisation — applied before validation + materialisation.
 *
 * # Why a normalisation layer?
 *
 * The AI pipeline (M5) emits content that's MOSTLY clean but
 * occasionally has:
 *
 *   • leading/trailing whitespace on copy strings
 *   • duplicated reviews (same body verbatim)
 *   • missing rating count where rating.value is set
 *   • empty optional sections (e.g. `ingredients: []`)
 *   • out-of-order hero image (gallery image at index 0)
 *
 * Normalisation makes these into a single canonical shape before the
 * publisher signs off — so two pipeline runs that produced effectively
 * the same product produce IDENTICAL published JSON (replay safety).
 *
 * # Rules
 *
 *   • Pure, deterministic — same input → same output.
 *   • Never INVENTS content (no auto-fill of missing reviews / FAQs).
 *   • Never DROPS required content (titles, benefits, hero image).
 *   • Drops EMPTY optional arrays (`ingredients: []` → omitted).
 *   • Trims whitespace on every customer-facing string.
 */
export function normaliseUniversalProduct(
  product: UniversalProduct,
): UniversalProduct {
  return {
    ...product,
    title: trimLocalized(product.title),
    description: trimLocalized(product.description),
    headline: product.headline ? trimLocalized(product.headline) : undefined,
    subheadline: product.subheadline
      ? trimLocalized(product.subheadline)
      : undefined,

    benefits: product.benefits.map((b) => ({
      icon: b.icon.trim(),
      title: trimLocalized(b.title),
      body: trimLocalized(b.body),
    })),

    features: omitEmpty(
      product.features?.map((f) => ({
        title: trimLocalized(f.title),
        body: trimLocalized(f.body),
      })),
    ),

    ingredients: omitEmpty(
      product.ingredients?.map(normaliseIngredient),
    ),

    specifications: omitEmpty(
      product.specifications?.map(normaliseSpec),
    ),

    certifications: omitEmpty(
      product.certifications?.map((c) => ({
        issuer: c.issuer.trim(),
        number: c.number?.trim(),
        label: trimLocalized(c.label),
      })),
    ),

    images: normaliseImages(product.images),
    lifestyleImages: omitEmpty(product.lifestyleImages?.map(normaliseImage)),

    reviews: normaliseReviews(product.reviews),
    rating: normaliseRating(product),

    faq: normaliseFaq(product.faq),

    hooks: product.hooks.map((h) => ({
      angle: h.angle,
      body: trimLocalized(h.body),
      cta: trimLocalized(h.cta),
    })),

    upsellSuggestions: omitEmpty(
      product.upsellSuggestions?.map((s) => s.trim()).filter(Boolean),
    ),

    sources: {
      supplierUrl: product.sources.supplierUrl.trim(),
      scrapedAt: product.sources.scrapedAt,
      uploadedImages: product.sources.uploadedImages.map((s) => s.trim()),
    },
  };
}

/* ─── images ───────────────────────────────────────────────────────────── */

function normaliseImage(img: ProductImage): ProductImage {
  return {
    src: img.src.trim(),
    alt: trimLocalized(img.alt),
    width: img.width,
    height: img.height,
  };
}

function normaliseImages(images: ProductImage[]): ProductImage[] {
  if (images.length === 0) return images;
  // Hero is whichever image's src/alt explicitly marks it; otherwise index 0.
  // We don't have a `kind` field today so we preserve incoming order and
  // simply de-duplicate by `src`.
  const seen = new Set<string>();
  const out: ProductImage[] = [];
  for (const raw of images) {
    const img = normaliseImage(raw);
    if (seen.has(img.src)) continue;
    seen.add(img.src);
    out.push(img);
  }
  return out;
}

/* ─── reviews ──────────────────────────────────────────────────────────── */

function normaliseReviews(reviews: ProductReview[]): ProductReview[] {
  const seen = new Set<string>();
  const out: ProductReview[] = [];
  for (const r of reviews) {
    const key = `${r.name.ar}|${r.name.en}|${r.body.ar}|${r.body.en}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: trimLocalized(r.name),
      city: trimLocalized(r.city),
      rating: clampRating(r.rating),
      body: trimLocalized(r.body),
      date: r.date.trim(),
      verified: r.verified,
    });
  }
  return out;
}

function normaliseRating(
  product: UniversalProduct,
): { value: number; count: number } | undefined {
  if (product.rating) {
    return {
      value: clampRating(product.rating.value),
      count: Math.max(0, Math.floor(product.rating.count)),
    };
  }
  if (product.reviews.length === 0) return undefined;
  const avg =
    product.reviews.reduce((s, r) => s + clampRating(r.rating), 0) /
    product.reviews.length;
  return {
    value: Math.round(avg * 10) / 10,
    count: product.reviews.length,
  };
}

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

/* ─── FAQ ──────────────────────────────────────────────────────────────── */

function normaliseFaq(faq: ProductFaq[]): ProductFaq[] {
  const seen = new Set<string>();
  const out: ProductFaq[] = [];
  for (const f of faq) {
    const q = trimLocalized(f.q);
    if (!q.ar && !q.en) continue;
    const key = `${q.ar}|${q.en}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ q, a: trimLocalized(f.a) });
  }
  return out;
}

/* ─── ingredients / specs ──────────────────────────────────────────────── */

function normaliseIngredient(i: ProductIngredient): ProductIngredient {
  return {
    name: trimLocalized(i.name),
    role: trimLocalized(i.role),
    inci: i.inci?.trim(),
  };
}

function normaliseSpec(s: ProductSpec): ProductSpec {
  return {
    key: trimLocalized(s.key),
    value: trimLocalized(s.value),
  };
}

/* ─── primitives ───────────────────────────────────────────────────────── */

function trimLocalized<T extends { ar: string; en: string }>(s: T): T {
  return { ...s, ar: s.ar.trim(), en: s.en.trim() };
}

function omitEmpty<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr;
}

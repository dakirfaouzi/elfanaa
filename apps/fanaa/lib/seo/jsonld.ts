import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";
import type { Money, Product } from "@/lib/types";

/**
 * PDP structured data (Sprint B #3).
 *
 * Emits schema.org JSON-LD that MIRRORS what the page actually renders:
 *   • `Product` + `Offer` — always (the buy box always shows a price). COD-first
 *     is unaffected: `offers` is metadata only and implies no payment provider.
 *   • `AggregateRating` — only when `product.rating` exists (the reviews summary
 *     shows it). Never fabricated.
 *   • `review[]` — only real `product.reviews` (all are rendered on the PDP,
 *     just progressively disclosed). Never fabricated.
 *   • `FAQPage` — only when `product.faq` has items (mirrors `ProductFAQ`).
 *
 * Strings are emitted in English to match the OG/SEO layer (`lib/seo.ts`), which
 * already standardises on English for crawler-facing copy.
 *
 * Pure + framework-free so it is trivially unit-testable and carries no
 * commerce coupling.
 */

const SCHEMA_LOCALE = "en" as const;

function absoluteUrl(path: string): string {
  try {
    return new URL(path, siteConfig.url).toString();
  } catch {
    return path;
  }
}

/** Minor units → a plain decimal string, e.g. 19900 → "199.00". */
function priceString(money: Money): string {
  return (money.amount / 100).toFixed(2);
}

export function buildPdpJsonLd(product: Product): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = [];

  const description = pickLocalized(product.description, SCHEMA_LOCALE);
  const images = (product.images ?? [])
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => i.src)
    // Drop the inline placeholder — a "data:" URL is not a real product photo.
    .filter((src) => !src.startsWith("data:"))
    .map((src) => (src.startsWith("http") ? src : absoluteUrl(src)));

  const productNode: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pickLocalized(product.title, SCHEMA_LOCALE),
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      "@type": "Brand",
      name: pickLocalized(siteConfig.name, SCHEMA_LOCALE),
    },
    offers: {
      "@type": "Offer",
      price: priceString(product.price),
      priceCurrency: product.price.currency,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/products/${product.slug}`),
    },
  };

  // AggregateRating — only with a real rating (mirrors the on-page summary).
  if (product.rating && product.rating.count > 0) {
    productNode.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.value,
      reviewCount: product.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Review[] — only real reviews (all rendered on the PDP, just collapsed).
  const reviews = product.reviews ?? [];
  if (reviews.length > 0) {
    productNode.review = reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: pickLocalized(r.name, SCHEMA_LOCALE) },
      ...(r.date ? { datePublished: r.date } : {}),
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: pickLocalized(r.body, SCHEMA_LOCALE),
    }));
  }

  graph.push(productNode);

  // FAQPage — only when there are FAQ items (mirrors ProductFAQ).
  const faq = product.faq ?? [];
  if (faq.length > 0) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: pickLocalized(f.q, SCHEMA_LOCALE),
        acceptedAnswer: {
          "@type": "Answer",
          text: pickLocalized(f.a, SCHEMA_LOCALE),
        },
      })),
    });
  }

  return graph;
}

/**
 * Serialises the JSON-LD graph for safe inlining in a `<script>` tag.
 * Escapes `<` so a stray `</script>` in any field can't break out of the tag.
 */
export function serializeJsonLd(graph: Record<string, unknown>[]): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

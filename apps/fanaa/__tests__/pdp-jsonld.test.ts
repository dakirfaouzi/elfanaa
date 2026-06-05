/**
 * PDP JSON-LD builder tests (Sprint B #3).
 *
 * These pin the honesty contract for structured data: the emitted graph must
 * MIRROR what the PDP renders and never fabricate trust signals.
 *
 *   • Product + Offer — always present (the buy box always shows a price).
 *   • AggregateRating — only when `product.rating` is real.
 *   • review[]        — only real `product.reviews`.
 *   • FAQPage         — only when `product.faq` has items.
 */

import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";
import { buildPdpJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p_test",
    slug: "glow-serum",
    title: { ar: "سيروم", en: "Glow Serum" },
    description: { ar: "وصف", en: "A description" },
    images: [
      { src: "https://cdn.example.com/hero.jpg", alt: { ar: "", en: "Hero" } },
    ],
    price: { amount: 19900, currency: "SAR" },
    ...overrides,
  };
}

function productNode(product: Product): Record<string, unknown> {
  const graph = buildPdpJsonLd(product);
  return graph[0];
}

describe("buildPdpJsonLd — Product + Offer (always)", () => {
  it("emits a Product node with a SAR Offer in major-unit decimal", () => {
    const node = productNode(makeProduct());
    expect(node["@type"]).toBe("Product");
    expect(node.name).toBe("Glow Serum");
    const offer = node.offers as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.price).toBe("199.00");
    expect(offer.priceCurrency).toBe("SAR");
    expect(String(offer.url)).toMatch(/\/products\/glow-serum$/);
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("drops the inline placeholder data: image", () => {
    const node = productNode(
      makeProduct({ images: [PLACEHOLDER_PRODUCT_IMAGE] })
    );
    expect(node.image).toBeUndefined();
  });
});

describe("buildPdpJsonLd — honesty gating", () => {
  it("omits AggregateRating / review / FAQPage when there is no real data", () => {
    const graph = buildPdpJsonLd(makeProduct());
    expect(graph).toHaveLength(1);
    expect(graph[0].aggregateRating).toBeUndefined();
    expect(graph[0].review).toBeUndefined();
  });

  it("mirrors a real aggregate rating", () => {
    const node = productNode(makeProduct({ rating: { value: 4.7, count: 213 } }));
    const agg = node.aggregateRating as Record<string, unknown>;
    expect(agg["@type"]).toBe("AggregateRating");
    expect(agg.ratingValue).toBe(4.7);
    expect(agg.reviewCount).toBe(213);
  });

  it("does not emit AggregateRating when count is zero", () => {
    const node = productNode(makeProduct({ rating: { value: 0, count: 0 } }));
    expect(node.aggregateRating).toBeUndefined();
  });

  it("emits real reviews only", () => {
    const node = productNode(
      makeProduct({
        reviews: [
          {
            name: { ar: "سارة", en: "Sara" },
            city: { ar: "الرياض", en: "Riyadh" },
            rating: 5,
            body: { ar: "ممتاز", en: "Excellent" },
            date: "2026-01-01",
            verified: true,
          },
        ],
      })
    );
    const reviews = node.review as Array<Record<string, unknown>>;
    expect(reviews).toHaveLength(1);
    expect((reviews[0].author as Record<string, unknown>).name).toBe("Sara");
    expect(reviews[0].reviewBody).toBe("Excellent");
    expect(reviews[0].datePublished).toBe("2026-01-01");
  });

  it("emits a FAQPage node only when faq items exist", () => {
    const graph = buildPdpJsonLd(
      makeProduct({
        faq: [{ q: { ar: "؟", en: "How?" }, a: { ar: ".", en: "Like this." } }],
      })
    );
    expect(graph).toHaveLength(2);
    const faqNode = graph[1];
    expect(faqNode["@type"]).toBe("FAQPage");
    expect((faqNode.mainEntity as unknown[]).length).toBe(1);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so a stray </script> cannot break out of the tag", () => {
    const out = serializeJsonLd([
      { name: "a</script>b" } as Record<string, unknown>,
    ]);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });
});

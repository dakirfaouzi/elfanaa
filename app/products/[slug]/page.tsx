import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductBenefits } from "@/components/product/ProductBenefits";
import { ProductLifestyle } from "@/components/product/ProductLifestyle";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductFAQ } from "@/components/product/ProductFAQ";
import { ProductIngredients } from "@/components/product/ProductIngredients";
import { ProductDetails } from "./ProductDetails";
import { RelatedProducts } from "@/components/sections/RelatedProducts";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import { pickLocalized } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  // OG metadata uses the brand-language title in English (Arabic at this layer
  // confuses some social previews). The Arabic copy is the on-page experience.
  const title = pickLocalized(product.title, "en");
  const description = pickLocalized(product.description, "en");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.images.map((i) => i.src),
    },
  };
}

/**
 * Product Detail Page — the funnel's main conversion surface.
 *
 * Composition order is deliberate (premium DTC playbook — Article, Aesop,
 * Goop, Public Goods):
 *
 *   1. Gallery + Details  — the buyer needs to see the piece *and* the
 *                           offer in the same scroll. Side-by-side on
 *                           desktop, stacked on mobile.
 *   2. Benefits           — translates features into emotional outcomes.
 *   3. Lifestyle          — alternating image/text band; sells the vibe.
 *   4. Reviews            — qualitative + quantitative social proof.
 *   5. FAQ                — handles objections in line.
 *   6. Related products   — keeps the customer in the catalog if they
 *                           weren't ready to buy *this* SKU yet.
 */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(product.id);

  return (
    <div className="pb-24 md:pb-0">
      <Container>
        <div className="grid gap-10 py-8 md:grid-cols-2 md:py-14 lg:gap-16">
          <ProductGallery product={product} />
          <ProductDetails product={product} />
        </div>
      </Container>

      <ProductBenefits product={product} />

      <ProductIngredients product={product} />

      <ProductLifestyle product={product} />

      <ProductReviews product={product} />

      <ProductFAQ product={product} />

      <RelatedProducts products={related} />
    </div>
  );
}

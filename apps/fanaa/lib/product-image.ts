import type { Product, ProductImage } from "@/lib/types";

/**
 * Storefront image helpers — single source of truth for the
 * "what image do I render?" question across every product surface.
 *
 * # Why this exists
 *
 * The M12 / Step 2 hybrid catalog can return Products that have an
 * empty `images: []` array — AI-generated rows synthesised from a
 * `storefront_catalog_product` row that hasn't been backfilled with
 * curated photography yet. Every product surface used to assume
 * `product.images[0]` was always defined; with the hybrid catalog
 * that assumption no longer holds. Accessing `.src` on the resulting
 * `undefined` crashed `/shop`, the cart drawer, the PDP gallery, the
 * sticky add-to-cart bar, the post-purchase upsell, and the
 * thank-you cross-sell / recommendations grids.
 *
 * # Defense-in-depth model
 *
 *   1. The catalog merger (`lib/catalog/merge.ts::synthesiseProductFromRow`)
 *      now seeds the placeholder image directly into the synthesised
 *      Product, so `images.length >= 1` is true for every product
 *      reaching the storefront in normal operation.
 *
 *   2. These helpers are the second layer — they wrap every UI
 *      consumer that previously did `product.images[0]`. If a future
 *      regression slips an empty array past the merger, the
 *      placeholder still renders and the page does not crash.
 *
 * Both layers share the same `PLACEHOLDER_PRODUCT_IMAGE`, so the
 * "image pending" visual is identical whether the fallback fires at
 * the data layer or the UI layer.
 *
 * # Why local-static (not an external CDN)
 *
 * The placeholder lives in `apps/fanaa/public/placeholder-product.svg`.
 * Static `/public` paths don't need `next.config.mjs::images.remotePatterns`
 * registration and resolve to the same origin in every environment
 * (preview, prod, EasyPanel container). Using a remote CDN would
 * introduce a fragile dependency at exactly the moment we're trying
 * to render the *fallback* state — the wrong tradeoff.
 */

export const PLACEHOLDER_PRODUCT_IMAGE: ProductImage = {
  src: "/placeholder-product.svg",
  alt: {
    ar: "صورة المنتج قيد التحديث",
    en: "Product image pending",
  },
};

/**
 * Returns the product's primary image, or the storefront placeholder
 * if none is available. ALWAYS returns a usable `ProductImage` —
 * never `undefined`.
 *
 * Callers can safely do:
 *
 *   const image = getPrimaryImage(product);
 *   <Image src={image.src} alt={pickLocalized(image.alt, locale)} />
 */
export function getPrimaryImage(product: Pick<Product, "images">): ProductImage {
  return product.images[0] ?? PLACEHOLDER_PRODUCT_IMAGE;
}

/**
 * Returns the product image at a specific index, falling back to the
 * primary image, then the placeholder. Used by surfaces that switch
 * between gallery slots (`ProductGallery`) where `active` can drift
 * past `images.length` on data updates.
 */
export function getProductImageAt(
  product: Pick<Product, "images">,
  index: number,
): ProductImage {
  return (
    product.images[index] ??
    product.images[0] ??
    PLACEHOLDER_PRODUCT_IMAGE
  );
}

/**
 * Returns the product's editorial "lifestyle" image (the aspirational
 * photo used in the PDP lifestyle band), falling back through:
 * `lifestyleImage` → `images[0]` → placeholder.
 *
 * The placeholder is the right tail-fallback here too — an AI-
 * generated row will have neither a lifestyle image nor a hero gallery
 * shot, and the lifestyle band should still render without breaking
 * the rest of the PDP.
 */
export function getLifestyleImage(
  product: Pick<Product, "images" | "lifestyleImage">,
): ProductImage {
  return product.lifestyleImage ?? getPrimaryImage(product);
}

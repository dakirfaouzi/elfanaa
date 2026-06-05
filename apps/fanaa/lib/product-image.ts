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
 * # Why an inline data URL (Phase 2.4.3)
 *
 * Earlier phases (2.4.1 → 2.4.2) shipped the placeholder as a static
 * file (`/public/placeholder-product.svg`) backed by a
 * `next.config.mjs::images.dangerouslyAllowSVG: true` opt-in. That
 * design depends on three moving parts working together every
 * deploy:
 *   • The `public/` folder being copied into the standalone Docker
 *     bundle (it isn't automatic).
 *   • The `dangerouslyAllowSVG` config being honoured by the actual
 *     running container (not silently shadowed by build cache).
 *   • The `/_next/image` optimizer accepting the SVG source.
 * Production verification showed at least one of those three steps
 * was failing — AI-generated cards rendered as empty tiles even
 * after the Phase 2.4.2 config landed, with no broken-image icon
 * surfaced because next/image was returning a 400 silently.
 *
 * Switching the placeholder to an inline data URL collapses all
 * three failure modes into zero:
 *   • next/image detects `data:` srcs and bypasses the optimizer
 *     entirely (no `dangerouslyAllowSVG` requirement, no `_next/image`
 *     hop).
 *   • The asset travels with the JS bundle (no `public/` copy
 *     dependency, no build-cache surprise).
 *   • The placeholder renders identically across SSR, ISR, dev, and
 *     prod regardless of `next.config.mjs` state.
 * Cost: ~0.9 KB of additional minified JS per bundle that imports
 * this module. Worth it for an unconditional render guarantee.
 *
 * The static SVG file under `apps/fanaa/public/placeholder-product.svg`
 * is kept as documentation of the rendered artwork — it is no
 * longer referenced from the storefront code.
 */

/**
 * Inlined warm-sand "image pending" tile.
 *
 * URL-encoded SVG (not base64) so the data URL stays human-readable
 * and source-diffable. `viewBox=0 0 800 800` + `preserveAspectRatio=
 * xMidYMid slice` keeps the icon centred in every aspect ratio the
 * storefront renders into:
 *   • 3:4 portrait ProductCard tile
 *   • 4:5 PDP gallery
 *   • 1:1 cart drawer line
 *   • 16:9 sticky add-to-cart bar
 *
 * Palette matches the brand `#F5EFE6` cream base / `#B89A78` sand
 * accent / `#8A7259` caption so the placeholder looks like a
 * deliberate design state rather than a missing-asset failure.
 */
const PLACEHOLDER_SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Product image pending">' +
  '<rect width="800" height="800" fill="#F5EFE6"/>' +
  '<g transform="translate(400 400)" stroke="#B89A78" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="-150" y="-110" width="300" height="220" rx="18" ry="18"/>' +
  '<circle cx="-50" cy="-30" r="22" fill="#B89A78" stroke="none"/>' +
  '<path d="M-150 80 L-30 -10 L40 50 L100 0 L150 50 L150 110 L-150 110 Z" fill="#B89A78" stroke="none" opacity="0.55"/>' +
  '</g>' +
  '<text x="400" y="600" text-anchor="middle" fill="#8A7259" font-family="Georgia, serif" font-size="36" font-style="italic" letter-spacing="0.04em">image pending</text>' +
  '</svg>';

/**
 * Pre-encoded data URL — built once at module load so every consumer
 * gets stable referential identity (`getPrimaryImage(productA) ===
 * getPrimaryImage(productB)` when both fall back to the placeholder)
 * and React can skip re-renders on equality checks.
 */
const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;utf8," + encodeURIComponent(PLACEHOLDER_SVG_MARKUP);

export const PLACEHOLDER_PRODUCT_IMAGE: ProductImage = {
  src: PLACEHOLDER_DATA_URL,
  alt: {
    ar: "صورة المنتج قيد التحديث",
    en: "Product image pending",
  },
};

/**
 * Is this image source the storefront "image pending" placeholder?
 *
 * Lets presentation surfaces distinguish "real photography" from the
 * fallback tile so they can choose to hide a purely-decorative band
 * (e.g. the PDP lifestyle marquee) rather than render a placeholder as
 * if it were a hero scene. Matches the inline data URL exactly — the one
 * placeholder both the data layer and the UI layer fall back to.
 */
export function isPlaceholderImage(src: string | undefined | null): boolean {
  return src === PLACEHOLDER_DATA_URL;
}

/**
 * Returns the product's primary image, or the storefront placeholder
 * if none is available. ALWAYS returns a usable `ProductImage` —
 * never `undefined`.
 *
 * Callers can safely do:
 *
 *   const image = getPrimaryImage(product);
 *   <Image src={image.src} alt={pickLocalized(image.alt, locale)} />
 *
 * The function is deliberately defensive about the shape of `images`:
 * even though TypeScript declares it `ProductImage[]` (non-optional),
 * a Product can reach this code path with `images === undefined` via:
 *   • A legacy persisted Zustand cart deserialised before the type was
 *     introduced.
 *   • A malformed DB row that bypassed `synthesiseProductFromRow`'s
 *     placeholder seeding (Phase 2.4.1).
 *   • Test fixtures or future product sources that haven't been
 *     migrated yet.
 * Treat `undefined` exactly like an empty array — fall through to
 * the placeholder — instead of throwing a "Cannot read properties of
 * undefined (reading '0')" crash that would take the whole tree down.
 */
export function getPrimaryImage(product: Pick<Product, "images">): ProductImage {
  return product.images?.[0] ?? PLACEHOLDER_PRODUCT_IMAGE;
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
    product.images?.[index] ??
    product.images?.[0] ??
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

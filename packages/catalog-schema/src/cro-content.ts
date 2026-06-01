/**
 * CroContent — the conversion-content projection carried from the AI pipeline
 * to the storefront PDP (Step 4 Phase 4.2, PLATFORM.md §26.4).
 *
 * # Why this exists
 *
 * The production fanaa PDP renders from a flat `Product` whose CRO fields
 * historically came ONLY from the hand-authored `data/products.ts` snapshot.
 * AI-published rows had no snapshot entry, so they rendered commerce-only
 * (§26.4.1). This projection is the carrier that lets an AI-published product
 * render a rich page WITHOUT a hand-authored snapshot:
 *
 *   UniversalProduct (assemble)
 *     → DraftDocument.croContent          (productToDraftDocument)
 *     → storefront_catalog_product.cro_content (publish upsert)
 *     → fanaa Product CRO fields          (loader / synthesise)
 *
 * It is a DERIVED projection — not operator-edited canvas state — so on the
 * `DraftDocument` it travels as an opaque JSON bag and is validated by
 * `CroContentSchema` at the storefront read boundary (mirroring the
 * offerTiers/badges/rating "Json + coerce-on-read" convention).
 */
import type { LocalizedString } from "./locales";
import type {
  ProductBenefit,
  ProductFaq,
  ProductImage,
  ProductIngredient,
  ProductReview,
} from "./primitives";
import type { SectionContent } from "./section-content";
import type { SectionKind } from "./sections";

export interface CroContent {
  title?: LocalizedString;
  description?: LocalizedString;
  headline?: LocalizedString;
  subheadline?: LocalizedString;
  /** Founder / brand-story note rendered as a `founders_note` section. */
  foundersNote?: LocalizedString;

  /** Hero first, then gallery — lets the PDP show the full gallery from the DB. */
  images?: ProductImage[];
  /**
   * The full generated scene pool (Phase 4.6.2). The storefront distributes
   * these across image-capable sections (mechanism / results / comparison /
   * guarantee / lifestyle / …) so the PDP becomes image-led, not text-led.
   */
  lifestyleImages?: ProductImage[];
  /**
   * First lifestyle image — retained for back-compat with the single-image
   * lifestyle band and pre-4.6.2 rows. New rows also carry `lifestyleImages`.
   */
  lifestyleImage?: ProductImage;

  benefits?: ProductBenefit[];
  reviews?: ProductReview[];
  faq?: ProductFaq[];
  ingredients?: ProductIngredient[];

  /** Rich conversion sections (mechanism/results/guarantee/comparison/objections). */
  sectionContent?: SectionContent;
  /** AI-chosen section ordering; the storefront renders sections in this order. */
  sectionOrder?: SectionKind[];
}

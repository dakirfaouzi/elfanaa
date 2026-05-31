import { z } from "zod";
import type { CroContent } from "../cro-content";
import { LocalizedStringSchema } from "./locales";
import {
  ProductBenefitSchema,
  ProductFaqSchema,
  ProductImageSchema,
  ProductIngredientSchema,
  ProductReviewSchema,
} from "./primitives";
import { SectionContentSchema } from "./section-content";

/**
 * Read-boundary validator for the CRO projection carried on
 * `DraftDocument.croContent` and `storefront_catalog_product.cro_content`.
 *
 * Permissive by design: every field optional; the storefront renders only what
 * is present. Use `.safeParse` and ignore the block on failure (never throw on
 * a malformed projection — fall back to the commerce-only product).
 */
export const CroContentSchema: z.ZodType<CroContent> = z.object({
  title: LocalizedStringSchema.optional(),
  description: LocalizedStringSchema.optional(),
  headline: LocalizedStringSchema.optional(),
  subheadline: LocalizedStringSchema.optional(),
  foundersNote: LocalizedStringSchema.optional(),

  images: z.array(ProductImageSchema).optional(),
  lifestyleImage: ProductImageSchema.optional(),

  benefits: z.array(ProductBenefitSchema).optional(),
  reviews: z.array(ProductReviewSchema).optional(),
  faq: z.array(ProductFaqSchema).optional(),
  ingredients: z.array(ProductIngredientSchema).optional(),

  sectionContent: SectionContentSchema.optional(),
  sectionOrder: z.array(z.string().min(1)).optional(),
});

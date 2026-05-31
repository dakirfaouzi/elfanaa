import { z } from "zod";
import type { UniversalProduct } from "../universal";
import { LocalizedStringSchema, MoneySchema } from "./locales";
import {
  ProductBenefitSchema,
  ProductFeatureSchema,
  ProductIngredientSchema,
  ProductSpecSchema,
  ProductCertSchema,
  ProductImageSchema,
  ProductReviewSchema,
  ProductFaqSchema,
  AdHookSchema,
} from "./primitives";

/**
 * Runtime validator for `UniversalProduct` (../universal.ts).
 *
 * # Validation philosophy
 *
 * This schema describes a FULLY-POPULATED UniversalProduct — the output
 * of the assemble stage (PLATFORM.md §11 stage 12). Mid-pipeline
 * artifacts are validated per-stage, not against this schema.
 *
 *   • Customer-facing primary fields (`title`, `description`, `benefits`,
 *     `reviews`, `faq`, `hooks`, `images`) are required.
 *   • Niche-specific fields (`ingredients`, `specifications`, …) are
 *     optional — populated only when `niche` warrants it. The publisher
 *     decides what to do with missing optionals.
 *   • Provenance fields (`sources`) are required because no draft should
 *     exist without an origin URL + scrape timestamp.
 *
 * # Why `z.ZodType<UniversalProduct>` is enforced
 *
 * Annotating the schema as `z.ZodType<UniversalProduct>` makes TypeScript
 * reject the schema if it drifts from the canonical type. This is the
 * single biggest payoff of M3 — the M5 pipeline assemble stage can rely
 * on this schema as ground truth and the type system enforces parity.
 */
export const UniversalProductSchema: z.ZodType<UniversalProduct> = z.object({
  // Identity
  id: z.string().min(1),
  slug: z.string().min(1),
  niche: z.string().min(1),
  storeContext: z.string().min(1),
  generationRunId: z.string().min(1),
  generatedAt: z.string().min(1),

  // Customer-facing core
  title: LocalizedStringSchema,
  description: LocalizedStringSchema,
  headline: LocalizedStringSchema.optional(),
  subheadline: LocalizedStringSchema.optional(),
  foundersNote: LocalizedStringSchema.optional(),

  // Value content
  benefits: z.array(ProductBenefitSchema).min(1),
  features: z.array(ProductFeatureSchema).optional(),
  ingredients: z.array(ProductIngredientSchema).optional(),
  specifications: z.array(ProductSpecSchema).optional(),
  certifications: z.array(ProductCertSchema).optional(),

  // Visual
  images: z.array(ProductImageSchema).min(1),
  lifestyleImages: z.array(ProductImageSchema).optional(),

  // Social proof
  reviews: z.array(ProductReviewSchema),
  rating: z
    .object({
      value: z.number().min(0).max(5),
      count: z.number().int().nonnegative(),
    })
    .optional(),

  // Conversion
  faq: z.array(ProductFaqSchema),

  // Pricing hint
  priceHint: MoneySchema,
  marginNotes: z.string().optional(),

  // Ads
  hooks: z.array(AdHookSchema),

  // Cross-sell
  upsellSuggestions: z.array(z.string()).optional(),

  // Provenance
  sources: z.object({
    supplierUrl: z.string().url(),
    scrapedAt: z.string().min(1),
    uploadedImages: z.array(z.string()),
  }),
});

import { z } from "zod";
import type {
  ProductImage,
  ProductBenefit,
  ProductFeature,
  ProductIngredient,
  ProductSpec,
  ProductCert,
  ProductReview,
  ProductFaq,
  AdHook,
} from "../primitives";
import { LocalizedStringSchema } from "./locales";

/**
 * Runtime validators mirroring `../primitives.ts`.
 *
 * All schemas are loose-by-design: a draft mid-pipeline may have
 * partially-populated fields, and we want validation to accept those
 * rather than fail-closed. The `assemble` stage (PLATFORM.md §11
 * stage 12) tightens by requiring a fully-populated UniversalProduct
 * via `UniversalProductSchema` instead.
 */

export const ProductImageSchema: z.ZodType<ProductImage> = z.object({
  src: z.string().min(1),
  alt: LocalizedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  intent: z.string().optional(),
});

export const ProductBenefitSchema: z.ZodType<ProductBenefit> = z.object({
  icon: z.string().min(1),
  title: LocalizedStringSchema,
  body: LocalizedStringSchema,
});

export const ProductFeatureSchema: z.ZodType<ProductFeature> = z.object({
  title: LocalizedStringSchema,
  body: LocalizedStringSchema,
});

export const ProductIngredientSchema: z.ZodType<ProductIngredient> = z.object({
  name: LocalizedStringSchema,
  role: LocalizedStringSchema,
  inci: z.string().optional(),
});

export const ProductSpecSchema: z.ZodType<ProductSpec> = z.object({
  key: LocalizedStringSchema,
  value: LocalizedStringSchema,
});

export const ProductCertSchema: z.ZodType<ProductCert> = z.object({
  issuer: z.string().min(1),
  number: z.string().optional(),
  label: LocalizedStringSchema,
});

export const ProductReviewSchema: z.ZodType<ProductReview> = z.object({
  name: LocalizedStringSchema,
  city: LocalizedStringSchema,
  rating: z.number().min(1).max(5),
  body: LocalizedStringSchema,
  // YYYY-MM-DD — loose on impossible dates (Feb 30); the social-proof
  // stage generates from a constrained set so we trust the source.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd"),
  verified: z.boolean().optional(),
});

export const ProductFaqSchema: z.ZodType<ProductFaq> = z.object({
  q: LocalizedStringSchema,
  a: LocalizedStringSchema,
});

export const AdHookSchema: z.ZodType<AdHook> = z.object({
  // String union with open-extension — accept any string but suggest the
  // canonical angles in the type. Matches `AdHook.angle` in ../primitives.
  angle: z.string().min(1),
  body: LocalizedStringSchema,
  cta: LocalizedStringSchema,
});

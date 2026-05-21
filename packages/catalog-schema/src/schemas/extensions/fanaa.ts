import { z } from "zod";
import type {
  FanaaProductExtension,
  FanaaOfferTier,
  FanaaProductType,
  FanaaProductTarget,
  FanaaProductProblem,
} from "../../extensions/fanaa";
import { LocalizedStringSchema, MoneySchema } from "../locales";

/**
 * Runtime validator for FanaaProductExtension (../../extensions/fanaa.ts).
 *
 * Consumed by the (future) FanaaPublisher at materialise-time. M3 ships
 * the validator dormant — no caller invokes it yet.
 */

export const FanaaProductTypeSchema: z.ZodType<FanaaProductType> = z.enum([
  "serum",
  "cream",
  "mask",
  "oil",
  "capsules",
  "spray",
  "device",
  "bundle",
]);

export const FanaaProductTargetSchema: z.ZodType<FanaaProductTarget> = z.enum([
  "women",
  "men",
  "unisex",
]);

export const FanaaProductProblemSchema: z.ZodType<FanaaProductProblem> = z.enum([
  "dark-spots",
  "dryness",
  "uneven-tone",
  "barrier-damage",
  "sensitive-skin",
  "oily-skin",
  "pores",
  "hair-damage",
  "hair-dryness",
  "breakage",
  "color-treated",
  "hair-loss",
  "complete-care",
]);

export const FanaaOfferTierSchema: z.ZodType<FanaaOfferTier> = z.object({
  quantity: z.number().int().positive(),
  total: MoneySchema,
});

export const FanaaProductExtensionSchema: z.ZodType<FanaaProductExtension> = z.object({
  landingPath: z
    .string()
    .startsWith("/", "landingPath must be an absolute storefront path")
    .optional(),
  sku: z.string().optional(),
  compareAtPrice: MoneySchema.optional(),
  offerTiers: z.array(FanaaOfferTierSchema).optional(),
  badges: z.array(LocalizedStringSchema).optional(),
  collection: z.string().optional(),
  upsellIds: z.array(z.string()).optional(),
  productType: FanaaProductTypeSchema.optional(),
  target: FanaaProductTargetSchema.optional(),
  problems: z.array(FanaaProductProblemSchema).optional(),
  stockLeft: z.number().int().nonnegative().optional(),
  recentBuyers: z.number().int().nonnegative().optional(),
});

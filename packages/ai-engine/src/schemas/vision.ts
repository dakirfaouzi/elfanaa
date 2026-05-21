import { z } from "zod";
import type { VisionOutput } from "../pipeline/types-vision";

/**
 * Zod schema for the vision stage output (stage 03).
 *
 * Mirrors the JSON shape the vision prompt asks the model to emit.
 * The `confidence` band drives whether the strategy stage trusts the
 * visual signals at face value or treats them as soft hints.
 */
export const VisionOutputSchema: z.ZodType<VisionOutput> = z.object({
  skipped: z.boolean(),
  skipReason: z.string().optional(),
  productCategory: z.string().optional(),
  formFactor: z.string().optional(),
  visibleColors: z.array(z.string()).optional(),
  packagingMaterial: z.string().optional(),
  visibleText: z.string().optional(),
  labelLanguages: z.array(z.string()).optional(),
  approximateSize: z.string().optional(),
  visualHooks: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  costUsd: z.number().nonnegative(),
});

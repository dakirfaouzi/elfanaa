import { z } from "zod";
import type {
  ImageGenOutput,
  ImageGenResult,
} from "../pipeline/types-image-gen";

/**
 * Zod schema for the image-gen stage output (stage 08).
 *
 * The stage runs N prompts (1 hero + 0..6 lifestyle) and accepts
 * partial success — per PLATFORM.md §11 stage 08, "Per-prompt 3× retry
 * + provider fallback; partial success accepted". Failed prompts land
 * in `failed`, successes in `results`, and the consumer (assemble) is
 * responsible for handling N < requested.
 */
const ImageGenResultSchema: z.ZodType<ImageGenResult> = z.object({
  role: z.enum(["hero", "lifestyle"]),
  intent: z.string().optional(),
  prompt: z.string().min(1),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  costUsd: z.number().nonnegative(),
  model: z.string().min(1),
  providerId: z.string().min(1),
  seed: z.number().int().optional(),
  attempts: z.number().int().min(1),
});

export const ImageGenOutputSchema: z.ZodType<ImageGenOutput> = z.object({
  results: z.array(ImageGenResultSchema),
  failed: z.array(
    z.object({
      role: z.enum(["hero", "lifestyle"]),
      intent: z.string().optional(),
      prompt: z.string().min(1),
      errorMessage: z.string().min(1),
      attempts: z.number().int().min(1),
    }),
  ),
  totalCostUsd: z.number().nonnegative(),
});

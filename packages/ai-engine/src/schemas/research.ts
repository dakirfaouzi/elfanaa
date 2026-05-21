import { z } from "zod";
import type { ResearchOutput } from "../pipeline/types-research";

/**
 * Zod schema for the research stage output (stage 02).
 *
 * The research stage hands downstream stages a structured "what does
 * the supplier page say?" record. Image references are passed through
 * as URLs — the M5 pipeline does NOT download them (R2 + Sharp is M6+).
 */
export const ResearchOutputSchema: z.ZodType<ResearchOutput> = z.object({
  supplierUrl: z.string().url(),
  scrapedAt: z.string().min(1),
  skipped: z.boolean(),
  skipReason: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  markdown: z.string().optional(),
  language: z.string().optional(),
  images: z
    .array(
      z.object({
        src: z.string().url(),
        alt: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  links: z.array(z.string()).optional(),
  costUsd: z.number().nonnegative(),
  providerId: z.string().min(1).optional(),
  durationMs: z.number().nonnegative(),
});

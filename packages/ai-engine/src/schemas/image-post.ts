import { z } from "zod";
import type { ImagePostOutput } from "../pipeline/types-image-post";
import { LocalizedStringSchema } from "@platform/catalog-schema/schemas";

/**
 * Zod schema for the image-post stage output (stage 09).
 *
 * In M5 this stage is a pure URL-pass-through transform: it groups the
 * image-gen results into hero / gallery / lifestyle buckets and attaches
 * bilingual alt text derived from the prompt intent. Real Sharp post-
 * processing (resizing, WebP encoding, R2 upload) lives in the M6 worker
 * — at which point this stage gains side-effects. The contract here is
 * stable across both versions.
 */
export const ImagePostOutputSchema: z.ZodType<ImagePostOutput> = z.object({
  hero: z
    .object({
      src: z.string().min(1),
      alt: LocalizedStringSchema,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  gallery: z.array(
    z.object({
      src: z.string().min(1),
      alt: LocalizedStringSchema,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
  lifestyle: z.array(
    z.object({
      src: z.string().min(1),
      alt: LocalizedStringSchema,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
  /** True when the worker stage performs real Sharp work — always false in M5. */
  postProcessed: z.boolean(),
});

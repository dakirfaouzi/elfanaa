import { z } from "zod";

/**
 * Media references inside a draft.
 *
 * # Why one MediaRef and not separate Image/Video types
 *
 * The builder treats images, GIFs, and videos uniformly:
 * every section that accepts media accepts the same shape.
 * The `kind` discriminator carries the renderer's branching
 * logic. This keeps the section editor forms small (one
 * "media picker" component per slot) and lets the operator
 * swap an image for a video without restructuring the draft.
 *
 * # Variants
 *
 *   • `desktopSrc` / `mobileSrc` — separate variants for
 *     responsive rendering. The runtime renderer emits
 *     `<picture><source media="..." srcset="...">` so the
 *     mobile viewer only downloads the mobile asset.
 *   • `poster`  — required for video; ignored for image.
 *   • `alt`     — required for static images (a11y).
 *   • `assetId` — when the media came from an R2-backed
 *     studio_asset row, this carries the FK so the builder
 *     UI can show "linked to library asset".
 *
 * # Source of truth
 *
 * `desktopSrc` is always present — it's the canonical URL
 * the renderer uses when no `mobileSrc` overrides exist.
 * Empty media slots are stored as `null` in the section
 * payload (NOT as `MediaRef` with empty strings).
 */

export const MediaKindSchema = z.enum(["image", "gif", "video"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaRefSchema = z.object({
  kind: MediaKindSchema,
  desktopSrc: z
    .string()
    .min(1, "media_src_empty")
    .max(2048),
  mobileSrc: z.string().min(1).max(2048).optional(),
  poster: z.string().min(1).max(2048).optional(),
  alt: z.string().max(512).optional(),
  /** FK to studio_asset.id when the media came from R2. */
  assetId: z.string().max(64).optional(),
  /** Original natural dimensions (when known). Drives
   *  CLS-safe layout in the runtime renderer. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type MediaRef = z.infer<typeof MediaRefSchema>;

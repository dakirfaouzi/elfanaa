import { z } from "zod";
import { ALLOWED_CONTENT_TYPES } from "./keys";

/**
 * Wire-format Zod schemas for the storage layer.
 *
 * # Why schemas
 *
 * Every byte that crosses the Studio HTTP boundary or the persistence
 * boundary is validated through Zod. The schemas live here (not in
 * `contracts.ts`) so the runtime check surface and the type surface
 * stay separate — types tell TypeScript what `MediaStore` returns,
 * schemas tell Zod what JSON over the wire looks like.
 *
 * # Manifest
 *
 * An `AssetManifest` is the persisted record of an asset, including
 * its R2 location and any caption metadata. It serialises 1:1 with
 * a `studio_asset` row. The mapper in `@platform/persistence`
 * converts between the Prisma model and this schema.
 */

const ALLOWED_CT = Object.keys(ALLOWED_CONTENT_TYPES) as [string, ...string[]];

/** Request shape for `POST /api/studio/drafts/[draftId]/assets/presign`. */
export const AssetUploadIntentSchema = z.object({
  source: z.enum(["upload", "scraped", "generated"]),
  contentType: z.enum(ALLOWED_CT),
  bytes: z.number().int().positive().max(25 * 1024 * 1024),
  altAr: z.string().max(512).optional(),
  altEn: z.string().max(512).optional(),
});

export type AssetUploadIntent = z.infer<typeof AssetUploadIntentSchema>;

/** Persisted form. Used by the asset browser API. */
export const AssetManifestSchema = z.object({
  id: z.string().min(1).max(64),
  draftId: z.string().min(1).max(64),
  source: z.enum(["upload", "scraped", "generated"]),
  bucket: z.string().min(1).max(160),
  key: z.string().min(1).max(512),
  contentType: z.string().min(1).max(80),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  altAr: z.string().max(512).optional(),
  altEn: z.string().max(512).optional(),
  createdAt: z.string(),
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;

/** Response shape for the presign endpoint. */
export const PresignedUploadResponseSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()),
  method: z.literal("PUT"),
  expiresAt: z.string(),
  ref: z.object({
    bucket: z.string(),
    key: z.string(),
    contentType: z.string(),
    bytes: z.number().int().nonnegative(),
  }),
});

export type PresignedUploadResponse = z.infer<
  typeof PresignedUploadResponseSchema
>;

/**
 * Asset-lifecycle stage. Echoes the M11 asset browser's filter chips.
 *
 *   • `pending`   — presigned PUT minted, R2 has not confirmed bytes.
 *   • `uploaded`  — bytes confirmed via HEAD probe.
 *   • `attached`  — bytes confirmed AND a `studio_artifact` references
 *                   the asset (i.e. the pipeline used it).
 *   • `archived`  — past lifecycle threshold; eligible for deletion.
 */
export const AssetLifecycleStateSchema = z.enum([
  "pending",
  "uploaded",
  "attached",
  "archived",
]);

export type AssetLifecycleState = z.infer<typeof AssetLifecycleStateSchema>;

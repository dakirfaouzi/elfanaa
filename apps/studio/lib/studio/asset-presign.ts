import {
  AssetUploadIntentSchema,
  keyForUpload,
  type AssetSource,
  type AssetUploadIntent,
  type MediaStore,
  type PresignedUpload,
} from "@platform/storage";
import {
  PersistenceError,
  type StudioDraftRepository,
} from "@platform/persistence";

/**
 * Studio-side asset presign helper.
 *
 * # What this does
 *
 *   1. Validate the operator's upload intent against
 *      `AssetUploadIntentSchema` (content-type + size + source).
 *   2. Verify the draft exists (or fail with `draft_not_found`).
 *   3. Resolve the per-store R2 bucket from the draft's storeId.
 *   4. Mint a presigned PUT URL via the MediaStore.
 *   5. Return the URL bundle to the route handler.
 *
 * The asset row is NOT created here — the operator's browser must
 * complete the PUT first, then Studio calls a confirm endpoint
 * (M11) to write `studio_asset`. M10 ships only the presign +
 * list endpoints.
 *
 * # Why not auto-confirm
 *
 * The browser PUT can fail (network, 403, etc). Auto-confirm would
 * create orphan asset rows. Explicit confirm keeps the DB clean.
 *
 * # Failure modes
 *
 *   • `invalid_intent`  — Zod validation failed.
 *   • `draft_not_found` — `draftId` does not map to a row.
 *   • `bucket_missing`  — env did not configure a bucket for the store.
 *   • `presign_failed`  — MediaStore raised StorageError.
 */
export type PresignAssetResult =
  | { status: "ok"; intent: AssetUploadIntent; presigned: PresignedUpload }
  | { status: "invalid_intent"; issues: Array<{ path: string; message: string }> }
  | { status: "draft_not_found"; draftId: string }
  | { status: "bucket_missing"; storeId: string }
  | { status: "presign_failed"; reason: string };

export interface PresignAssetOptions {
  draftId: string;
  rawIntent: unknown;
  mediaStore: MediaStore;
  draftRepo?: StudioDraftRepository;
  bucketResolver: (storeId: string) => string | undefined;
}

export async function presignAsset(
  opts: PresignAssetOptions,
): Promise<PresignAssetResult> {
  const validated = AssetUploadIntentSchema.safeParse(opts.rawIntent);
  if (!validated.success) {
    return {
      status: "invalid_intent",
      issues: validated.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const intent = validated.data;

  // Persistence is optional — when STUDIO_PERSISTENCE_MODE=file,
  // there's no draftRepo and we cannot verify the draft. In that
  // case we trust the caller (the operator's URL contains the
  // draftId) and proceed; the asset row simply won't be persisted.
  let storeId: string | undefined;
  if (opts.draftRepo) {
    try {
      const draft = await opts.draftRepo.findById(opts.draftId);
      if (!draft) {
        return { status: "draft_not_found", draftId: opts.draftId };
      }
      storeId = draft.storeId;
    } catch (err) {
      if (err instanceof PersistenceError && err.kind === "not_found") {
        return { status: "draft_not_found", draftId: opts.draftId };
      }
      throw err;
    }
  } else {
    // file-only mode — derive storeId from a heuristic; the bucket
    // resolver decides whether that's enough. For M10 we hard-code
    // "fanaa" as the single live store.
    storeId = "fanaa";
  }

  const bucket = opts.bucketResolver(storeId);
  if (!bucket) {
    return { status: "bucket_missing", storeId };
  }

  const key = keyForUpload({
    draftId: opts.draftId,
    source: intent.source as AssetSource,
    contentType: intent.contentType,
  });

  try {
    const presigned = await opts.mediaStore.presignUpload({
      bucket,
      key,
      contentType: intent.contentType,
      maxBytes: intent.bytes,
    });
    return { status: "ok", intent, presigned };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "presign_unknown";
    return { status: "presign_failed", reason };
  }
}

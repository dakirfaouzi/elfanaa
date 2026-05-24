import {
  AssetUploadIntentSchema,
  keyForIntakeUpload,
  type AssetUploadIntent,
  type MediaStore,
  type PresignedUpload,
} from "@platform/storage";

/**
 * Intake-time asset presign helper (Phase B1).
 *
 * # Why a sibling to `lib/studio/asset-presign.ts`
 *
 * The draft-attached presign flow (`presignAsset`) requires a
 * `draftId` to namespace uploads under `studio/<draftId>/...`. At
 * intake time NO draft exists yet — the operator is still filling
 * out the form, and the dispatch action is what creates the
 * `studio_draft` row. We need a parallel flow that:
 *
 *   1. Does NOT require a draftId.
 *   2. Writes to a quarantined key prefix (`studio-intake/`) so an
 *      R2 lifecycle rule can expire uncommitted uploads after 24h
 *      without touching draft-attached assets.
 *   3. Returns the eventual key in the same `PresignedUpload.ref`
 *      shape `presignAsset` uses, so the existing
 *      `IngestJob.uploadedImages[].src` contract is preserved.
 *
 * # Why this is its own helper and not a flag on presignAsset
 *
 * Branching `presignAsset` based on whether `draftId` is set
 * would tangle the two flows' failure modes:
 *
 *   • `presignAsset` MUST surface `draft_not_found` so operators
 *     can't presign against arbitrary draft ids.
 *   • `presignIntakeAsset` MUST NOT validate any draftId because
 *     none exists.
 *
 * Two helpers, one contract (`PresignedUpload`), zero ambiguity.
 *
 * # Why we still validate `storeId`
 *
 * The bucket is store-scoped. An operator who can read the page
 * proves they have a JWT but the storeId in the request is
 * client-controlled — without validation a malicious caller could
 * presign uploads against any store's bucket. We hard-pin the
 * acceptable storeIds via the `bucketResolver` callback (returns
 * `undefined` for unknown stores → `bucket_missing` result).
 *
 * # Failure modes
 *
 *   • `invalid_intent`  — Zod validation failed.
 *   • `invalid_store`   — storeId outside the regex / not allowlisted.
 *   • `bucket_missing`  — env did not configure a bucket for the store.
 *   • `presign_failed`  — MediaStore raised StorageError.
 */
export type PresignIntakeAssetResult =
  | { status: "ok"; intent: AssetUploadIntent; presigned: PresignedUpload }
  | {
      status: "invalid_intent";
      issues: Array<{ path: string; message: string }>;
    }
  | { status: "invalid_store"; storeId: string }
  | { status: "bucket_missing"; storeId: string }
  | { status: "presign_failed"; reason: string };

export interface PresignIntakeAssetOptions {
  /** Target store (FK to `studio_store`). Pre-allowlisted by the
   *  bucket resolver — pass any string, the resolver decides. */
  storeId: string;
  /** Raw JSON body from the request. Validated through
   *  `AssetUploadIntentSchema` (same schema the draft-attached
   *  presign uses — single source of truth for upload limits). */
  rawIntent: unknown;
  mediaStore: MediaStore;
  /** Resolves `storeId` → bucket name. Returns `undefined` when
   *  the store is unknown or has no configured bucket. */
  bucketResolver: (storeId: string) => string | undefined;
}

// Same regex as the storage package's STORE_ID_RE — re-asserted at
// this layer so a typo / SSRF attempt is rejected before it reaches
// the key helper (which would throw, not return a structured result).
const STORE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function presignIntakeAsset(
  opts: PresignIntakeAssetOptions,
): Promise<PresignIntakeAssetResult> {
  if (!STORE_ID_RE.test(opts.storeId)) {
    return { status: "invalid_store", storeId: opts.storeId };
  }

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

  const bucket = opts.bucketResolver(opts.storeId);
  if (!bucket) {
    return { status: "bucket_missing", storeId: opts.storeId };
  }

  // `keyForIntakeUpload` validates storeId again and throws on
  // invalid content-type — both already caught above. The cast to
  // the helper is safe.
  const key = keyForIntakeUpload({
    storeId: opts.storeId,
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

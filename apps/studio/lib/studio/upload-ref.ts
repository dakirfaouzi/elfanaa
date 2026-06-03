/**
 * Pick the durable image ref to persist from a completed upload.
 *
 * # Why this exists (Draft Asset Review MVP bug fix)
 *
 * The confirm endpoint returns `publicUrl` via `MediaStore.publicUrl()`. When
 * no public CDN base is configured for the store, `R2MediaStore.publicUrl()`
 * returns the **non-fetchable sentinel** `r2://<bucket>/<key>`. Storing that as
 * an image `src` broke the Section Images replace flow end-to-end:
 *
 *   • preview — `resolveAssetUrl("r2://…")` proxied to `/api/studio/media/r2://…`
 *     which the proxy's `parseKey()` rejects (404) → broken `<img>`.
 *   • publish — `isDurablePublicUrl("r2://…")` is false → `sanitiseCroContentImages`
 *     drops it.
 *
 * Generated images avoid this because they are stored as **bare R2 keys**
 * (`studio/<draftId>/<source>/<ulid>.<ext>`) that resolve through the proxy
 * with or without a CDN and survive the publish durability gate.
 *
 * This helper therefore prefers the bare key — making an uploaded replacement
 * behave **identically to a generated asset** — and only falls back to a real
 * `http(s)` public URL. It NEVER returns the `r2://` sentinel or an empty ref.
 */
export interface UploadRefInput {
  key?: string | null;
  publicUrl?: string | null;
}

export function durableUploadRef(upload: UploadRefInput): string {
  const key = typeof upload.key === "string" ? upload.key.trim() : "";
  if (key) return key;
  const url = typeof upload.publicUrl === "string" ? upload.publicUrl.trim() : "";
  if (url && /^https?:\/\//i.test(url)) return url;
  return "";
}

import { studioPath } from "../base-path";

/**
 * Resolve a media src into a URL the browser can actually fetch.
 *
 * # Why this exists (C3.1 follow-up)
 *
 * The intake uploader PUTs bytes to R2 via a presigned URL, then stores
 * the R2 KEY (e.g. `studio-intake/fanaa/01HZ...webp`) directly in
 * `IngestJob.uploadedImages[].src`. That key is preserved verbatim through
 * the rest of the pipeline:
 *
 *   • the AI worker → `UniversalProduct.images[].src`
 *   • `product-to-draft` → `MediaRef.desktopSrc` on every hero/gallery/
 *     before-after/video section
 *   • `publishDraft()` → frozen into `studio_published_product.document`
 *
 * The runtime renderer (`@platform/runtime-renderer/<Media>`) writes the
 * `desktopSrc` value straight into `<img src>` — so a key like
 * `studio-intake/fanaa/01HZ...webp` becomes a relative URL on the Studio
 * host, which 404s. That is what surfaces as the "ASSET PENDING" cards
 * in the catalog and the collapsed-hero look on the storefront.
 *
 * # What this helper does
 *
 * Translate R2 keys into proxy URLs that hit `/api/studio/media/<key>`,
 * which 302-redirects to a short-lived signed R2 GET URL (or a configured
 * CDN base URL). Absolute URLs (already-resolved CDN URLs, dev-mode
 * `memory://` URLs, browser blob/data URLs) pass through unchanged so
 * the helper is safe to apply to any media src in the system.
 *
 * # Relationship to `resolveImageUrl()` in `preview-props.ts`
 *
 * The legacy `resolveImageUrl()` returns a `placeholder://<key>` sentinel
 * when no CDN is configured, and the legacy `<PreviewImage>` component
 * renders that as a styled "asset pending" card. That path remains
 * untouched — it is still used by the file-system-backed product preview
 * surface (`/products/[storeId]/[productId]/preview`).
 *
 * `resolveAssetUrl()` is the NEW direction:
 *   • Used by the storefront renderer (`/p/<slug>`) and the live builder
 *     preview pane.
 *   • Used by the products catalog thumbnails (DB-published path).
 *   • ALWAYS returns a fetchable URL — the proxy is the universal
 *     fallback, so storefront <img> tags always load regardless of
 *     CDN config.
 *
 * # Returned shapes
 *
 *   • ""                 — empty / whitespace input. Callers handle.
 *   • absolute URL       — http(s)://… returned verbatim.
 *   • data: / blob:      — returned verbatim (client-side preview tiles
 *                          before the R2 upload completes).
 *   • memory://…         — returned verbatim (dev memory-store URLs the
 *                          browser handles via the local upload route).
 *   • else (R2 key)      — `${basePath}/api/studio/media/<encoded-key>`.
 *
 * Encoding: each `/` separator in the key is preserved (so the catch-all
 * route receives the segments cleanly), but every other character is
 * URI-encoded. This is important for ULIDs with no special chars but
 * keeps the helper robust against any future key shape that includes
 * spaces or unicode.
 */
export function resolveAssetUrl(src: string | null | undefined): string {
  if (!src) return "";
  const trimmed = src.trim();
  if (trimmed === "") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(data|blob|memory):/i.test(trimmed)) return trimmed;
  // Leading `/` means this is already a path (the proxy URL we'd emit,
  // or any other absolute path the caller is sure about). Pass through
  // unchanged so the helper is idempotent across double-render
  // scenarios — R2 keys NEVER start with `/`, so this is safe.
  if (trimmed.startsWith("/")) return trimmed;
  // R2 key → proxy route. Preserve `/` separators so the catch-all
  // route handler reconstructs the original key correctly.
  const encoded = trimmed
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return studioPath(`/api/studio/media/${encoded}`);
}

/**
 * True when the src is a fetchable URL (after `resolveAssetUrl` would
 * have run). Used by the catalog card to decide whether to render a
 * placeholder card or a real `<img>`.
 *
 * An empty string is the only "non-fetchable" state — everything else
 * (absolute URL, data:, blob:, memory:, or proxied R2 key) renders.
 */
export function isFetchableAssetUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  return src.trim().length > 0;
}

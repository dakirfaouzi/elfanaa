import type { ProductImage, UniversalProduct } from "@platform/catalog-schema";
import { ALLOWED_CONTENT_TYPES, keyForUpload } from "@platform/storage";
import type { StudioPersistence } from "./persistence";

/**
 * Durable persistence of AI-generated product images (M12 / Step 2 image fix).
 *
 * # The problem this solves
 *
 * The ai-engine pipeline (stages image_gen → image_post → assemble)
 * leaves each `UniversalProduct.images[].src` pointing at the image
 * VENDOR's direct URL (e.g. fal's CDN). Those URLs are ephemeral —
 * they expire per the vendor's policy and later 404. They also never
 * reach the fanaa storefront, which only reads durable, store-owned
 * data.
 *
 * This module is the missing "M5 storage layer": it downloads each
 * vendor image and re-hosts it in the store's own R2 bucket, then
 * rewrites `src` to a durable reference so the value that flows into
 * the draft document (and, on publish, into `storefront_catalog_product`)
 * survives forever.
 *
 * # Why this lives in Studio (not packages/worker)
 *
 * The worker is the cross-store orchestrator and is intentionally
 * decoupled from Studio-specific concerns (see persist-draft-payload.ts
 * JSDoc). It also has no `draftId` at image-gen time. This module runs
 * inside `persistDraftFromProduct`, which is the first point that has
 * BOTH the assembled product AND a `draftId` AND the resolved
 * `MediaStore` — exactly what `keyForUpload({ source: "generated" })`
 * and `putBytes()` need.
 *
 * # Graceful fallback (the pipeline can NEVER regress)
 *
 * Every failure mode degrades to "keep the vendor URL":
 *   • R2 not configured (driver !== "r2" / no bucket for the store) →
 *     the product is returned UNCHANGED.
 *   • A single image fails to download, has an unsupported content
 *     type, or fails to upload → that image keeps its vendor URL; the
 *     others still get re-hosted.
 *   • The whole module throws → the caller swallows it (best-effort)
 *     and proceeds with the original product.
 *
 * The worst case is therefore identical to today's behaviour (vendor
 * URLs), never worse.
 *
 * # What `src` becomes
 *
 *   • When `R2_PUBLIC_BASE_URL_FANAA` (the CDN base) is set →
 *     `https://cdn.elfanaa.com/<key>` — an absolute URL that BOTH
 *     Studio and fanaa render directly with zero extra wiring.
 *   • When R2 is configured but no CDN base is set → the bare R2 key
 *     (`studio/<draftId>/generated/<ulid>.<ext>`). Studio resolves it
 *     through `/api/studio/media`; fanaa cannot, so it shows the
 *     placeholder. We log a warning pointing the operator at the CDN
 *     env var. (Durable storage still happened — only the public read
 *     path is missing.)
 */

const FETCH_TIMEOUT_MS = 15_000;
/** Hard cap so a malicious/huge vendor asset can't OOM the box. 25 MiB. */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export interface PersistGeneratedImagesArgs {
  product: UniversalProduct;
  draftId: string;
  storeId: string;
  persistence: StudioPersistence;
}

/**
 * Re-host every vendor-hosted image on the product into the store's R2
 * bucket and return a NEW product whose `images[].src` point at the
 * durable reference. Returns the input product unchanged when R2 is
 * not available or nothing needs re-hosting.
 */
export async function persistGeneratedImages(
  args: PersistGeneratedImagesArgs,
): Promise<UniversalProduct> {
  const { product, draftId, storeId, persistence } = args;

  // ── Guard: R2 actually configured for this store? ──────────────
  const r2 = persistence.config.r2;
  if (r2.driver !== "r2") {
    // Memory driver (local dev / R2 not wired). Keep vendor URLs.
    return product;
  }
  const bucket = r2.buckets[storeId];
  if (!bucket) {
    console.warn(
      `[persist-generated-images] no R2 bucket for storeId=${storeId} — keeping vendor image URLs (set R2_BUCKET_FANAA)`,
    );
    return product;
  }
  const publicBaseUrl = r2.publicBaseUrls[storeId];
  if (!publicBaseUrl) {
    console.warn(
      `[persist-generated-images] R2 configured but no R2_PUBLIC_BASE_URL_FANAA — generated images will be durable but NOT visible on the fanaa storefront until a CDN base is set`,
    );
  }

  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length === 0) return product;

  let rewroteAny = false;
  const nextImages: ProductImage[] = [];

  for (const image of images) {
    const rehosted = await rehostOne({
      image,
      draftId,
      bucket,
      publicBaseUrl,
      mediaStore: persistence.mediaStore,
    });
    if (rehosted && rehosted !== image.src) {
      rewroteAny = true;
      nextImages.push({ ...image, src: rehosted });
    } else {
      nextImages.push(image);
    }
  }

  if (!rewroteAny) return product;
  return { ...product, images: nextImages };
}

/**
 * Re-host a single image. Returns the durable reference on success, or
 * the original `src` (unchanged) on any failure / skip. Never throws.
 */
async function rehostOne(args: {
  image: ProductImage;
  draftId: string;
  bucket: string;
  publicBaseUrl: string | undefined;
  mediaStore: StudioPersistence["mediaStore"];
}): Promise<string> {
  const { image, draftId, bucket, publicBaseUrl, mediaStore } = args;
  const src = typeof image.src === "string" ? image.src.trim() : "";

  // Only re-host vendor HTTP(S) URLs. Skip data URLs, already-durable
  // R2 keys (`studio/...`, `studio-intake/...`), and anything already
  // pointing at our own CDN.
  if (!/^https?:\/\//i.test(src)) return image.src;
  if (publicBaseUrl && src.startsWith(publicBaseUrl)) return image.src;

  try {
    const downloaded = await downloadImage(src);
    if (!downloaded) return image.src;

    const key = keyForUpload({
      draftId,
      source: "generated",
      contentType: downloaded.contentType,
    });

    await mediaStore.putBytes({
      bucket,
      key,
      contentType: downloaded.contentType,
      body: downloaded.body,
    });

    const ref = mediaStore.publicUrl({ bucket, key, publicBaseUrl });
    // Store an absolute URL ONLY when it's a real public host. Guard
    // against R2_PUBLIC_BASE_URL_FANAA being misconfigured to the
    // PRIVATE S3 API endpoint (`<account>.r2.cloudflarestorage.com`),
    // which requires SigV4 auth and is NOT browser-fetchable — persisting
    // it produces the exact "image pending" failure we just fixed. In
    // that case (and when no public base is set → the `r2://` sentinel)
    // store the bare KEY instead: fanaa resolves keys to the public CDN
    // at render time, so the storefront stays correct regardless of how
    // the env is configured.
    if (ref.startsWith("http") && !/r2\.cloudflarestorage\.com/i.test(ref)) {
      return ref;
    }
    return key;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[persist-generated-images] rehost_failed keeping vendor URL src=${truncate(src, 120)} error=${message}`,
    );
    return image.src;
  }
}

interface DownloadedImage {
  contentType: string;
  body: Uint8Array;
}

/**
 * Fetch the vendor image bytes. Returns `null` (caller keeps the
 * vendor URL) when the response is not OK, the content type is not an
 * allowed image type, or the payload exceeds the size cap.
 */
async function downloadImage(url: string): Promise<DownloadedImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(
        `[persist-generated-images] download_not_ok status=${res.status} url=${truncate(url, 120)}`,
      );
      return null;
    }

    const rawType = (res.headers.get("content-type") ?? "")
      .split(";")[0]!
      .toLowerCase()
      .trim();
    const contentType = normaliseContentType(rawType, url);
    if (!contentType) {
      console.warn(
        `[persist-generated-images] unsupported_content_type type=${rawType} url=${truncate(url, 120)}`,
      );
      return null;
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(
        `[persist-generated-images] bad_size bytes=${buffer.byteLength} url=${truncate(url, 120)}`,
      );
      return null;
    }
    return { contentType, body: buffer };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a usable, allow-listed image content type. Falls back to the
 * URL extension when the server sends a generic type (some vendor CDNs
 * return `application/octet-stream` or `binary/octet-stream`).
 */
function normaliseContentType(rawType: string, url: string): string | null {
  if (rawType && ALLOWED_CONTENT_TYPES[rawType]) return rawType;
  const ext = extractExtension(url);
  const byExt: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  const guessed = ext ? byExt[ext] : undefined;
  return guessed ?? null;
}

function extractExtension(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = /\.([a-z0-9]+)$/i.exec(pathname);
    return match ? match[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

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
 * Re-host EVERY vendor-hosted image on the product into the store's R2
 * bucket and return a NEW product whose `images[].src` AND
 * `lifestyleImages[].src` point at durable references. Returns the input
 * product unchanged when R2 is not available or nothing needs re-hosting.
 *
 * # Why both arrays (Step 4 Phase 4.5)
 *
 * `assemble` puts the hero + gallery in `product.images` but the generated
 * lifestyle shots in a SEPARATE `product.lifestyleImages` array. Before 4.5
 * this function only iterated `images`, so every lifestyle image kept its
 * ephemeral vendor (fal) URL and 404'd after the vendor TTL — the recurring
 * "image pending" / broken lifestyle band. Re-hosting both arrays here, while
 * the vendor URLs are still alive (right after generation), is the durable
 * fix. The publish hero gate (`drafts-service`) is the second line of defence
 * that GUARANTEES no vendor URL ever reaches the storefront.
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

  const ctx = {
    draftId,
    bucket,
    publicBaseUrl,
    mediaStore: persistence.mediaStore,
  };

  const images = Array.isArray(product.images) ? product.images : [];
  const lifestyle = Array.isArray(product.lifestyleImages)
    ? product.lifestyleImages
    : [];
  if (images.length === 0 && lifestyle.length === 0) return product;

  const rehostList = async (
    list: ProductImage[],
  ): Promise<{ next: ProductImage[]; rewrote: boolean }> => {
    let rewrote = false;
    const next: ProductImage[] = [];
    for (const image of list) {
      const durable = await rehostImageUrl({ src: image.src, ...ctx });
      if (durable && durable !== image.src) {
        rewrote = true;
        next.push({ ...image, src: durable });
      } else {
        next.push(image);
      }
    }
    return { next, rewrote };
  };

  const imagesResult = await rehostList(images);
  const lifestyleResult = await rehostList(lifestyle);

  if (!imagesResult.rewrote && !lifestyleResult.rewrote) return product;

  const out: UniversalProduct = { ...product };
  if (imagesResult.rewrote) out.images = imagesResult.next;
  if (lifestyleResult.rewrote) out.lifestyleImages = lifestyleResult.next;
  return out;
}

/**
 * Re-host a single image SRC into durable R2 storage and return the durable
 * reference, or `null` on any skip / failure (the caller then keeps the
 * original src). Never throws.
 *
 * Skip (returns `null`, caller keeps original):
 *   • non-HTTP(S) values (data URLs, bare R2 keys, anything already durable),
 *   • a value already on our own public CDN base.
 *
 * Exported so the publish hero gate can re-attempt a last-chance re-host when
 * it finds a foreign/vendor hero URL that slipped past persist time.
 */
export async function rehostImageUrl(args: {
  src: unknown;
  draftId: string;
  bucket: string;
  publicBaseUrl: string | undefined;
  mediaStore: StudioPersistence["mediaStore"];
}): Promise<string | null> {
  const { draftId, bucket, publicBaseUrl, mediaStore } = args;
  const src = typeof args.src === "string" ? args.src.trim() : "";

  if (!/^https?:\/\//i.test(src)) return null;
  if (publicBaseUrl && src.startsWith(publicBaseUrl)) return null;

  try {
    const downloaded = await downloadImage(src);
    if (!downloaded) return null;

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
    // store the bare KEY instead: fanaa + the Studio media proxy both
    // resolve keys to the public CDN at render time, so the storefront
    // stays correct regardless of how the env is configured.
    if (ref.startsWith("http") && !/r2\.cloudflarestorage\.com/i.test(ref)) {
      return ref;
    }
    return key;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[persist-generated-images] rehost_failed keeping vendor URL src=${truncate(src, 120)} error=${message}`,
    );
    return null;
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

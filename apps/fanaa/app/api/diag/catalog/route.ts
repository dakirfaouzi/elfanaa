import { NextResponse } from "next/server";
import { isAdminDbConfigured, prisma } from "@/lib/admin/db";
import { synthesiseProductFromRow } from "@/lib/catalog/merge";
import type { CatalogRow } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/diag/catalog?slug=<slug> — read-only image-pipeline trace.
 *
 * Temporary diagnostics endpoint (M12 / Step 2 image fix). Given a
 * product slug it dumps the ACTUAL persisted values at every stage so
 * we can pinpoint exactly where an AI-generated image URL is lost
 * between publish and the storefront Product object:
 *
 *   1. studio_draft.payload         → hero media.desktopSrc, ogImage, images[]
 *   2. studio_published_product     → published hero + extractHeroImageUrl()
 *   3. storefront_catalog_product   → hero_image_url (the column fanaa reads)
 *   4. synthesiseProductFromRow()   → final Product.images
 *   5. firstImageSrc                → the exact src handed to ProductCard /
 *                                     ProductGallery (= images[0].src)
 *
 * It exposes only image URLs + non-sensitive catalog metadata. No
 * credentials, no DB URL. Remove once the pipeline is verified.
 */

const STORE_ID = "fanaa";

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "missing ?slug" },
      { status: 400, headers: noStore() },
    );
  }
  if (!isAdminDbConfigured) {
    return NextResponse.json(
      { ok: false, error: "admin_db_unconfigured (ADMIN_DATABASE_URL not set on web service)" },
      { status: 503, headers: noStore() },
    );
  }

  const out: Record<string, unknown> = { ok: true, slug, storeId: STORE_ID };

  // ── 1. Draft document ────────────────────────────────────────────
  try {
    const draft = await prisma.studioDraft.findFirst({
      where: { storeId: STORE_ID, slug },
      select: { id: true, payload: true, payloadVersion: true, status: true },
    });
    out.draft = draft
      ? {
          id: draft.id,
          status: draft.status,
          payloadVersion: draft.payloadVersion,
          ...summariseDocument(draft.payload),
        }
      : null;
  } catch (err) {
    out.draftError = message(err);
  }

  // ── 2. Published snapshot + extractHeroImageUrl ───────────────────
  try {
    const published = await prisma.studioPublishedProduct.findFirst({
      where: { storeId: STORE_ID, slug, isCurrent: true },
      orderBy: { version: "desc" },
      select: { id: true, version: true, document: true },
    });
    if (published) {
      out.published = {
        id: published.id,
        version: published.version,
        ...summariseDocument(published.document),
      };
      out.extractHeroImageUrl = extractHeroImageUrl(published.document);
    } else {
      out.published = null;
    }
  } catch (err) {
    out.publishedError = message(err);
  }

  // ── 3. storefront_catalog_product row ─────────────────────────────
  let row: CatalogRow | null = null;
  try {
    const found = (await prisma.storefrontCatalogProduct.findFirst({
      where: { storeId: STORE_ID, slug },
    })) as unknown as CatalogRow | null;
    row = found;
    out.catalogRow = found
      ? {
          id: found.id,
          source: found.source,
          isLive: found.isLive,
          publishedProductId: found.publishedProductId,
          priceMinor: found.priceMinor,
          heroImageUrl: found.heroImageUrl,
          heroImageUrlType: classifyUrl(found.heroImageUrl),
        }
      : null;
  } catch (err) {
    out.catalogRowError = message(err);
  }

  // ── 4 + 5. synthesise + final rendered src ────────────────────────
  if (row) {
    try {
      const product = synthesiseProductFromRow(row);
      const firstSrc = product.images[0]?.src ?? null;
      out.synthesised = {
        imageCount: product.images.length,
        images: product.images.map((i) => ({
          src: i.src,
          srcType: classifyUrl(i.src),
        })),
        firstImageSrc: firstSrc,
        firstImageSrcType: classifyUrl(firstSrc),
        isPlaceholder: typeof firstSrc === "string" && firstSrc.startsWith("data:"),
      };
    } catch (err) {
      out.synthesiseError = message(err);
    }
  }

  return NextResponse.json(out, { headers: noStore() });
}

/* -------------------------------------------------------------------------- */
/*                                 Helpers                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mirror of `extractHeroImageUrl` in
 * apps/studio/lib/studio/drafts-service.ts. Duplicated (not imported)
 * because that module is server-only Studio code with a heavy import
 * graph; the logic is tiny and stable.
 */
function extractHeroImageUrl(document: unknown): string | null {
  const doc = document as
    | { sections?: unknown; meta?: { ogImage?: unknown } }
    | null
    | undefined;
  const sections = Array.isArray(doc?.sections) ? doc!.sections : [];
  for (const section of sections) {
    if (!section || (section as { kind?: unknown }).kind !== "hero") continue;
    const media = (section as { media?: unknown }).media as
      | { kind?: unknown; desktopSrc?: unknown }
      | null
      | undefined;
    if (media && media.kind === "image" && typeof media.desktopSrc === "string") {
      const src = media.desktopSrc.trim();
      if (src) return src;
    }
  }
  const ogImage = doc?.meta?.ogImage;
  if (typeof ogImage === "string" && ogImage.trim()) return ogImage.trim();
  return null;
}

/** Pull the image-relevant fields out of a DraftDocument JSON blob. */
function summariseDocument(document: unknown): {
  heroDesktopSrc: string | null;
  heroDesktopSrcType: string;
  ogImage: string | null;
  galleryImageSrcs: string[];
} {
  const doc = document as
    | { sections?: unknown; meta?: { ogImage?: unknown } }
    | null
    | undefined;
  const sections = Array.isArray(doc?.sections) ? doc!.sections : [];

  let heroDesktopSrc: string | null = null;
  const galleryImageSrcs: string[] = [];
  for (const section of sections) {
    const kind = (section as { kind?: unknown })?.kind;
    if (kind === "hero") {
      const media = (section as { media?: { kind?: unknown; desktopSrc?: unknown } })
        ?.media;
      if (media && media.kind === "image" && typeof media.desktopSrc === "string") {
        heroDesktopSrc = media.desktopSrc;
      }
    }
    if (kind === "image_gallery") {
      const items = (section as { items?: unknown })?.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const src = (item as { desktopSrc?: unknown })?.desktopSrc;
          if (typeof src === "string") galleryImageSrcs.push(src);
        }
      }
    }
  }

  const ogImageRaw = doc?.meta?.ogImage;
  const ogImage = typeof ogImageRaw === "string" ? ogImageRaw : null;

  return {
    heroDesktopSrc,
    heroDesktopSrcType: classifyUrl(heroDesktopSrc),
    ogImage,
    galleryImageSrcs,
  };
}

/**
 * Classify a src so the trace is readable at a glance without leaking
 * the full value's nature being ambiguous. Tells us immediately
 * whether the URL is durable (cdn), ephemeral (vendor), an un-resolved
 * R2 key, a placeholder, or absent.
 */
function classifyUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "none";
  const v = value.trim();
  if (v.startsWith("data:")) return "data-url (placeholder)";
  if (v.startsWith("studio/") || v.startsWith("studio-intake/")) return "r2-key (no CDN — fanaa can't serve)";
  if (/^https?:\/\//i.test(v)) {
    try {
      const host = new URL(v).hostname;
      return `absolute-url (${host})`;
    } catch {
      return "absolute-url (unparseable)";
    }
  }
  return "other";
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function noStore(): Record<string, string> {
  return { "cache-control": "no-store, max-age=0" };
}

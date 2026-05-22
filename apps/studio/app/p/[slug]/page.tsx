import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "@platform/runtime-renderer/css";
import { DraftRenderer, buildPageMetadata } from "@platform/runtime-renderer";
import {
  findCurrentPublished,
  getDraft,
} from "@/lib/studio/drafts-service";
import { fanaaStore } from "@platform/stores";

/**
 * /p/[slug] — Studio storefront runtime renderer.
 *
 * This is the server-rendered "preview/runtime" surface the brief
 * requires:
 *
 *   • Renders Studio sections dynamically via the shared
 *     `@platform/runtime-renderer` package.
 *   • Mobile-first (the renderer ships responsive inline styles +
 *     a small CSS sidecar imported above).
 *   • Server components only — `useEffect`/`useState`/etc. never
 *     execute here. Lazy media loading via the renderer's `<img>`
 *     `loading="lazy"` + `<video preload="metadata">`.
 *   • SEO-safe metadata + dynamic OG tags via `generateMetadata`.
 *
 * # Lookup order
 *
 *   1. Latest current published snapshot for the slug.
 *      → renders the immutable snapshot. This is what real visitors
 *      would see when M12 wires apps/fanaa to this renderer.
 *
 *   2. Fallback: a draft with the slug + `?preview=1` query (lets
 *      operators preview drafts that have never been published).
 *      Drafts in non-preview mode are NEVER rendered to anonymous
 *      visitors — the route is JWT-gated by the Studio middleware
 *      anyway, but the fallback only kicks in when the operator
 *      explicitly opts in via the query string.
 *
 *   3. 404.
 *
 * # apps/fanaa isolation
 *
 * This page lives inside apps/studio. apps/fanaa is NOT modified
 * in M11; the wiring there is deferred to M12.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string; draftId?: string; locale?: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const primary = sp.locale === "en" ? "en" : "ar";

  const resolved = await resolveDocument({ slug, preview: !!sp.preview, draftId: sp.draftId });
  if (!resolved) return { robots: { index: false, follow: false } };

  const md = buildPageMetadata(resolved.document, { primary });
  return {
    title: md.title || slug,
    description: md.description,
    robots: resolved.kind === "draft"
      ? { index: false, follow: false }
      : { index: false, follow: false }, // Studio runtime — never index for now
    openGraph: {
      title: md.ogTitle,
      description: md.ogDescription,
      images: md.ogImage ? [md.ogImage] : undefined,
      locale: md.locale,
      type: "website",
    },
  };
}

export default async function PSlugPage(props: PageProps) {
  const { slug } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const primary = sp.locale === "en" ? "en" : "ar";

  const resolved = await resolveDocument({
    slug,
    preview: !!sp.preview,
    draftId: sp.draftId,
  });
  if (!resolved) {
    notFound();
  }

  return (
    <article style={{ background: "#fff", color: "#1a1a1a", minHeight: "100vh" }}>
      {resolved.kind === "draft" ? (
        <div
          style={{
            background: "#fdf6e3",
            color: "#7a5a00",
            padding: "8px 16px",
            fontSize: 12,
            textAlign: "center",
            borderBottom: "1px solid #f0e3b4",
          }}
        >
          Preview mode — this is a DRAFT (not yet published).
        </div>
      ) : null}
      <DraftRenderer document={resolved.document} primary={primary} />
    </article>
  );
}

async function resolveDocument(args: {
  slug: string;
  preview: boolean;
  draftId?: string;
}) {
  // 1. Published current.
  const published = await findCurrentPublished({
    storeId: fanaaStore.id,
    slug: args.slug,
  });
  if (published.ok) {
    return { kind: "published" as const, document: published.value.document };
  }
  if (!args.preview) {
    return null;
  }
  if (args.draftId) {
    const draft = await getDraft(args.draftId);
    if (draft.ok && draft.value.slug === args.slug) {
      return { kind: "draft" as const, document: draft.value.document };
    }
  }
  return null;
}

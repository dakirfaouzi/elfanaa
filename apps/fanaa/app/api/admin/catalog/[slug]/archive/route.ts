import { NextResponse } from "next/server";
import { isAdminDbConfigured } from "@/lib/admin/db";
import { archiveProduct } from "@/lib/catalog/admin-writes";
import { revalidateCatalogSurfaces } from "@/lib/catalog/revalidate-catalog";
import { getAdminActor } from "@/lib/admin/actor";
import { explain } from "@/lib/admin/safe";
import { archiveSourceFor, normaliseReason } from "@/lib/catalog/admin-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Archive a catalog product (Catalog PR C).
 *
 * Auth is enforced by `middleware.ts` for every `/api/admin/*` path. This
 * handler archives by `(storeId="fanaa", slug)`, records the operator + an
 * optional reason, then invalidates the storefront ISR caches so the product
 * disappears within seconds. Reversible via the sibling `restore` route.
 *
 * Body (optional): `{ reason?: string; source?: "ai" | "legacy" }`.
 * `source` only matters when archiving a curated product with no DB row (it
 * stamps the tombstone's provenance); AI/existing rows ignore it.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }
  if (!isAdminDbConfigured) {
    return NextResponse.json(
      { error: "db_not_configured", hint: "ADMIN_DATABASE_URL is not set." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    reason?: unknown;
    source?: unknown;
  };
  const reason = normaliseReason(typeof body.reason === "string" ? body.reason : null);
  const source = body.source === "ai" ? archiveSourceFor("ai") : archiveSourceFor("legacy");

  try {
    const actor = await getAdminActor();
    const result = await archiveProduct({ slug, source, reason, actor });
    revalidateCatalogSurfaces();
    return NextResponse.json({ ok: true, status: "archived", ...result });
  } catch (err) {
    return NextResponse.json(
      { error: "archive_failed", hint: explain(err) },
      { status: 500 },
    );
  }
}

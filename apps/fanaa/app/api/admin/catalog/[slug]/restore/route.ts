import { NextResponse } from "next/server";
import { isAdminDbConfigured } from "@/lib/admin/db";
import { restoreProduct } from "@/lib/catalog/admin-writes";
import { revalidateCatalogSurfaces } from "@/lib/catalog/revalidate-catalog";
import { explain } from "@/lib/admin/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restore an archived catalog product (Catalog PR C).
 *
 * The inverse of the `archive` route: clears the archive marker, flips
 * `isLive=true`, and revalidates the storefront so the product reappears.
 * Returns 404 when no row exists for the slug (you can only restore something
 * that was archived).
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
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

  try {
    const result = await restoreProduct({ slug });
    revalidateCatalogSurfaces();
    return NextResponse.json({ ok: true, status: "live", ...result });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json(
        { error: "not_found", hint: `No archived row for slug "${slug}".` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "restore_failed", hint: explain(err) },
      { status: 500 },
    );
  }
}

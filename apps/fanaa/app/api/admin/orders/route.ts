import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, isAdminDbConfigured, adminDbConfigError } from "@/lib/admin/db";
import { resolveRange } from "@/lib/admin/date-range";
import { serialise } from "@/lib/admin/serialise";
import { safe, collectErrors } from "@/lib/admin/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_PAGE = { rows: [] as unknown[], total: 0, page: 1, pageSize: 25, pages: 1 };

/**
 * GET /api/admin/orders
 *
 * Search / filter / sort / paginate. Wrapped in `safe()` so a single
 * bad page doesn't take the whole orders tab down — the UI gets an
 * empty result + `_errors` and stays useable.
 */
export async function GET(req: Request) {
  if (!isAdminDbConfigured) {
    return NextResponse.json(
      serialise({
        ...EMPTY_PAGE,
        _errors: [
          {
            label: "db.config",
            error: adminDbConfigError() ?? "ADMIN_DATABASE_URL is not set.",
          },
        ],
      })
    );
  }

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "created_desc";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25")));

  const where: Prisma.OrderMirrorWhereInput = {
    createdAt: { gte: range.from, lte: range.to },
  };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.OrderMirrorOrderByWithRelationInput = (() => {
    switch (sort) {
      case "created_asc":
        return { createdAt: "asc" };
      case "total_desc":
        return { totalMinor: "desc" };
      case "total_asc":
        return { totalMinor: "asc" };
      default:
        return { createdAt: "desc" };
    }
  })();

  const result = await safe(
    "orders.list",
    async () => {
      const [rows, total] = await Promise.all([
        prisma.orderMirror.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { items: true },
        }),
        prisma.orderMirror.count({ where }),
      ]);
      return {
        rows,
        total,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      };
    },
    { ...EMPTY_PAGE, page, pageSize } as typeof EMPTY_PAGE
  );

  return NextResponse.json(serialise({ ...result.data, _errors: collectErrors([result]) }));
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/admin/db";
import { resolveRange } from "@/lib/admin/date-range";
import { serialise } from "@/lib/admin/serialise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders
 *
 * Query params:
 *   range, from, to        — date window (defaults: last 30d)
 *   q                      — search across name / phone / city / id
 *   status                 — pending | shipped | delivered | cancelled
 *   sort                   — created_desc | created_asc | total_desc | total_asc
 *   page                   — 1-indexed page number
 *   pageSize               — default 25, max 100
 */
export async function GET(req: Request) {
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

  return NextResponse.json(
    serialise({
      rows,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    })
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";
import { serialise } from "@/lib/admin/serialise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await prisma.orderMirror.findUnique({
    where: { id },
    include: {
      items: true,
      session: { include: { traffic: true } },
      visitor: true,
    },
  });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(serialise(order));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    notes?: string;
  };
  const data: { status?: string; notes?: string } = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.notes === "string") data.notes = body.notes;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  const updated = await prisma.orderMirror.update({ where: { id }, data, include: { items: true } });
  return NextResponse.json(serialise(updated));
}

import { NextResponse } from "next/server";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PUT /api/studio/uploads/local/<bucket>/<key>
 *
 * Local-upload fallback for `STORAGE_DRIVER=memory` development.
 *
 * In production (`STORAGE_DRIVER=r2`), the browser PUTs to a presigned
 * R2 URL and never hits Studio. In memory mode there's no real
 * remote — we still want the same `presign + browser PUT + confirm`
 * shape so the client code remains identical. This endpoint catches
 * those PUTs and writes them into the in-memory MediaStore.
 *
 * # Routing
 *
 * The catch-all `[...path]` captures `<bucket>/<key...>` so any key
 * shape (`studio/<draftId>/upload/<ulid>.<ext>`) works.
 *
 * # Why a PUT (not POST)
 *
 * Matches the production R2 flow. Same HTTP verb, same Content-Type
 * header expectations — no client-side branching.
 *
 * # Production safety
 *
 * When `STORAGE_DRIVER !== "memory"` this endpoint returns 410 Gone.
 * It exists ONLY for local development; production deployments hit
 * R2 directly.
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const persistence = getStudioPersistence();
  if (persistence.config.r2.driver !== "memory") {
    return NextResponse.json(
      { error: "local_upload_disabled", driver: persistence.config.r2.driver },
      { status: 410 },
    );
  }
  const params = await ctx.params;
  if (!params.path || params.path.length < 2) {
    return NextResponse.json(
      { error: "path_too_short", hint: "expected /<bucket>/<key...>" },
      { status: 400 },
    );
  }
  const [bucket, ...keyParts] = params.path;
  const key = keyParts.join("/");
  const contentType =
    req.headers.get("content-type") ?? "application/octet-stream";
  const body = new Uint8Array(await req.arrayBuffer());

  // Sanity cap — the presign step enforces 50 MiB; this is a
  // belt-and-braces check for the local path so a misbehaving
  // client can't OOM the dev box.
  if (body.byteLength > 60 * 1024 * 1024) {
    return NextResponse.json(
      { error: "too_large", bytes: body.byteLength },
      { status: 413 },
    );
  }

  await persistence.mediaStore.putBytes({
    bucket: bucket!,
    key,
    contentType,
    body,
  });
  return new NextResponse(null, { status: 200 });
}

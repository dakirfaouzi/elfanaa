import {
  PersistenceError,
  type AssetSeed,
  type PrismaLike,
  type StudioAssetRow,
  type StudioAssetSourceValue,
} from "../contracts";

/**
 * StudioAssetRepository — typed wrapper around `prisma.studioAsset`.
 *
 * # Lifecycle
 *
 * Studio's presign endpoint mints a key + R2 URL but does NOT
 * create an asset row until the upload is confirmed (the operator's
 * browser PUTs to R2, then Studio re-issues a HEAD probe via
 * `MediaStore.exists` and calls `create()`). The asset row is the
 * source-of-truth that an upload exists; without it, the bytes in
 * R2 are orphaned and the lifecycle policy reclaims them after
 * 180 days.
 *
 * # M10 scope
 *
 *   • CRUD wrapped with PersistenceError mapping.
 *   • List by draft + source for the asset browser endpoint.
 *   • Delete (used by the operator-triggered "remove" action).
 *
 * # Deferred
 *
 *   • Bulk delete via lifecycle policy (R2-managed).
 *   • Embedding sidecar (M12 pgvector upsell-match).
 */
export class StudioAssetRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  async create(seed: AssetSeed): Promise<StudioAssetRow> {
    try {
      return await this.prisma.studioAsset.create({
        data: {
          draftId: seed.draftId,
          source: seed.source,
          r2Bucket: seed.bucket,
          r2Key: seed.key,
          contentType: seed.contentType,
          bytes: seed.bytes,
          width: seed.width ?? null,
          height: seed.height ?? null,
          altAr: seed.altAr ?? null,
          altEn: seed.altEn ?? null,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "create_asset");
    }
  }

  async findById(id: string): Promise<StudioAssetRow | null> {
    try {
      return await this.prisma.studioAsset.findUnique({ where: { id } });
    } catch (err) {
      throw wrapDbError(err, "find_asset");
    }
  }

  async findByKey(key: string): Promise<StudioAssetRow | null> {
    try {
      return await this.prisma.studioAsset.findUnique({
        where: { r2Key: key },
      });
    } catch (err) {
      throw wrapDbError(err, "find_asset_by_key");
    }
  }

  async listForDraft(args: {
    draftId: string;
    source?: StudioAssetSourceValue;
    take?: number;
  }): Promise<StudioAssetRow[]> {
    try {
      return await this.prisma.studioAsset.findMany({
        where: {
          draftId: args.draftId,
          ...(args.source ? { source: args.source } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.take ?? 100, 1000),
      });
    } catch (err) {
      throw wrapDbError(err, "list_assets");
    }
  }

  /**
   * M11 — cross-draft listing for the global asset browser.
   *
   * Supports pagination via `cursor` (last seen `createdAt`) so the
   * browser can fetch the next page without offset scans.
   */
  async listAll(args: {
    storeId?: string;
    contentTypePrefix?: string;
    take?: number;
    cursorCreatedAt?: Date;
  } = {}): Promise<StudioAssetRow[]> {
    try {
      return await this.prisma.studioAsset.findMany({
        where: {
          ...(args.cursorCreatedAt
            ? { createdAt: { lt: args.cursorCreatedAt } }
            : {}),
          ...(args.contentTypePrefix
            ? { contentType: { startsWith: args.contentTypePrefix } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.take ?? 60, 200),
      });
    } catch (err) {
      throw wrapDbError(err, "list_all_assets");
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.studioAsset.delete({ where: { id } });
    } catch (err) {
      throw wrapDbError(err, "delete_asset");
    }
  }
}

function wrapDbError(err: unknown, op: string): PersistenceError {
  if (err instanceof PersistenceError) return err;
  const e = err as { code?: string; message?: string };
  if (e?.code === "P2025") {
    return new PersistenceError({
      kind: "not_found",
      message: `${op}_not_found:${e.message ?? ""}`,
      cause: err,
    });
  }
  if (e?.code === "P2002") {
    return new PersistenceError({
      kind: "conflict",
      message: `${op}_conflict:${e.message ?? ""}`,
      cause: err,
    });
  }
  return new PersistenceError({
    kind: "unknown",
    message: `${op}_failed:${e?.message ?? "unknown"}`,
    cause: err,
  });
}

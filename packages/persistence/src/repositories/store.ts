import {
  PersistenceError,
  type PrismaLike,
  type StudioStoreRow,
  type StudioStoreStatusValue,
} from "../contracts";

/**
 * StudioStoreRepository — manages the `studio_store` registry rows.
 *
 * Stores are seeded ONCE per registered storefront (M10 has Fanaa
 * only; M11 adds the second store). The `configHash` lets us detect
 * StoreConfig drift across deploys.
 *
 * # Why an `upsert` helper
 *
 * Studio's persistence bootstrap calls `upsert` on every cold start
 * — the store row is idempotently created or refreshed in case the
 * `configHash` changed between deploys. This is cheap (one indexed
 * lookup) and ensures the FK chain (`studio_draft.store_id`) is
 * always satisfiable.
 */
export class StudioStoreRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  async upsert(args: {
    id: string;
    displayName: string;
    configHash: string;
    status?: StudioStoreStatusValue;
  }): Promise<StudioStoreRow> {
    try {
      return await this.prisma.studioStore.upsert({
        where: { id: args.id },
        create: {
          id: args.id,
          displayName: args.displayName,
          configHash: args.configHash,
          status: args.status ?? "live",
        },
        update: {
          displayName: args.displayName,
          configHash: args.configHash,
          ...(args.status ? { status: args.status } : {}),
        },
      });
    } catch (err) {
      throw wrapDbError(err, "upsert_store");
    }
  }

  async findById(id: string): Promise<StudioStoreRow | null> {
    try {
      return await this.prisma.studioStore.findUnique({ where: { id } });
    } catch (err) {
      throw wrapDbError(err, "find_store");
    }
  }
}

function wrapDbError(err: unknown, op: string): PersistenceError {
  if (err instanceof PersistenceError) return err;
  const e = err as { message?: string };
  return new PersistenceError({
    kind: "unknown",
    message: `${op}_failed:${e?.message ?? "unknown"}`,
    cause: err,
  });
}

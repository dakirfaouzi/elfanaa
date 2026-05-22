import {
  PersistenceError,
  type DraftSeed,
  type PrismaLike,
  type StudioDraftRow,
  type StudioDraftStatusValue,
} from "../contracts";

/**
 * StudioDraftRepository — typed wrapper around `prisma.studioDraft`.
 *
 * # Why a repository (vs. raw Prisma calls in Studio routes)
 *
 *   • Centralises the slug-uniqueness logic + a single
 *     `wrapDbError` layer that maps Prisma's `P2002` to
 *     `PersistenceError{conflict}`.
 *   • Lets the studio inject mocks for tests without import-time
 *     coupling to Prisma codegen.
 *   • Keeps the `studio_draft.status` state machine in one place
 *     (intake → generating → ready → publishing → published →
 *     archived, with `failed` as a sink from any state).
 *
 * # Slug generation
 *
 * Drafts are uniquely keyed by `(storeId, slug)`. Slugs are
 * supplied by the caller (Studio passes the operator-derived
 * runId-based slug). This repository does NOT mint slugs —
 * uniqueness violations bubble up as `PersistenceError{conflict}`.
 */
export class StudioDraftRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  async create(seed: DraftSeed): Promise<StudioDraftRow> {
    try {
      return await this.prisma.studioDraft.create({
        data: {
          storeId: seed.storeId,
          slug: seed.slug,
          title: seed.title,
          template: seed.template,
          supplierUrl: seed.supplierUrl ?? null,
          notes: seed.notes ?? null,
          positioning: seed.positioning ?? null,
          createdBy: seed.createdBy ?? "system",
          status: "intake",
        },
      });
    } catch (err) {
      throw wrapDbError(err, "create_draft");
    }
  }

  async findById(id: string): Promise<StudioDraftRow | null> {
    try {
      return await this.prisma.studioDraft.findUnique({ where: { id } });
    } catch (err) {
      throw wrapDbError(err, "find_draft");
    }
  }

  async findBySlug(args: {
    storeId: string;
    slug: string;
  }): Promise<StudioDraftRow | null> {
    try {
      return await this.prisma.studioDraft.findUnique({
        where: { storeId_slug: { storeId: args.storeId, slug: args.slug } },
      });
    } catch (err) {
      throw wrapDbError(err, "find_draft_by_slug");
    }
  }

  async list(args: {
    storeId?: string;
    status?: StudioDraftStatusValue;
    take?: number;
  } = {}): Promise<StudioDraftRow[]> {
    try {
      return await this.prisma.studioDraft.findMany({
        where: {
          ...(args.storeId ? { storeId: args.storeId } : {}),
          ...(args.status ? { status: args.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.take ?? 50, 1000),
      });
    } catch (err) {
      throw wrapDbError(err, "list_drafts");
    }
  }

  async updateStatus(args: {
    id: string;
    status: StudioDraftStatusValue;
    publishedAt?: Date;
    publishedRef?: string;
  }): Promise<StudioDraftRow> {
    try {
      return await this.prisma.studioDraft.update({
        where: { id: args.id },
        data: {
          status: args.status,
          ...(args.publishedAt ? { publishedAt: args.publishedAt } : {}),
          ...(args.publishedRef ? { publishedRef: args.publishedRef } : {}),
        },
      });
    } catch (err) {
      throw wrapDbError(err, "update_draft_status");
    }
  }

  async incrementCost(args: {
    id: string;
    deltaCents: number;
  }): Promise<StudioDraftRow> {
    try {
      const row = await this.prisma.studioDraft.findUnique({
        where: { id: args.id },
      });
      if (!row) {
        throw new PersistenceError({
          kind: "not_found",
          message: `studio_draft_not_found:${args.id}`,
        });
      }
      return await this.prisma.studioDraft.update({
        where: { id: args.id },
        data: { costCents: row.costCents + args.deltaCents },
      });
    } catch (err) {
      throw wrapDbError(err, "increment_draft_cost");
    }
  }

  /**
   * M11 — persist the builder's DraftDocument payload.
   *
   * Caller supplies the `expectedPayloadVersion` they last saw to
   * guard against lost updates: when the value in the DB is greater,
   * `conflict` is thrown so the UI can reload before saving again.
   *
   * `expectedPayloadVersion = -1` skips the optimistic check (used
   * by the seed write that runs immediately after `create`).
   */
  async savePayload(args: {
    id: string;
    payload: unknown;
    expectedPayloadVersion?: number;
    title?: string;
  }): Promise<StudioDraftRow> {
    try {
      const row = await this.prisma.studioDraft.findUnique({
        where: { id: args.id },
      });
      if (!row) {
        throw new PersistenceError({
          kind: "not_found",
          message: `studio_draft_not_found:${args.id}`,
        });
      }
      if (
        args.expectedPayloadVersion !== undefined &&
        args.expectedPayloadVersion !== -1 &&
        row.payloadVersion > args.expectedPayloadVersion
      ) {
        throw new PersistenceError({
          kind: "conflict",
          message: `draft_payload_stale:${args.id}:${row.payloadVersion}>${args.expectedPayloadVersion}`,
        });
      }
      return await this.prisma.studioDraft.update({
        where: { id: args.id },
        data: {
          payload: args.payload,
          payloadVersion: row.payloadVersion + 1,
          ...(args.title ? { title: args.title } : {}),
        },
      });
    } catch (err) {
      throw wrapDbError(err, "save_draft_payload");
    }
  }

  /** Rename a draft (title only). Slug is immutable post-creation. */
  async rename(args: { id: string; title: string }): Promise<StudioDraftRow> {
    try {
      return await this.prisma.studioDraft.update({
        where: { id: args.id },
        data: { title: args.title },
      });
    } catch (err) {
      throw wrapDbError(err, "rename_draft");
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

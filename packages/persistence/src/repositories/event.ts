import {
  PersistenceError,
  type EventSeed,
  type PrismaLike,
  type StudioEventRow,
} from "../contracts";

/**
 * StudioEventRepository — typed wrapper around `prisma.studioEvent`.
 *
 * # Why it exists
 *
 * Append-only audit log. Studio writes:
 *   • `draft.created`     — when intake seeds a new draft.
 *   • `run.dispatched`    — when the pipeline kicks off.
 *   • `run.failed`        — when a run terminates with error.
 *   • `asset.presigned`   — when a presigned URL is minted.
 *   • `asset.uploaded`    — when the HEAD probe confirms bytes.
 *
 * The events table feeds the M11 Slack/Sheets glue + the operator
 * timeline on the draft detail page (M11 UI).
 */
export class StudioEventRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  async append(seed: EventSeed): Promise<StudioEventRow> {
    try {
      return await this.prisma.studioEvent.create({
        data: {
          storeId: seed.storeId ?? null,
          draftId: seed.draftId ?? null,
          kind: seed.kind,
          actor: seed.actor,
          payload: (seed.payload ?? null) as unknown,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "append_event");
    }
  }

  async listForDraft(args: {
    draftId: string;
    take?: number;
  }): Promise<StudioEventRow[]> {
    try {
      return await this.prisma.studioEvent.findMany({
        where: { draftId: args.draftId },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.take ?? 100, 1000),
      });
    } catch (err) {
      throw wrapDbError(err, "list_events");
    }
  }

  async listForStore(args: {
    storeId: string;
    kind?: string;
    take?: number;
  }): Promise<StudioEventRow[]> {
    try {
      return await this.prisma.studioEvent.findMany({
        where: {
          storeId: args.storeId,
          ...(args.kind ? { kind: args.kind } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.take ?? 100, 1000),
      });
    } catch (err) {
      throw wrapDbError(err, "list_store_events");
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

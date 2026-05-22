import { vi } from "vitest";
import type {
  PrismaLike,
  PrismaModelDelegate,
  StudioArtifactRow,
  StudioAssetRow,
  StudioDraftRow,
  StudioEventRow,
  StudioPublishedProductRow,
  StudioRunRow,
  StudioStepRow,
  StudioStoreRow,
} from "../../contracts";

/**
 * Mock PrismaClient generator.
 *
 * Returns a `PrismaLike` whose model delegates are vitest spies
 * with default-success implementations the test can override per
 * call via `mockResolvedValueOnce` etc.
 *
 * Why default-success implementations: the persistence layer calls
 * `findUnique` / `update` etc inside try/catch — if the mock simply
 * returned `undefined`, code paths that use the row would crash with
 * `TypeError: Cannot read properties of undefined`, masking the
 * real assertion. Default-success means "the DB exists and behaves;
 * tests override only the calls they care about".
 *
 * The defaults are intentionally small — each spec wires the
 * specific return shape it expects.
 */
export function makeMockPrisma(): {
  prisma: PrismaLike;
  spies: {
    studioStore: Record<keyof PrismaModelDelegate<StudioStoreRow>, ReturnType<typeof vi.fn>>;
    studioDraft: Record<keyof PrismaModelDelegate<StudioDraftRow>, ReturnType<typeof vi.fn>>;
    studioRun: Record<keyof PrismaModelDelegate<StudioRunRow>, ReturnType<typeof vi.fn>>;
    studioStep: Record<keyof PrismaModelDelegate<StudioStepRow>, ReturnType<typeof vi.fn>>;
    studioAsset: Record<keyof PrismaModelDelegate<StudioAssetRow>, ReturnType<typeof vi.fn>>;
    studioEvent: Record<keyof PrismaModelDelegate<StudioEventRow>, ReturnType<typeof vi.fn>>;
    studioPublishedProduct: Record<keyof PrismaModelDelegate<StudioPublishedProductRow>, ReturnType<typeof vi.fn>>;
    studioArtifact: Record<keyof PrismaModelDelegate<StudioArtifactRow>, ReturnType<typeof vi.fn>>;
  };
} {
  function makeDelegate<TRow>(): Record<
    keyof PrismaModelDelegate<TRow>,
    ReturnType<typeof vi.fn>
  > {
    return {
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    };
  }

  const spies = {
    studioStore: makeDelegate<StudioStoreRow>(),
    studioDraft: makeDelegate<StudioDraftRow>(),
    studioRun: makeDelegate<StudioRunRow>(),
    studioStep: makeDelegate<StudioStepRow>(),
    studioAsset: makeDelegate<StudioAssetRow>(),
    studioEvent: makeDelegate<StudioEventRow>(),
    studioPublishedProduct: makeDelegate<StudioPublishedProductRow>(),
    studioArtifact: makeDelegate<StudioArtifactRow>(),
  };

  const prisma: PrismaLike = {
    studioStore: spies.studioStore as unknown as PrismaModelDelegate<StudioStoreRow>,
    studioDraft: spies.studioDraft as unknown as PrismaModelDelegate<StudioDraftRow>,
    studioRun: spies.studioRun as unknown as PrismaModelDelegate<StudioRunRow>,
    studioStep: spies.studioStep as unknown as PrismaModelDelegate<StudioStepRow>,
    studioAsset: spies.studioAsset as unknown as PrismaModelDelegate<StudioAssetRow>,
    studioEvent: spies.studioEvent as unknown as PrismaModelDelegate<StudioEventRow>,
    studioPublishedProduct: spies.studioPublishedProduct as unknown as PrismaModelDelegate<StudioPublishedProductRow>,
    studioArtifact: spies.studioArtifact as unknown as PrismaModelDelegate<StudioArtifactRow>,
    $transaction: async <T,>(fn: (tx: PrismaLike) => Promise<T>): Promise<T> => fn(prisma),
  };

  return { prisma, spies };
}

export function dbErr(code: string, message = "db_error"): Error & { code: string } {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

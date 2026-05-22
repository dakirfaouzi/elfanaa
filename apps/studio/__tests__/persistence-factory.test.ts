import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetStudioPersistenceCache,
  getStudioPersistence,
  runIdToSlug,
  storeConfigHash,
} from "../lib/studio/persistence";

/**
 * Persistence-factory tests.
 *
 * Coverage:
 *   • Default (no env vars) → file-only RunStore + memory MediaStore +
 *     no repositories.
 *   • dual mode without DB URL → degrades to file-only, surfaces a
 *     warning, repositories still undefined.
 *   • R2 driver without credentials → degrades to memory MediaStore.
 *   • Slug derivation matches the format `runIdToSlug` exports.
 *
 * NOTE: We never exercise the dual-write path with a REAL Prisma
 * client here — that's covered exhaustively in
 * `@platform/persistence/__tests__/`. The Studio factory's job is
 * env wiring + degradation; the actual write semantics belong to
 * the persistence package.
 */
describe("getStudioPersistence", () => {
  let dataRoot: string;

  beforeEach(async () => {
    dataRoot = await mkdtemp(path.join(tmpdir(), "studio-persistence-"));
    __resetStudioPersistenceCache();
  });

  afterEach(async () => {
    await rm(dataRoot, { recursive: true, force: true });
    __resetStudioPersistenceCache();
  });

  it("with empty env: file-only RunStore + memory MediaStore + no repos", () => {
    const p = getStudioPersistence({ env: {}, dataRoot });
    expect(p.config.persistence.mode).toBe("file");
    expect(p.config.persistence.enableDualWrite).toBe(false);
    expect(p.config.r2.driver).toBe("memory");
    expect(p.repositories).toBeUndefined();
    expect(p.mediaStore.constructor.name).toBe("MemoryMediaStore");
    expect(p.warnings).toEqual([]);
  });

  it("dual mode without DB URL → degrades to file + records warning", () => {
    const p = getStudioPersistence({
      env: { STUDIO_PERSISTENCE_MODE: "dual" },
      dataRoot,
    });
    expect(p.config.persistence.mode).toBe("file");
    expect(p.repositories).toBeUndefined();
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.warnings.some((w) => w.includes("degrading to file-only"))).toBe(
      true,
    );
  });

  it("R2 driver without all credentials → degrades to memory + warning", () => {
    const p = getStudioPersistence({
      env: { STORAGE_DRIVER: "r2" },
      dataRoot,
    });
    expect(p.config.r2.driver).toBe("memory");
    expect(p.mediaStore.constructor.name).toBe("MemoryMediaStore");
    expect(p.warnings.some((w) => w.includes("STORAGE_DRIVER=r2"))).toBe(true);
  });

  it("dual mode + DB URL + injected PrismaClient → repositories populated", () => {
    const fakePrisma = makeFakePrisma();
    const p = getStudioPersistence({
      env: {
        STUDIO_PERSISTENCE_MODE: "dual",
        ADMIN_DATABASE_URL: "postgresql://u@h/d",
      },
      prismaClient: fakePrisma,
      dataRoot,
    });
    expect(p.config.persistence.enableDualWrite).toBe(true);
    expect(p.repositories).toBeDefined();
    expect(p.repositories?.draft).toBeDefined();
    expect(p.repositories?.run).toBeDefined();
    expect(p.repositories?.asset).toBeDefined();
    expect(p.repositories?.event).toBeDefined();
  });

  it("invalid env throws with `env_invalid:` prefix", () => {
    expect(() =>
      getStudioPersistence({
        env: { ADMIN_DATABASE_URL: "mysql://nope" },
        dataRoot,
      }),
    ).toThrow(/^studio_persistence_env_invalid/);
  });
});

describe("runIdToSlug", () => {
  it("strips a leading `<store>-` prefix from URL-safe runIds", () => {
    expect(runIdToSlug("fanaa-01HXYZ-abc")).toBe("01HXYZ-abc");
  });

  it("falls back to the runId when there's no recognisable prefix", () => {
    expect(runIdToSlug("01HXYZ")).toBe("01HXYZ");
  });

  it("truncates to 120 chars", () => {
    const long = "fanaa-" + "x".repeat(200);
    expect(runIdToSlug(long)).toHaveLength(120);
  });
});

describe("storeConfigHash", () => {
  it("returns a stable 16-char hex hash for fanaa", () => {
    const h1 = storeConfigHash("fanaa");
    const h2 = storeConfigHash("fanaa");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{16}$/);
  });

  it("returns 'unknown' for an unregistered store", () => {
    expect(storeConfigHash("not-a-store")).toBe("unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────

function makeFakePrisma() {
  function modelDelegate() {
    return {
      create: async () => ({}),
      update: async () => ({}),
      upsert: async () => ({}),
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      count: async () => 0,
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    };
  }
  return {
    studioStore: modelDelegate(),
    studioDraft: modelDelegate(),
    studioRun: modelDelegate(),
    studioStep: modelDelegate(),
    studioAsset: modelDelegate(),
    studioEvent: modelDelegate(),
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn({}),
  } as unknown as NonNullable<
    Parameters<typeof getStudioPersistence>[0]
  >["prismaClient"];
}

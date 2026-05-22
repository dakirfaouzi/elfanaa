import { createHash } from "node:crypto";
import path from "node:path";
import { FileStore } from "@platform/ingest";
import type { RunStore } from "@platform/ingest/store";
import { fanaaStore, getStore } from "@platform/stores";
import {
  loadStudioEnv,
  resolvePersistenceConfig,
  resolveR2Config,
  type ResolvedPersistenceConfig,
  type ResolvedR2Config,
} from "@platform/env";
import {
  CompositeRunStore,
  PrismaRunStore,
  StudioAssetRepository,
  StudioDraftRepository,
  StudioEventRepository,
  StudioRunRepository,
  StudioStoreRepository,
  type PrismaLike,
} from "@platform/persistence";
import {
  MemoryMediaStore,
  R2MediaStore,
  type MediaStore,
} from "@platform/storage";
import { platformDataRoot } from "./paths";

/**
 * Studio persistence factory.
 *
 * # Why a factory?
 *
 * The Studio runtime decides at boot which RunStore (file / dual /
 * postgres) and which MediaStore (memory / r2) to use. The decision
 * is driven by env vars (`STUDIO_PERSISTENCE_MODE`, `STORAGE_DRIVER`,
 * etc.) and validated via `@platform/env`. Once resolved, the same
 * configuration is reused for every request inside a single Node
 * process so we avoid re-parsing env on every API call.
 *
 * # M10 default behaviour (zero ops change)
 *
 *   • `STUDIO_PERSISTENCE_MODE` unset → file-only RunStore (M9 path).
 *   • `STORAGE_DRIVER` unset           → in-memory MediaStore.
 *   • Operator flips both vars when they want to enable dual-write
 *     + R2 (see docs/M10-MANUAL-SETUP.md).
 *
 * # Why we mock-import the Prisma client lazily
 *
 * `@prisma/client` only emits code AFTER `prisma generate` runs.
 * Importing it eagerly inside a server bundle is fine, but during
 * tests we don't want to pull a real client. The factory accepts an
 * optional `prismaClient` override so tests can inject a mock; the
 * production path lazy-imports the real client only when dual-write
 * is enabled.
 */

export interface StudioPersistence {
  /** RunStore the worker writes through. Always file-backed at the
   *  primary layer (the SSE watcher tails its files). Composite
   *  store wraps with PrismaRunStore when dual-write is enabled. */
  runStore: RunStore;
  /** Repositories for direct DB reads/writes. Populated only when
   *  Postgres persistence is enabled; otherwise undefined. */
  repositories?: {
    store: StudioStoreRepository;
    draft: StudioDraftRepository;
    run: StudioRunRepository;
    asset: StudioAssetRepository;
    event: StudioEventRepository;
  };
  /** MediaStore used by asset endpoints. Always set (memory fallback). */
  mediaStore: MediaStore;
  /** Resolved config snapshot — exposed for diagnostics + tests. */
  config: {
    persistence: ResolvedPersistenceConfig;
    r2: ResolvedR2Config;
  };
  /** Warnings surfaced during resolution (e.g. dual mode without
   *  DB URL). Logged at boot; callers may surface in diagnostics. */
  warnings: string[];
}

export interface StudioPersistenceOptions {
  /** Override the raw env. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Inject a Prisma-like client. Production resolves from the real
   *  `@prisma/client`; tests pass a mock. */
  prismaClient?: PrismaLike;
  /** Override the data root. Defaults to `platformDataRoot()`. */
  dataRoot?: string;
  /** Optional logger hook for secondary failures + warnings. */
  onWarn?: (msg: string) => void;
  /** Optional logger hook for composite secondary errors. */
  onSecondaryError?: (op: string, err: unknown) => void;
}

let cached: StudioPersistence | null = null;

/**
 * Resolve (or return the cached) studio persistence configuration.
 * Subsequent calls within the same process reuse the snapshot;
 * tests pass explicit `env` overrides to force fresh resolution.
 */
export function getStudioPersistence(
  opts: StudioPersistenceOptions = {},
): StudioPersistence {
  if (cached && !opts.env && !opts.prismaClient && !opts.dataRoot) {
    return cached;
  }
  const envResult = loadStudioEnv(opts.env);
  if (envResult.status !== "ok") {
    const summary = envResult.issues
      .map((i) => `${i.path || "(root)"}: ${i.message}`)
      .join(" | ");
    throw new Error(`studio_persistence_env_invalid:${summary}`);
  }
  const env = envResult.env;
  const persistence = resolvePersistenceConfig(env);
  const r2 = resolveR2Config(env);
  const warnings = [...persistence.warnings, ...r2.warnings];
  warnings.forEach((w) => opts.onWarn?.(w));

  const dataRoot = opts.dataRoot ?? platformDataRoot();
  const fileStore = new FileStore(path.join(dataRoot, "runs"));

  // ── runStore ────────────────────────────────────────────────────
  let runStore: RunStore = fileStore;
  let repositories: StudioPersistence["repositories"];
  if (persistence.enableDualWrite) {
    const prisma = opts.prismaClient ?? loadPrismaClient(persistence.prismaUrl);
    if (prisma) {
      const draftRepo = new StudioDraftRepository({ prisma });
      const draftIdResolver = makeDraftIdResolver(draftRepo);
      const prismaRunStore = new PrismaRunStore({
        prisma,
        draftIdResolver,
      });
      runStore = new CompositeRunStore({
        primary: fileStore,
        secondary: prismaRunStore,
        onSecondaryError: opts.onSecondaryError ?? defaultSecondaryReporter,
      });
      repositories = {
        store: new StudioStoreRepository({ prisma }),
        draft: draftRepo,
        run: new StudioRunRepository({ prisma }),
        asset: new StudioAssetRepository({ prisma }),
        event: new StudioEventRepository({ prisma }),
      };
    } else {
      warnings.push("dual_write_requested_but_prisma_client_unavailable");
      opts.onWarn?.(warnings[warnings.length - 1]!);
    }
  }

  // ── mediaStore ─────────────────────────────────────────────────
  let mediaStore: MediaStore;
  if (r2.driver === "r2" && r2.accountId && r2.accessKeyId && r2.secretAccessKey) {
    mediaStore = new R2MediaStore({
      accountId: r2.accountId,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    });
  } else {
    mediaStore = new MemoryMediaStore();
  }

  const snapshot: StudioPersistence = {
    runStore,
    repositories,
    mediaStore,
    config: { persistence, r2 },
    warnings,
  };
  // Cache only when env resolution came from `process.env` and the
  // caller didn't inject any overrides — tests get fresh snapshots.
  if (!opts.env && !opts.prismaClient && !opts.dataRoot) {
    cached = snapshot;
  }
  return snapshot;
}

/** Reset the cached snapshot. Tests call this between specs. */
export function __resetStudioPersistenceCache(): void {
  cached = null;
}

/**
 * Resolve a `draftId` for a given `runId`. Used by `PrismaRunStore`
 * to satisfy its `draftIdResolver` contract.
 *
 * # Lookup strategy
 *
 *   1. Try `StudioRunRepository.findByRunId(runId)` — if a draft
 *      was previously persisted, return its draftId.
 *   2. Fallback: derive a `slug` from the runId (M10 only — Studio
 *      seeds the draft on intake before the run runs, so this path
 *      should be cold).
 *
 * The seeder lives in `dispatch-action.ts` and creates the draft
 * BEFORE invoking the pipeline, so step 1 is the production path.
 */
function makeDraftIdResolver(
  repo: StudioDraftRepository,
): (runId: string) => Promise<string | null> {
  return async (runId: string) => {
    // For M10 we trust the dispatch-action seeder to have created
    // the draft. The runId is used as the slug for predictability;
    // change this when slug-generation logic grows.
    const draft = await repo.findBySlug({
      storeId: extractStoreIdFromRunId(runId) ?? fanaaStore.id,
      slug: runIdToSlug(runId),
    });
    return draft?.id ?? null;
  };
}

/**
 * Derive a slug from the runId. The runId already contains the store
 * + timestamp; the slug strips the store prefix so URLs read cleanly.
 *
 * Format used by intake-validator: `<storeId>-<ulid>-<rand>`.
 * Slug = the runId minus the store prefix (or the runId itself when
 * the format is unrecognised).
 */
export function runIdToSlug(runId: string): string {
  return runId.replace(/^([a-z0-9_-]+)-/, "").slice(0, 120) || runId;
}

function extractStoreIdFromRunId(runId: string): string | null {
  const m = /^([a-z0-9_-]+?)-/.exec(runId);
  return m?.[1] ?? null;
}

/** Stable config-hash for `studio_store.config_hash`. */
export function storeConfigHash(storeId: string): string {
  const cfg = storeId === fanaaStore.id ? fanaaStore : getStore(storeId);
  if (!cfg) return "unknown";
  const json = JSON.stringify({
    id: cfg.id,
    niche: cfg.niche,
    defaultLocale: cfg.defaultLocale,
    currency: cfg.currency,
    publisher: cfg.publisher,
  });
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

/**
 * Lazy Prisma client loader. Returns `null` when the client cannot
 * be resolved (no codegen, no module available). M10 callers
 * gracefully degrade to file-only mode in that case.
 *
 * # Why CommonJS-style dynamic import
 *
 * `@prisma/client` is dynamically required so the Studio bundle
 * still builds when codegen has not been run. The Studio's
 * `postinstall` hook calls `prisma generate` so production deploys
 * always have it available; dev environments without the migration
 * applied still boot.
 */
function loadPrismaClient(_url: string | undefined): PrismaLike | null {
  try {
    // Use require() so Webpack/Next doesn't statically bundle.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prismaPkg = require("@prisma/client") as {
      PrismaClient: new () => PrismaLike;
    };
    return new prismaPkg.PrismaClient();
  } catch {
    return null;
  }
}

function defaultSecondaryReporter(op: string, err: unknown): void {
  if (typeof console === "undefined") return;
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(
    `[studio_persistence] secondary_write_failed op=${op} error=${message}`,
  );
}

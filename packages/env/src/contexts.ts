import {
  PersistenceEnvSchema,
  R2EnvSchema,
  StudioEnvSchema,
  validateEnv,
  validateEnvOrThrow,
  type EnvValidationResult,
  type PersistenceEnv,
  type PersistenceMode,
  type R2Env,
  type StorageDriver,
  type StudioEnv,
} from "./schemas";

/**
 * Per-context env loaders.
 *
 * Each loader takes an OPTIONAL raw env map for testing. When omitted
 * it reads `process.env` at the call site — meaning the loader must
 * be invoked from a runtime context where process.env is populated
 * (Node, not the Edge runtime).
 *
 * # Design contract
 *
 *   • Each loader returns an `EnvValidationResult` so the caller can
 *     decide whether to crash hard or degrade.
 *   • A matching `*OrThrow` variant exists for bootstrap callers that
 *     want loud-failure semantics.
 *   • Loaders pull ONLY the variables they own — `loadR2Env` does NOT
 *     touch `ADMIN_DATABASE_URL`. This keeps the failure surface tight.
 */

function defaultEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

// ─────────────────────────────────────────────────────────────────────────
// Studio web runtime
// ─────────────────────────────────────────────────────────────────────────

export function loadStudioEnv(
  raw: Record<string, string | undefined> = defaultEnv(),
): EnvValidationResult<StudioEnv> {
  return validateEnv(StudioEnvSchema, raw);
}

export function loadStudioEnvOrThrow(
  raw: Record<string, string | undefined> = defaultEnv(),
): StudioEnv {
  return validateEnvOrThrow(StudioEnvSchema, raw);
}

// ─────────────────────────────────────────────────────────────────────────
// Persistence-only (Prisma client + composite store)
// ─────────────────────────────────────────────────────────────────────────

export function loadPersistenceEnv(
  raw: Record<string, string | undefined> = defaultEnv(),
): EnvValidationResult<PersistenceEnv> {
  return validateEnv(PersistenceEnvSchema, raw);
}

export function loadPersistenceEnvOrThrow(
  raw: Record<string, string | undefined> = defaultEnv(),
): PersistenceEnv {
  return validateEnvOrThrow(PersistenceEnvSchema, raw);
}

/**
 * Resolved persistence configuration the Studio factory consumes.
 *
 * Combines the env-derived mode with derived runtime predicates:
 *
 *   • `prismaUrl`         — DATABASE_URL ?? ADMIN_DATABASE_URL.
 *   • `enableDualWrite`   — true iff mode === "dual" AND prismaUrl set.
 *
 * If the operator requests `dual` mode without setting either DB URL,
 * we DEGRADE gracefully to file-mode and surface a warning in the
 * `warnings` array — the Studio never crashes the request just
 * because someone fat-fingered the env.
 */
export interface ResolvedPersistenceConfig {
  mode: PersistenceMode;
  prismaUrl?: string;
  enableDualWrite: boolean;
  warnings: string[];
}

export function resolvePersistenceConfig(
  env: PersistenceEnv,
): ResolvedPersistenceConfig {
  const warnings: string[] = [];
  const prismaUrl = env.DATABASE_URL ?? env.ADMIN_DATABASE_URL;
  let mode = env.STUDIO_PERSISTENCE_MODE;
  if (mode === "dual" && !prismaUrl) {
    warnings.push(
      "STUDIO_PERSISTENCE_MODE=dual but no DATABASE_URL/ADMIN_DATABASE_URL set — degrading to file-only",
    );
    mode = "file";
  }
  return {
    mode,
    prismaUrl,
    enableDualWrite: mode === "dual",
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// R2 storage
// ─────────────────────────────────────────────────────────────────────────

export function loadR2Env(
  raw: Record<string, string | undefined> = defaultEnv(),
): EnvValidationResult<R2Env> {
  return validateEnv(R2EnvSchema, raw);
}

export function loadR2EnvOrThrow(
  raw: Record<string, string | undefined> = defaultEnv(),
): R2Env {
  return validateEnvOrThrow(R2EnvSchema, raw);
}

/**
 * Resolved storage configuration. Used by the Studio factory to pick
 * between R2 and Memory adapters.
 *
 *   • `driver === "memory"` → no R2 creds required.
 *   • `driver === "r2"`     → all four R2_* creds REQUIRED; if any
 *                              are missing we surface a `warnings`
 *                              entry AND degrade to `memory`.
 *
 * Per-store bucket lookup happens via `bucketFor(storeId)`.
 */
export interface ResolvedR2Config {
  driver: StorageDriver;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  buckets: Record<string, string>;
  publicBaseUrls: Record<string, string>;
  warnings: string[];
}

export function resolveR2Config(env: R2Env): ResolvedR2Config {
  const warnings: string[] = [];
  let driver = env.STORAGE_DRIVER;
  const missing: string[] = [];
  if (driver === "r2") {
    if (!env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
    if (!env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
    if (!env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
    if (!env.R2_BUCKET_FANAA) missing.push("R2_BUCKET_FANAA");
    if (missing.length > 0) {
      warnings.push(
        `STORAGE_DRIVER=r2 but missing required vars [${missing.join(",")}] — degrading to memory`,
      );
      driver = "memory";
    }
  }

  return {
    driver,
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    buckets: env.R2_BUCKET_FANAA ? { fanaa: env.R2_BUCKET_FANAA } : {},
    publicBaseUrls: env.R2_PUBLIC_BASE_URL_FANAA
      ? { fanaa: env.R2_PUBLIC_BASE_URL_FANAA }
      : {},
    warnings,
  };
}

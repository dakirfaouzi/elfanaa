import { z } from "zod";

/**
 * Per-context env schemas.
 *
 * # Why split the schema
 *
 * Different runtimes need different env subsets:
 *
 *   • Studio web    — DB + auth + R2 + persistence-mode + (optionally)
 *                      provider keys passed to the worker.
 *   • Worker CLI    — provider keys (already wired in M4 registry) +
 *                      DB url (optional, only when persistence-mode
 *                      ≠ file).
 *   • Storage tests — R2 creds only, optional in CI.
 *
 * Each context has its own loader (`contexts.ts`) that runs only the
 * relevant schema. The schemas live HERE so they're reusable and the
 * type surface is centralised.
 *
 * # Error shape
 *
 * Schemas use a `.refine` wrapper that turns failures into a single
 * stable string of the form `env_invalid:<FIELD>:<reason>`. Container
 * orchestrators can `grep` this prefix to alert.
 */

// ─────────────────────────────────────────────────────────────────────────
// Field-level helpers
// ─────────────────────────────────────────────────────────────────────────

/** Non-empty trimmed string. */
const nonEmpty = (label: string) =>
  z
    .string()
    .min(1, `env_invalid:${label}:empty`)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, `env_invalid:${label}:whitespace_only`);

/** Postgres URL — accepts both `postgresql://` and `postgres://`. */
const postgresUrl = (label: string) =>
  nonEmpty(label).refine(
    (s) => /^postgres(?:ql)?:\/\//.test(s),
    `env_invalid:${label}:must_be_postgres_url`,
  );

/** Cloudflare R2 account id (32-char lowercase hex). */
const r2AccountId = (label: string) =>
  nonEmpty(label).refine(
    (s) => /^[a-f0-9]{32}$/i.test(s),
    `env_invalid:${label}:must_be_32_char_hex`,
  );

/** Studio persistence mode discriminator. */
export const PersistenceMode = z.enum(["file", "dual"]);
export type PersistenceMode = z.infer<typeof PersistenceMode>;

/** Storage driver discriminator. */
export const StorageDriver = z.enum(["memory", "r2"]);
export type StorageDriver = z.infer<typeof StorageDriver>;

// ─────────────────────────────────────────────────────────────────────────
// R2 (storage) schema
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cloudflare R2 storage env.
 *
 * `R2_PUBLIC_BASE_URL_FANAA` is the CDN base URL Studio composes when
 * building publicly-visible image URLs. When omitted, the asset
 * browser falls back to presigned GETs.
 */
export const R2EnvSchema = z.object({
  STORAGE_DRIVER: StorageDriver.default("memory"),
  R2_ACCOUNT_ID: r2AccountId("R2_ACCOUNT_ID").optional(),
  R2_ACCESS_KEY_ID: nonEmpty("R2_ACCESS_KEY_ID").optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty("R2_SECRET_ACCESS_KEY").optional(),
  R2_BUCKET_FANAA: nonEmpty("R2_BUCKET_FANAA").optional(),
  R2_PUBLIC_BASE_URL_FANAA: z
    .string()
    .url("env_invalid:R2_PUBLIC_BASE_URL_FANAA:not_a_url")
    .optional(),
});

export type R2Env = z.output<typeof R2EnvSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Persistence schema
// ─────────────────────────────────────────────────────────────────────────

/**
 * Database env for the Studio's Prisma client.
 *
 * Two URL options exist:
 *
 *   • `DATABASE_URL` — connection pool URL (used by the application).
 *   • `ADMIN_DATABASE_URL` — direct URL (used by `prisma migrate`).
 *
 * The existing analytics dashboard already consumes `ADMIN_DATABASE_URL`
 * (see packages/db/prisma/schema.prisma) so the Studio reuses it.
 */
export const PersistenceEnvSchema = z.object({
  STUDIO_PERSISTENCE_MODE: PersistenceMode.default("file"),
  ADMIN_DATABASE_URL: postgresUrl("ADMIN_DATABASE_URL").optional(),
  /** Optional runtime-pool URL. Falls back to ADMIN_DATABASE_URL when
   *  unset (single-instance deployments don't need a separate pool). */
  DATABASE_URL: postgresUrl("DATABASE_URL").optional(),
});

export type PersistenceEnv = z.output<typeof PersistenceEnvSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Studio runtime schema (full)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Full Studio web runtime env. Composed of the persistence + R2
 * subsets plus Studio-specific values.
 *
 *   • `PLATFORM_DATA_ROOT` — path the file-backed RunStore + Publisher
 *      use. Defaults to `<repo>/.platform-data`. Unchanged from M9.
 *   • `STUDIO_ASSETS_CDN_BASE` — already in use by the preview-props
 *      builder (M8). Re-exported here for completeness.
 */
export const StudioEnvSchema = PersistenceEnvSchema.merge(R2EnvSchema).extend({
  PLATFORM_DATA_ROOT: z.string().optional(),
  STUDIO_ASSETS_CDN_BASE: z.string().url().optional(),
});

export type StudioEnv = z.output<typeof StudioEnvSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────

export interface EnvValidationFailure {
  readonly status: "invalid";
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
}

export type EnvValidationResult<T> =
  | { status: "ok"; env: T }
  | EnvValidationFailure;

/**
 * Run a Zod schema over a raw env map and surface either a typed
 * env object or a structured list of issues. Pure wrapper around
 * `safeParse`; exists so every loader returns the same shape.
 *
 * The generic is bound to the schema TYPE itself (not its output)
 * so TypeScript correctly picks `z.output<S>` for `data` rather than
 * the ambiguous-by-design `z.ZodType<T>` overload.
 */
export function validateEnv<S extends z.ZodTypeAny>(
  schema: S,
  raw: Record<string, string | undefined>,
): EnvValidationResult<z.output<S>> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { status: "ok", env: parsed.data };
  return {
    status: "invalid",
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/**
 * Loud-failing variant — used by the Studio bootstrap. Either returns
 * the env or throws an Error whose message begins with
 * `env_invalid:` so log scrapers / EasyPanel health checks can match.
 */
export function validateEnvOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  raw: Record<string, string | undefined>,
): z.output<S> {
  const result = validateEnv(schema, raw);
  if (result.status === "ok") return result.env;
  const messages = result.issues
    .map((i) => `${i.path || "(root)"}: ${i.message}`)
    .join(" | ");
  throw new Error(`env_invalid:${messages}`);
}

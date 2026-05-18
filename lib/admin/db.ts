import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client for the admin / analytics database.
 *
 * Production hardening:
 *   1. Tolerate the `postgresql+asyncpg://…` URL form. The FastAPI
 *      backend uses SQLAlchemy's `+asyncpg` dialect suffix; copy/pasting
 *      that URL into ADMIN_DATABASE_URL is the single most common
 *      configuration mistake. Prisma rejects the `+asyncpg` part with
 *      an unhelpful "Error validating datasource", so we strip it
 *      automatically at process start.
 *   2. Refuse to instantiate Prisma without a URL. A real client built
 *      against an empty url just defers the failure to the first query
 *      where the error becomes opaque. Instead we expose a proxy that
 *      throws a clearly-labelled `AdminConfigError` on any access, so
 *      the API layer can catch it and surface a useful message.
 *   3. Keep a single instance across Next.js hot-reloads so we don't
 *      drain the database connection pool during local dev.
 *   4. NEVER throw at module-load — that would crash the entire web
 *      container on misconfiguration. The error has to surface at the
 *      API-handler boundary so the dashboard can render and tell the
 *      operator what's wrong.
 */

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

/** Normalise an admin DB URL so Prisma accepts it. */
export function normaliseAdminDbUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  // FastAPI uses SQLAlchemy `postgresql+asyncpg://` — Prisma wants the
  // bare `postgresql://` scheme. Strip the dialect suffix so operators
  // can copy the FastAPI DATABASE_URL straight into ADMIN_DATABASE_URL.
  url = url.replace(/^postgresql\+asyncpg:\/\//i, "postgresql://");
  url = url.replace(/^postgres\+asyncpg:\/\//i, "postgres://");
  return url;
}

const NORMALISED_URL = normaliseAdminDbUrl(process.env.ADMIN_DATABASE_URL);

/** True when the admin DB is configured. UI degrades gracefully otherwise. */
export const isAdminDbConfigured = Boolean(NORMALISED_URL);

/**
 * Surfaces the reason the admin DB isn't usable (or `null` if it is).
 * The diagnostics endpoint reads this so the operator sees actionable
 * text instead of "Couldn't load metrics".
 */
export function adminDbConfigError(): string | null {
  if (!process.env.ADMIN_DATABASE_URL) {
    return "ADMIN_DATABASE_URL is not set. Add it to the web service environment in EasyPanel and redeploy.";
  }
  const raw = process.env.ADMIN_DATABASE_URL.trim();
  if (raw !== NORMALISED_URL) {
    return "ADMIN_DATABASE_URL contained '+asyncpg' (SQLAlchemy dialect). It's been auto-stripped; queries should work, but consider setting the canonical 'postgresql://…' form to avoid future surprises.";
  }
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    return "ADMIN_DATABASE_URL must start with 'postgresql://' or 'postgres://'. Current value uses an unsupported scheme.";
  }
  return null;
}

type GlobalWithPrisma = typeof globalThis & { __faAdminPrisma?: PrismaClient };
const globalForPrisma = globalThis as GlobalWithPrisma;

function buildPrisma(): PrismaClient {
  if (!NORMALISED_URL) {
    // Proxy that explodes only when used — so a missing DB URL doesn't
    // crash the build or the storefront-side imports of this module.
    return new Proxy({} as PrismaClient, {
      get(_, prop) {
        throw new AdminConfigError(
          `Admin DB call rejected: ADMIN_DATABASE_URL is not configured (tried to read prisma.${String(prop)}).`
        );
      },
    });
  }

  return new PrismaClient({
    datasources: { db: { url: NORMALISED_URL } },
    // In dev we want to see Prisma's pretty engine errors; in prod we
    // keep logs structured ("error" only) so we don't spam application
    // logs with warnings about expected things (e.g. zero-row aggregates).
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.__faAdminPrisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__faAdminPrisma = prisma;
}

/**
 * Round-trip ping. Used by `/api/admin/diagnostics` and the settings
 * page health card. Returns `{ ok: true }` on success or a structured
 * `{ ok: false, error }` so the UI can render an actionable message.
 */
export async function pingAdminDb(): Promise<
  { ok: true; latencyMs: number } | { ok: false; error: string }
> {
  if (!isAdminDbConfigured) {
    return { ok: false, error: adminDbConfigError() ?? "not_configured" };
  }
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.message.split("\n").find((l) => l.trim()) ?? err.name
        : String(err);
    return { ok: false, error: reason.slice(0, 280) };
  }
}

/**
 * List of admin tables we expect to exist (matches `admin_schema.sql`).
 * Used by diagnostics to confirm the FastAPI startup migration applied.
 */
export const EXPECTED_ADMIN_TABLES = [
  "visitor",
  "session",
  "event",
  "order_mirror",
  "order_mirror_item",
  "traffic_quality",
  "admin_audit",
  "_admin_schema_version",
] as const;

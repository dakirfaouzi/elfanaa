import { NextResponse } from "next/server";
import {
  prisma,
  isAdminDbConfigured,
  adminDbConfigError,
  pingAdminDb,
  EXPECTED_ADMIN_TABLES,
  AdminConfigError,
} from "@/lib/admin/db";
import { adminEnv, isAdminAuthConfigured } from "@/lib/admin/env";
import { safe } from "@/lib/admin/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnostics
 *
 * Operator-facing health check. Answers ONE question:
 *   "Why is the admin dashboard saying 'Couldn't load metrics'?"
 *
 * Returns a structured JSON document covering:
 *   • Environment — which of the required vars are set.
 *   • Database   — can Prisma connect? what's the latency?
 *   • Schema     — do the 8 expected admin tables exist?
 *                  (visitor, session, event, order_mirror, …)
 *   • Counts     — how many rows in each table? (Are events flowing?)
 *   • Warnings   — non-fatal nits (e.g. `+asyncpg` left in the URL).
 *
 * Admin-gated by `middleware.ts`. The body NEVER includes raw secrets
 * (only "configured / missing"), but it does reveal table names and
 * row counts so we keep it behind the JWT cookie.
 */
export async function GET() {
  const env = {
    ADMIN_DATABASE_URL: { ok: isAdminDbConfigured },
    JWT_SECRET: { ok: !!adminEnv.jwtSecret() },
    ADMIN_EMAIL: { ok: !!adminEnv.adminEmail() },
    ADMIN_PASSWORD: {
      ok: !!(adminEnv.adminPassword() || adminEnv.adminPasswordHash()),
      detail: adminEnv.adminPasswordHash() ? "hash" : adminEnv.adminPassword() ? "plain" : null,
    },
    MAXMIND: {
      ok: !!(adminEnv.maxmindAccountId() && adminEnv.maxmindLicenseKey()),
    },
    WEBHOOK_SECRET: { ok: !!adminEnv.webhookSecret() },
  };

  const authReady = isAdminAuthConfigured();
  const dbConfigWarning = adminDbConfigError();

  // DB ping. If unconfigured we short-circuit so the rest of the
  // request doesn't trip over the AdminConfigError-throwing proxy.
  const ping = await pingAdminDb();

  let tables: Array<{ name: string; exists: boolean; rows: number | null; error?: string }> = [];
  let schemaVersion: number | null = null;

  if (ping.ok) {
    // Introspect information_schema once and count rows for each
    // expected admin table in parallel.
    const existing = await safe(
      "diagnostics.tables",
      async () => {
        type Row = { table_name: string };
        const rows = await prisma.$queryRaw<Row[]>`
          SELECT table_name
            FROM information_schema.tables
           WHERE table_schema = current_schema()
             AND table_name = ANY(${EXPECTED_ADMIN_TABLES as unknown as string[]});
        `;
        return new Set(rows.map((r) => r.table_name));
      },
      new Set<string>()
    );

    const counts = await Promise.all(
      EXPECTED_ADMIN_TABLES.map(async (name) => {
        if (!existing.data.has(name)) {
          return { name, exists: false, rows: null, error: undefined };
        }
        const r = await safe(
          `diagnostics.count.${name}`,
          async () => {
            // We use raw SQL so we can count `_admin_schema_version` too
            // (it isn't in the Prisma client surface).
            const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
              `SELECT COUNT(*)::bigint AS n FROM "${name}"`
            );
            return Number(rows[0]?.n ?? 0);
          },
          null as number | null
        );
        return { name, exists: true, rows: r.data, error: r.error ?? undefined };
      })
    );
    tables = counts;

    const versionR = await safe(
      "diagnostics.schema_version",
      async () => {
        const rows = await prisma.$queryRawUnsafe<Array<{ version: number }>>(
          `SELECT MAX(version)::int AS version FROM "_admin_schema_version"`
        );
        return rows[0]?.version ?? null;
      },
      null
    );
    schemaVersion = versionR.data;
  } else {
    // Without a DB we still report which tables we'd expect, so the
    // UI can give the operator a checklist.
    tables = EXPECTED_ADMIN_TABLES.map((name) => ({
      name,
      exists: false,
      rows: null,
      error: undefined,
    }));
  }

  // Aggregate "is this thing healthy?" signal — used by the settings
  // page to flip the top banner red / amber / green.
  const missingTables = tables.filter((t) => !t.exists).map((t) => t.name);
  let status: "ok" | "degraded" | "down";
  if (!ping.ok || missingTables.length === EXPECTED_ADMIN_TABLES.length) {
    status = "down";
  } else if (missingTables.length > 0 || dbConfigWarning) {
    status = "degraded";
  } else {
    status = "ok";
  }

  const hints: string[] = [];
  if (!isAdminDbConfigured) {
    hints.push("Set ADMIN_DATABASE_URL on the web service in EasyPanel, then redeploy.");
  } else if (dbConfigWarning) {
    hints.push(dbConfigWarning);
  }
  if (ping.ok === false && isAdminDbConfigured) {
    hints.push(
      "Prisma can reach the URL host but the connection failed. Check user/password and that the DB allows connections from the web container."
    );
  }
  if (ping.ok && missingTables.length > 0) {
    hints.push(
      `Missing tables: ${missingTables.join(
        ", "
      )}. The FastAPI lifespan runs admin_schema.sql on boot — restart the API container so the migration applies, or check its startup logs.`
    );
  }
  if (!authReady) {
    hints.push("Admin login is disabled until ADMIN_EMAIL + JWT_SECRET + ADMIN_PASSWORD(_HASH) are all set.");
  }

  return NextResponse.json({
    status,
    env,
    auth: { ready: authReady },
    db: {
      configured: isAdminDbConfigured,
      reachable: ping.ok,
      latencyMs: ping.ok ? ping.latencyMs : null,
      error: ping.ok ? null : ping.error,
      configWarning: dbConfigWarning,
    },
    schema: {
      expected: EXPECTED_ADMIN_TABLES,
      missing: missingTables,
      version: schemaVersion,
      tables,
    },
    hints,
    checkedAt: new Date().toISOString(),
  });
}

// Ensure the explicit reference below isn't dropped by tree-shaking —
// `AdminConfigError` IS used as a sentinel by the metrics routes when
// they catch DB errors.
void AdminConfigError;

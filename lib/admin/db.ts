import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client.
 *
 * Next.js hot-reloads server modules in dev, which would otherwise spawn a
 * fresh PrismaClient on every save and exhaust the database connection pool.
 * The global trick keeps a single instance across HMR boundaries.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when the admin DB is configured. UI degrades gracefully otherwise. */
export const isAdminDbConfigured = Boolean(process.env.ADMIN_DATABASE_URL);

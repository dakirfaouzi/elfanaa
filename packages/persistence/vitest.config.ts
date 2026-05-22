import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/persistence.
 *
 * Tests inject a mocked `PrismaClient` (typed as the same shape that
 * @prisma/client exports) so the suite can run with zero database
 * dependencies. The mock records `create`/`update`/`findMany` calls
 * so assertions stay surgical and the Prisma codegen output never
 * needs to be present in CI.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    globals: false,
    testTimeout: 10_000,
    reporters: ["default"],
    typecheck: { enabled: false },
  },
});

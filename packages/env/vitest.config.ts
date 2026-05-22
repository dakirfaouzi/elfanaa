import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/env.
 *
 * Tests exercise the Zod schemas + per-context loaders with synthetic
 * environment maps (NOT process.env, so the suite is hermetic).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    globals: false,
    testTimeout: 5_000,
    reporters: ["default"],
    typecheck: { enabled: false },
  },
});

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/ingest.
 *
 * Tests live under src and __tests__ subfolders and exercise the
 * in-memory + file-backed Queue / RunStore implementations against
 * their contracts. No network egress, no real DB.
 *
 * File-backed tests use temp directories under the OS tmpdir so the
 * suite is repeatable and never pollutes the working tree.
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

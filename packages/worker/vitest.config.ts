import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/worker.
 *
 * Tests live under src and __tests__ subfolders and exercise:
 *   - Orchestrator happy path with mocked providers
 *   - Retry semantics on transient provider failure
 *   - Cost recording across all capabilities
 *   - Deterministic replay from a persisted RunRecord
 *   - Structured logger output
 *
 * No network egress, no real provider SDK invocation.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    globals: false,
    testTimeout: 15_000,
    reporters: ["default"],
    typecheck: { enabled: false },
  },
});

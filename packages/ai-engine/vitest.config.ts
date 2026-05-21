import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/ai-engine.
 *
 * Scope:
 *   • Tests live in src/pipeline/__tests__/*.test.ts (co-located with the
 *     stage source). Helpers under __tests__/_helpers/ are pure factories
 *     used by tests — not real production code.
 *   • All M5 tests run against MOCKED providers (test-injected adapter
 *     stubs). No vendor SDK is actually invoked. No network egress.
 *   • Coverage is intentionally NOT enabled here; the M5 gate is "tests
 *     pass with mocks". Coverage reporting is an observability concern
 *     reserved for M12 (observability milestone).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    globals: false,
    testTimeout: 10_000,
    pool: "threads",
    reporters: ["default"],
    typecheck: {
      enabled: false,
    },
  },
});

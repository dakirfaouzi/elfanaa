import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `apps/studio`.
 *
 * Scope:
 *   • Pure unit tests for lib/studio/* (loaders, server-action helpers,
 *     preview prop-builders). All testable Studio logic lives in plain
 *     TypeScript modules — the React server components on top are
 *     intentionally thin wrappers around these tested helpers.
 *
 * Out of scope:
 *   • Component rendering tests. The Studio surface is internal-only,
 *     stateless, and JS-free; ReactDOM rendering tests would add weight
 *     without catching real-world bugs. The M9 Playwright suite covers
 *     end-to-end UI.
 *
 * No Next.js server, no jsdom — tests run in pure Node so they share
 * the file-system semantics used by the @platform/ingest FileStore and
 * the M7 FilePublishStore.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next", ".turbo"],
    globals: false,
    testTimeout: 10_000,
    reporters: ["default"],
    typecheck: { enabled: false },
  },
});

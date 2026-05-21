import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @platform/publishers.
 *
 * Tests live under src and __tests__ subfolders and exercise:
 *   - FanaaPublisher happy-path materialisation
 *   - Schema-drift canaries (pinned bundle byte-equality)
 *   - Replay determinism (same input twice = identical file)
 *   - Invalid pipeline-output rejection (Zod errors typed)
 *
 * File-backed tests use temp directories under the OS tmpdir.
 * No network egress, no Octokit, no Prisma.
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

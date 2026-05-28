import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest configuration for `apps/fanaa`.
 *
 * # Scope
 *
 *   • Pure unit + integration tests for the catalog hybrid loader
 *     (M12 / Step 2). `lib/catalog/merge.ts` is pure (no React, no
 *     Prisma, no I/O) and `lib/catalog/loader.ts` exposes a small,
 *     mockable shape; both are testable in pure Node.
 *
 *   • Future: pricing math (`lib/pricing.ts`), upsell strategy
 *     (`lib/upsell/strategy.ts`), and the localised helpers in
 *     `lib/locale.ts` are all pure and should land here as the
 *     storefront grows.
 *
 * # Out of scope
 *
 *   • React server-component rendering. The storefront's surfaces
 *     are integration-tested via the deployed environment + manual
 *     verification today. Adding jsdom + Testing Library would add
 *     significant CI weight for tier-A.
 *
 *   • End-to-end PDP / checkout flows. Those belong in a separate
 *     Playwright pass when we wire one up.
 *
 * # Why pure Node
 *
 * Same rationale as `apps/studio` — the testable surface is plain
 * TypeScript modules and we want the tests to share the same
 * runtime semantics as production (Node 22).
 */
export default defineConfig({
  // The fanaa app uses `@/*` as a shortcut for the workspace root in
  // `tsconfig.json::paths` (`"@/*": ["./*"]`). Vitest 2.x does not
  // auto-resolve tsconfig path aliases — wire the alias explicitly so
  // tests can import from `@/lib/...` exactly like the application
  // code does.
  resolve: {
    alias: {
      "@": HERE,
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next", ".turbo"],
    globals: false,
    testTimeout: 5_000,
    reporters: ["default"],
    typecheck: { enabled: false },
  },
});

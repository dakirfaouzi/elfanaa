/**
 * Next.js instrumentation hook — runs ONCE at server boot, BEFORE
 * any request is handled. Stable feature in Next 15.
 *
 * # Responsibilities
 *
 * The instrumentation hook is the right place for code that must
 * execute exactly once per server-process lifetime and that needs
 * full Node.js APIs (Prisma, fs, etc). Today this hook performs a
 * single bootstrap task:
 *
 *   • M12 / Step 2 — fanaa storefront catalog auto-seed.
 *     A one-shot, env-gated, idempotent seed runner that populates
 *     the four curated catalog rows the FIRST time a Studio
 *     container boots against a freshly-migrated DB.
 *
 * # Why a separate file (not the persistence factory)
 *
 * `lib/studio/persistence.ts` is lazy — it only runs on the first
 * request that needs persistence. We need the seed to be DEPLOY-
 * TIME observable: it must appear in the boot logs so operators
 * can confirm the seed landed before traffic arrives. The
 * instrumentation hook gives us that guarantee.
 *
 * # Runtime gating
 *
 * Next.js evaluates `instrumentation.ts` in BOTH the Node.js and
 * Edge runtimes. The Edge runtime cannot load `@prisma/client` (no
 * native bindings, no Node APIs). We gate the Node-only side
 * effects behind `process.env.NEXT_RUNTIME === "nodejs"` per
 * Next.js's documented pattern.
 *
 * # Errors NEVER block boot
 *
 * Every operation inside `register()` is wrapped in a try/catch.
 * An auto-seed failure logs but does NOT propagate — a thrown
 * error from `register()` would crash the entire Studio process
 * before serving any traffic, which is far worse than an
 * unseeded catalog (the storefront's loader falls back to its
 * build-time snapshot in that case).
 */

export async function register(): Promise<void> {
  // Edge runtime: skip. The Edge runtime cannot load Prisma anyway.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    // Dynamic import keeps Next from statically bundling the
    // Prisma-pulling auto-seed module into the Edge runtime where
    // it would be invalid. The dynamic specifier is statically
    // analysable, so Next still traces it into the Node bundle.
    const { runStorefrontCatalogAutoSeed } = await import(
      "./lib/studio/storefront-catalog-auto-seed"
    );
    await runStorefrontCatalogAutoSeed();
  } catch (err) {
    // Defensive: nothing in the seed runner is supposed to throw,
    // but if a future change here ever does, the container MUST
    // still boot.
    // eslint-disable-next-line no-console
    console.error(
      "[instrumentation] register() caught an unexpected error — continuing boot",
      err,
    );
  }
}

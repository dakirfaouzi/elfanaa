#!/usr/bin/env tsx
/**
 * Worker healthcheck CLI.
 *
 *   pnpm --filter @platform/worker health
 *
 * Runs three classes of check:
 *
 *   1. Provider availability — invokes the M4 healthcheck across all
 *      configured adapters (1-token ping). Reports per-provider status.
 *   2. Queue path writability — creates a temp file in the configured
 *      queue dir (default `.platform-data/queue/`). Verifies dir
 *      exists/can be created.
 *   3. RunStore path writability — same for `.platform-data/runs/`.
 *
 * Exits 0 when every check passes. Exits 1 on first failure. Designed
 * to be safe to run in CI smoke-tests as well as developer terminals.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runAllProviderHealthChecks } from "@platform/ai-engine";

const QUEUE_DIR = process.env.PLATFORM_QUEUE_DIR ?? ".platform-data/queue";
const RUNS_DIR = process.env.PLATFORM_RUNS_DIR ?? ".platform-data/runs";

async function main(): Promise<number> {
  let failures = 0;

  // ── 1. Providers ────────────────────────────────────────────────────────
  console.log("┃ providers");
  const providerReports = await runAllProviderHealthChecks();
  for (const r of providerReports) {
    const status = r.ok ? "ok" : "fail";
    const detail = r.ok
      ? `${r.latencyMs}ms`
      : (r.errorMessage ?? "no_error_message");
    console.log(`┃   ${r.providerId.padEnd(10)} ${r.capability.padEnd(10)} ${status.padEnd(4)} ${detail}`);
    if (!r.ok) failures += 1;
  }

  // ── 2. Queue path ───────────────────────────────────────────────────────
  console.log("┃ queue");
  try {
    await mkdir(QUEUE_DIR, { recursive: true });
    const probe = join(QUEUE_DIR, ".health-probe");
    await writeFile(probe, "ok", "utf8");
    await rm(probe);
    console.log(`┃   ${QUEUE_DIR.padEnd(38)} writable`);
  } catch (err) {
    failures += 1;
    console.log(
      `┃   ${QUEUE_DIR.padEnd(38)} FAIL  ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  // ── 3. RunStore path ────────────────────────────────────────────────────
  console.log("┃ runstore");
  try {
    await mkdir(RUNS_DIR, { recursive: true });
    const probe = join(RUNS_DIR, ".health-probe");
    await writeFile(probe, "ok", "utf8");
    await rm(probe);
    console.log(`┃   ${RUNS_DIR.padEnd(38)} writable`);
  } catch (err) {
    failures += 1;
    console.log(
      `┃   ${RUNS_DIR.padEnd(38)} FAIL  ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("healthcheck_crashed", err);
    process.exit(2);
  });

#!/usr/bin/env tsx
/**
 * Provider health-check CLI (PLATFORM.md §22 M4 gate).
 *
 * # What it does
 *
 * Resolves every capability chain from env, runs `.healthCheck()` on
 * every provider (primary + fallbacks), prints a tabular summary,
 * exits 0 when every required capability has at least one healthy
 * provider, 1 otherwise.
 *
 * # Usage
 *
 *     pnpm --filter @platform/ai-engine ping
 *
 *     # or directly:
 *     pnpm dlx tsx packages/ai-engine/scripts/check-providers.ts
 *
 * # Required vs optional capabilities
 *
 *   • Required (process exits 1 on failure): text, vision, image, scraper
 *   • Optional (warning only):               embedding
 *
 * Embedding is optional because the M11 upsell-match stage that needs
 * it can fall back to "store best-sellers" when embeddings are missing
 * (PLATFORM.md §11 stage 11 fallback).
 *
 * # Cost
 *
 * Calling this script with all four API keys configured costs roughly
 * $0.002 — one cheap call per provider:
 *
 *   anthropic ping  ~$0.0000008 (Haiku, 1 token)
 *   openai ping     ~$0.00000002 (embedding, 1 token)
 *   fal ping        $0          (auth-only probe via queue.status)
 *   firecrawl ping  ~$0.001     (scrape example.com)
 *
 * Safe to run on every container start and pre-deploy smoke test.
 */
import { runAllProviderHealthChecks } from "../src/providers/healthcheck";
import type { ProviderHealth } from "../src/providers/types";

const REQUIRED_CAPABILITIES = new Set<ProviderHealth["capability"]>([
  "text",
  "vision",
  "image",
  "scraper",
]);

function ms(n: number): string {
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function renderTable(results: ProviderHealth[]): string {
  const header = [
    pad("CAPABILITY", 11),
    pad("PROVIDER", 12),
    pad("STATUS", 8),
    pad("LATENCY", 10),
    pad("MODEL", 28),
    "DETAIL",
  ].join(" │ ");
  const sep = "─".repeat(110);

  const rows = results.map((r) => {
    const status = r.ok ? "OK   ✓" : "FAIL ✗";
    const latency = ms(r.latencyMs);
    const detail = r.ok
      ? r.costUsd !== undefined
        ? `$${r.costUsd.toFixed(7)}`
        : ""
      : r.errorMessage ?? "";
    return [
      pad(r.capability, 11),
      pad(r.providerId, 12),
      pad(status, 8),
      pad(latency, 10),
      pad(r.model ?? "—", 28),
      detail,
    ].join(" │ ");
  });

  return [header, sep, ...rows].join("\n");
}

async function main(): Promise<number> {
  const t0 = performance.now();
  console.log("─".repeat(72));
  console.log("  @platform/ai-engine — provider health check");
  console.log("─".repeat(72));
  const results = await runAllProviderHealthChecks();
  console.log();
  console.log(renderTable(results));
  console.log();
  console.log(`Total: ${results.length} probes in ${ms(Math.round(performance.now() - t0))}`);

  // Pass criterion: at least one OK provider per REQUIRED capability.
  const byCap = new Map<string, ProviderHealth[]>();
  for (const r of results) {
    const arr = byCap.get(r.capability) ?? [];
    arr.push(r);
    byCap.set(r.capability, arr);
  }
  const failures: string[] = [];
  for (const cap of REQUIRED_CAPABILITIES) {
    const rows = byCap.get(cap) ?? [];
    const anyOk = rows.some((r) => r.ok);
    if (!anyOk) {
      failures.push(cap);
    }
  }

  console.log();
  if (failures.length === 0) {
    console.log("✓ Every required capability has at least one healthy provider.");
    return 0;
  }
  console.log(
    `✗ Required capabilities with no healthy provider: ${failures.join(", ")}`
  );
  console.log(
    "  Configure the missing API keys (see packages/ai-engine/.env.example)."
  );
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[check-providers] unhandled error:", err);
    process.exit(2);
  });

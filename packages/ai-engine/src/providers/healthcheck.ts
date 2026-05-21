import type { ProviderHealth } from "./types";
import {
  resolveText,
  resolveVision,
  resolveImage,
  resolveScraper,
  resolveEmbedding,
} from "./registry";

/**
 * Health-check composer (PLATFORM.md §22 M4 gate: "1-token ping").
 *
 * Resolves every capability's chain and runs `.healthCheck()` against
 * primary + every fallback. Results are aggregated into a flat array
 * the CLI script (and future Studio dashboard) can render.
 *
 * # Behaviour with missing providers
 *
 * When a chain produces zero providers (`primary === null`) — typically
 * because every API key in the chain is unset — we emit a synthetic
 * `ProviderHealth` row for the capability with `errorMessage:
 * "no_provider_configured"` so the CLI surface stays consistent.
 *
 * # Behaviour with mixed success
 *
 * One failing primary + one healthy fallback is reported as TWO rows,
 * both surfaced; the caller (CLI / dashboard) decides what to highlight.
 * This keeps the health check honest — a green dashboard with a dead
 * primary is worse than two clearly-labelled rows.
 *
 * # Safety
 *
 * `runAllProviderHealthChecks()` NEVER throws. Every provider's
 * `healthCheck()` is wrapped in `Promise.allSettled` — even if an
 * adapter has a bug that throws (rather than returning `{ ok: false }`),
 * the aggregator catches it and produces a synthetic failure row.
 */

type CapabilityName =
  | "text"
  | "vision"
  | "image"
  | "scraper"
  | "embedding";

type Probe = {
  capability: CapabilityName;
  primary: import("./contracts").BaseProvider | null;
  fallbacks: import("./contracts").BaseProvider[];
};

function gatherProbes(): Probe[] {
  return [
    { capability: "text", ...resolveText() },
    { capability: "vision", ...resolveVision() },
    { capability: "image", ...resolveImage() },
    { capability: "scraper", ...resolveScraper() },
    { capability: "embedding", ...resolveEmbedding() },
  ];
}

export async function runAllProviderHealthChecks(): Promise<ProviderHealth[]> {
  const probes = gatherProbes();
  const out: ProviderHealth[] = [];

  for (const probe of probes) {
    const all = probe.primary
      ? [probe.primary, ...probe.fallbacks]
      : [...probe.fallbacks];
    if (all.length === 0) {
      out.push({
        ok: false,
        providerId: "(none)",
        capability: probe.capability,
        latencyMs: 0,
        errorMessage: "no_provider_configured",
      });
      continue;
    }
    const settled = await Promise.allSettled(all.map((p) => p.healthCheck()));
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        out.push(result.value);
      } else {
        out.push({
          ok: false,
          providerId: all[i].id,
          capability: probe.capability,
          latencyMs: 0,
          errorMessage:
            result.reason instanceof Error
              ? `unhandled_error:${result.reason.message}`
              : `unhandled_error:${String(result.reason)}`,
        });
      }
    }
  }

  return out;
}

import type {
  EmbeddingProvider,
  ImageProvider,
  ScraperProvider,
  TextProvider,
  VisionProvider,
} from "@platform/ai-engine";
import type { CostRow } from "@platform/ingest";

/**
 * Cost recorder — decorates a provider so every call appends a CostRow
 * to a sink (typically the orchestrator's per-run cost buffer).
 *
 * # Why a decorator, not provider-side instrumentation
 *
 *   • Providers (M4 adapters) already return `result.costUsd`, but the
 *     pipeline stages don't surface the result-level cost back to the
 *     worker — `runTextStage()` returns only the parsed value.
 *   • Wrapping at the provider boundary captures cost without changing
 *     any M5 stage signature.
 *
 * # Stage attribution
 *
 * The recorder takes a `getStage()` callback so the orchestrator can
 * mutate the "current stage" between calls without rebuilding the
 * wrappers. CostRows are then tagged with whichever stage was active
 * at call time.
 */

export interface CostRecorderOptions {
  runId: string;
  /** Returns the stage name to tag the row with. Read at call time. */
  getStage: () => string;
  /** Append-only sink — orchestrator flushes to RunStore after each stage. */
  push: (row: CostRow) => void;
}

export function wrapTextWithCost(
  provider: TextProvider,
  opts: CostRecorderOptions,
): TextProvider {
  return {
    id: provider.id,
    healthCheck: () => provider.healthCheck(),
    async generate(callOpts) {
      const result = await provider.generate(callOpts);
      opts.push({
        runId: opts.runId,
        stage: opts.getStage(),
        capability: "text",
        providerId: result.providerId,
        model: result.model,
        costUsd: result.costUsd,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
  };
}

export function wrapVisionWithCost(
  provider: VisionProvider,
  opts: CostRecorderOptions,
): VisionProvider {
  return {
    id: provider.id,
    healthCheck: () => provider.healthCheck(),
    async analyze(callOpts) {
      const result = await provider.analyze(callOpts);
      opts.push({
        runId: opts.runId,
        stage: opts.getStage(),
        capability: "vision",
        providerId: result.providerId,
        model: result.model,
        costUsd: result.costUsd,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
  };
}

export function wrapImageWithCost(
  provider: ImageProvider,
  opts: CostRecorderOptions,
): ImageProvider {
  return {
    id: provider.id,
    cost: provider.cost,
    healthCheck: () => provider.healthCheck(),
    async generate(callOpts) {
      const result = await provider.generate(callOpts);
      opts.push({
        runId: opts.runId,
        stage: opts.getStage(),
        capability: "image",
        providerId: result.providerId,
        model: result.model,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
  };
}

export function wrapScraperWithCost(
  provider: ScraperProvider,
  opts: CostRecorderOptions,
): ScraperProvider {
  return {
    id: provider.id,
    healthCheck: () => provider.healthCheck(),
    async fetch(url, fetchOpts) {
      const result = await provider.fetch(url, fetchOpts);
      opts.push({
        runId: opts.runId,
        stage: opts.getStage(),
        capability: "scraper",
        providerId: result.providerId,
        costUsd: result.costUsd,
        latencyMs: result.durationMs,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
  };
}

export function wrapEmbeddingWithCost(
  provider: EmbeddingProvider,
  opts: CostRecorderOptions,
): EmbeddingProvider {
  return {
    id: provider.id,
    dimensions: provider.dimensions,
    healthCheck: () => provider.healthCheck(),
    async embed(callOpts) {
      const startedAt = Date.now();
      const result = await provider.embed(callOpts);
      // Embedding adapters in M4 don't currently return cost; the
      // worker stores a zero row tagged with the provider id so the
      // call is still visible in the CostRow stream.
      opts.push({
        runId: opts.runId,
        stage: opts.getStage(),
        capability: "embedding",
        providerId: provider.id,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
      return result;
    },
  };
}

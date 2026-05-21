import {
  resolveTextForStore,
  resolveVisionForStore,
  resolveImageForStore,
  resolveScraperForStore,
  resolveEmbedding,
  type EmbeddingProvider,
  type ImageProvider,
  type ScraperProvider,
  type TextProvider,
  type VisionProvider,
} from "@platform/ai-engine";
import type { StoreConfig } from "@platform/stores";

/**
 * Bridges the M4 provider registry to the bundle shape the M5
 * pipeline accepts. Pure resolution — no cost wrapping here. The
 * orchestrator owns the CostRecorder lifetime because it knows which
 * stage is currently executing.
 *
 * # Why per-store resolution
 *
 * `resolve*ForStore` honours `StoreConfig.approvedProviders` so a
 * store can pin to specific models. When the allowlist is empty for
 * a capability, the resolver falls back to the platform default chain.
 *
 * # Required vs optional providers
 *
 * The M5 pipeline requires text + vision + image + scraper to be
 * available. Embedding is optional (upsell-match falls back to
 * best-sellers when absent). This resolver enforces required
 * capabilities at the resolution boundary so a missing provider
 * surfaces as a clear error before the pipeline starts, not mid-run.
 */
export interface ResolvedProviders {
  text: TextProvider;
  vision: VisionProvider;
  image: ImageProvider;
  scraper: ScraperProvider;
  /** Optional — undefined when no embedding adapter has an API key. */
  embedding?: EmbeddingProvider;
}

export function resolveProvidersForStore(opts: {
  storeConfig: StoreConfig;
}): ResolvedProviders {
  const textChain = resolveTextForStore(opts.storeConfig);
  const visionChain = resolveVisionForStore(opts.storeConfig);
  const imageChain = resolveImageForStore(opts.storeConfig);
  const scraperChain = resolveScraperForStore(opts.storeConfig);
  const embeddingChain = resolveEmbedding();

  if (!textChain.primary)
    throw new Error("provider_unavailable: text (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");
  if (!visionChain.primary)
    throw new Error("provider_unavailable: vision (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");
  if (!imageChain.primary)
    throw new Error("provider_unavailable: image (set FAL_KEY)");
  if (!scraperChain.primary)
    throw new Error("provider_unavailable: scraper (set FIRECRAWL_API_KEY)");

  // Note: fallbacks deferred to M6.5 — adapter-chain rotation lands
  // alongside the Inngest adapter. Today the worker uses the primary
  // only and surfaces a provider-side failure to the orchestrator's
  // retry policy.
  return {
    text: textChain.primary,
    vision: visionChain.primary,
    image: imageChain.primary,
    scraper: scraperChain.primary,
    embedding: embeddingChain.primary ?? undefined,
  };
}

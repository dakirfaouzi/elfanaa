/**
 * @platform/ai-engine/providers — provider layer barrel.
 *
 * Subpath import (`@platform/ai-engine/providers`) preferred over the
 * package root for tree-shakability in M5+. The package root only
 * re-exports a curated handful of common things; the full type/contract
 * surface lives here.
 */

// Types
export type {
  Adapter,
  CallContext,
  ImageRef,
  ProviderCapability,
  ProviderChain,
  ProviderHealth,
  ProviderId,
} from "./types";

// Result shapes
export type {
  ImageOnPage,
  ImageResult,
  ScrapeOptions,
  ScrapeResult,
  TextResult,
  TokenUsage,
  VisionResult,
} from "./result-types";

// Contracts (one interface per capability)
export type {
  BaseProvider,
  EmbeddingCallOptions,
  EmbeddingProvider,
  ImageCallOptions,
  ImageProvider,
  ScraperProvider,
  TextCallOptions,
  TextProvider,
  VisionCallOptions,
  VisionProvider,
} from "./contracts";

// Zod schemas (subpath: @platform/ai-engine/providers/schemas)
// — re-exported here for convenience; explicit subpath is preferred.
export {
  ImageResultSchema,
  ProviderHealthSchema,
  ScrapeResultSchema,
  TextResultSchema,
} from "./schemas";

// Env helpers
export { providerEnv, parseChain, DEFAULT_CHAINS } from "./env";

// Registry
export {
  registry,
  resolveText,
  resolveVision,
  resolveImage,
  resolveScraper,
  resolveEmbedding,
  resolveTextForStore,
  resolveVisionForStore,
  resolveImageForStore,
  resolveScraperForStore,
  clearProviderCache,
} from "./registry";

// Health check composer
export { runAllProviderHealthChecks } from "./healthcheck";

// Adapter factories — exported for direct consumption when bypassing
// the env-driven registry is intentional (test fixtures, one-off scripts).
// M5+ pipeline code should NOT import these directly — always go through
// the registry.
export { createAnthropicAdapter } from "./adapters/anthropic";
export { createOpenAIAdapter } from "./adapters/openai";
export { createFalAdapter } from "./adapters/fal";
export { createFirecrawlAdapter } from "./adapters/firecrawl";

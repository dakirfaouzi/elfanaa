/**
 * @platform/ai-engine — package root.
 *
 * M4 surface = the provider layer only. Subsequent milestones extend:
 *
 *   • M5: pipeline stages (`./pipeline/*`), per-stage Zod schemas (`./schemas/*`),
 *         reusable prompt builders (`./prompts/*`).
 *   • M6: Inngest middleware (split into `@platform/workers`).
 *
 * Preferred import surface for callers:
 *
 *   import { registry, type TextProvider } from "@platform/ai-engine/providers";
 *
 * This root-level barrel re-exports the most-used items so quick scripts
 * can `import { registry } from "@platform/ai-engine"` without a subpath.
 */
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
  runAllProviderHealthChecks,
} from "./providers";

export type {
  Adapter,
  ProviderId,
  ProviderCapability,
  ProviderChain,
  ProviderHealth,
  TextProvider,
  VisionProvider,
  ImageProvider,
  ScraperProvider,
  EmbeddingProvider,
  TextResult,
  VisionResult,
  ImageResult,
  ScrapeResult,
  ImageRef,
} from "./providers";

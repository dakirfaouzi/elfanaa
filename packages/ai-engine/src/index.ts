/**
 * @platform/ai-engine — package root.
 *
 * M4 surface — provider layer (contracts + env-driven registry + adapters
 * for Anthropic, OpenAI, fal.ai, Firecrawl).
 *
 * M5 surface — pure-TypeScript pipeline core (11 stage functions
 * research → assemble, per-stage Zod schemas, reusable prompt builders
 * parameterised by StoreConfig + BrandProfile + NicheProfile).
 *
 * M6 surface (future) — Inngest middleware + worker terminal step
 * (Ready), promoted to `@platform/workers` for runtime concerns.
 *
 * Preferred import surfaces for callers:
 *
 *   import { registry, type TextProvider } from "@platform/ai-engine/providers";
 *   import * as pipeline from "@platform/ai-engine/pipeline";
 *   import { UniversalProductSchema } from "@platform/ai-engine/schemas";
 *   import { buildSystemPrompt } from "@platform/ai-engine/prompts";
 *
 * This root-level barrel re-exports the most-used items so quick scripts
 * can `import { registry } from "@platform/ai-engine"` without a subpath.
 */

// Provider layer (M4 surface — unchanged from prior milestone).
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

// Pipeline layer (M5 surface) — type-only re-exports at the root keep
// the package self-contained while encouraging subpath imports in
// callers.
export type {
  PipelineProviders,
  StageContext,
  StageErrorKind,
  ResearchInput,
  ResearchOutput,
  VisionInput,
  VisionOutput,
  StrategyInput,
  StrategyOutput,
  StructureInput,
  StructureOutput,
  CopyInput,
  CopyOutput,
  CreativePromptsInput,
  CreativePromptsOutput,
  ImageGenInput,
  ImageGenOutput,
  ImagePostInput,
  ImagePostOutput,
  SocialProofInput,
  SocialProofOutput,
  UpsellMatchCatalogPort,
  UpsellMatchInput,
  UpsellMatchOutput,
  AssembleInput,
  AssembleOutput,
} from "./pipeline";

export { PipelineError } from "./pipeline";

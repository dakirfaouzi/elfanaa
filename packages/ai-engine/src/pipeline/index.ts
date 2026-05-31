/**
 * @platform/ai-engine/pipeline — barrel.
 *
 * The M5 pipeline core (PLATFORM.md §11). 11 pure-TypeScript stage
 * functions (research → assemble) plus their input/output types and
 * the shared `StageContext` + `PipelineError` surfaces.
 *
 * Stages 01 (Intake) and 13 (Ready) live OUTSIDE this package:
 *   • 01 = Studio API route (`apps/studio/...`)        — wired in M8
 *   • 13 = worker terminal step (`@platform/workers/...`) — wired in M6
 *
 * # Usage shape (M6 worker)
 *
 *   import * as pipeline from "@platform/ai-engine/pipeline";
 *
 *   const research = await pipeline.research({
 *     input: { supplierUrl: "..." },
 *     providers: { scraper },
 *     storeConfig,
 *     runId,
 *   });
 *
 *   const vision = await pipeline.vision({
 *     input: { images },
 *     providers: { vision: visionProvider },
 *     storeConfig,
 *     runId,
 *   });
 *
 *   const strategy = await pipeline.strategy({
 *     input: { supplierUrl, research, vision, operatorNotes },
 *     providers: { text },
 *     storeConfig,
 *     runId,
 *   });
 *
 *   // …and so on through stage 12.
 *
 * # Tests
 *
 * Co-located under `src/pipeline/__tests__/`. Vitest is configured at
 * the package root (`vitest.config.ts`). Tests use mocked providers
 * from `__tests__/_helpers/mock-providers.ts` — zero network egress,
 * zero vendor SDK invocation.
 */

export type {
  PipelineProviders,
  StageContext,
  StageErrorKind,
} from "./types";
export { PipelineError } from "./types";

// Stage type re-exports (per-stage input/output shapes).
export type { ResearchInput, ResearchOutput } from "./types-research";
export type { VisionInput, VisionOutput } from "./types-vision";
export type {
  StrategyBenefitAngle,
  StrategyInput,
  StrategyObjection,
  StrategyOutput,
} from "./types-strategy";
export type {
  StructureInput,
  StructureOutput,
} from "./types-structure";
export type { CopyInput, CopyOutput } from "./types-copy";
export type {
  AspectRatio,
  CreativePrompt,
  CreativePromptsInput,
  CreativePromptsOutput,
} from "./types-creative-prompts";
export type {
  ImageGenFailure,
  ImageGenInput,
  ImageGenOutput,
  ImageGenResult,
} from "./types-image-gen";
export type {
  ImagePostInput,
  ImagePostOutput,
  ProcessedImage,
} from "./types-image-post";
export type {
  SocialProofInput,
  SocialProofOutput,
} from "./types-social-proof";
export type {
  SectionContentInput,
  SectionContentOutput,
} from "./types-section-content";
export type {
  UpsellMatchCatalogPort,
  UpsellMatchInput,
  UpsellMatchOutput,
} from "./types-upsell-match";
export type {
  AssembleInput,
  AssembleOutput,
} from "./types-assemble";

// Stage functions.
export { research } from "./research";
export { vision } from "./vision";
export { strategy } from "./strategy";
export { structure } from "./structure";
export { copy } from "./copy";
export { creativePrompts } from "./creative-prompts";
export { imageGen } from "./image-gen";
export { imagePost } from "./image-post";
export { socialProof } from "./social-proof";
export { upsellMatch } from "./upsell-match";
export { sectionContent } from "./section-content";
export { assemble } from "./assemble";

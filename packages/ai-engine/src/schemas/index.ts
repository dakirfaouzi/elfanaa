/**
 * @platform/ai-engine/schemas — barrel for per-stage Zod validators.
 *
 * Each stage of the pipeline (PLATFORM.md §11) has a co-located runtime
 * validator. The assemble stage targets the canonical
 * `UniversalProductSchema` from `@platform/catalog-schema/schemas`
 * (re-exported here for convenience).
 *
 * Consumers should import the specific schema they need, never the
 * whole barrel — keeps the eventual production bundle small.
 */
export { ResearchOutputSchema } from "./research";
export { VisionOutputSchema } from "./vision";
export { StrategyOutputSchema } from "./strategy";
export { StructureOutputSchema } from "./structure";
export { CopyOutputSchema } from "./copy";
export { CreativePromptsOutputSchema } from "./creative-prompts";
export { ImageGenOutputSchema } from "./image-gen";
export { ImagePostOutputSchema } from "./image-post";
export { SocialProofOutputSchema } from "./social-proof";
export { UpsellMatchOutputSchema } from "./upsell-match";
export { UniversalProductSchema } from "./assemble";

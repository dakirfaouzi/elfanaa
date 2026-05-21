import type { Money, UniversalProduct } from "@platform/catalog-schema";
import type { ResearchOutput } from "./types-research";
import type { VisionOutput } from "./types-vision";
import type { StrategyOutput } from "./types-strategy";
import type { StructureOutput } from "./types-structure";
import type { CopyOutput } from "./types-copy";
import type { CreativePromptsOutput } from "./types-creative-prompts";
import type { ImageGenOutput } from "./types-image-gen";
import type { ImagePostOutput } from "./types-image-post";
import type { SocialProofOutput } from "./types-social-proof";
import type { UpsellMatchOutput } from "./types-upsell-match";

/**
 * Stage 12 (Assembly) input type. Output is `UniversalProduct` from
 * `@platform/catalog-schema` — re-used here so the publisher (M7) can
 * consume it without indirection.
 *
 * The assemble stage is pure TS: it stitches every prior stage's output
 * into a single canonical UniversalProduct and validates the result
 * with `UniversalProductSchema`. PLATFORM.md §11 stage 12: "Validate
 * against `UniversalProduct` schema".
 *
 * # Inputs that are NOT pipeline outputs
 *
 *   • `priceHint`         — operator-provided at intake.
 *   • `uploadedImageKeys` — operator-uploaded image refs (passed to the
 *                            UniversalProduct provenance block).
 *   • `niche`             — sourced from StoreConfig.
 */
export interface AssembleInput {
  research: ResearchOutput;
  vision: VisionOutput;
  strategy: StrategyOutput;
  structure: StructureOutput;
  copy: CopyOutput;
  prompts: CreativePromptsOutput;
  imageGen: ImageGenOutput;
  imagePost: ImagePostOutput;
  socialProof: SocialProofOutput;
  upsells: UpsellMatchOutput;

  // Non-pipeline inputs threaded from intake
  /** Operator-provided unit price. The publisher decides offer structure. */
  priceHint: Money;
  /** R2 keys / URLs of supplier images uploaded at intake. */
  uploadedImageKeys: string[];
  /** Operator's internal margin notes — never customer-facing. */
  marginNotes?: string;
}

export type AssembleOutput = UniversalProduct;

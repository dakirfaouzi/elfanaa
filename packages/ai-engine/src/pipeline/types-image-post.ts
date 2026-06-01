import type { LocalizedString } from "@platform/catalog-schema";
import type { CopyOutput } from "./types-copy";
import type { ImageGenOutput } from "./types-image-gen";

/**
 * Stage 09 (Image post-process) input + output types.
 *
 * In M5 the post-process stage is a pure URL/grouping transform: it
 * splits the image-gen results into hero / gallery / lifestyle buckets
 * and attaches bilingual alt text. Real Sharp resizing + WebP encoding
 * + R2 upload lives in the M6 worker — at which point the stage gains
 * side-effects but the contract here stays stable.
 *
 * PLATFORM.md §11 stage 09 failure mode: "Skip variant on Sharp throw"
 * is a runtime-level concern (M6); in M5 this stage cannot fail except
 * via empty input.
 */
export interface ImagePostInput {
  imageGen: ImageGenOutput;
  copy: CopyOutput;
}

export interface ProcessedImage {
  src: string;
  alt: LocalizedString;
  width: number;
  height: number;
  /**
   * Semantic scene role carried from the creative-prompts `intent` (Phase
   * 4.6.3) so the storefront can assign the right scene to the right section.
   */
  intent?: string;
}

export interface ImagePostOutput {
  /** Hero image — first 1:1 generated result, when available. */
  hero?: ProcessedImage;
  /** Cut-out / product-shot gallery — everything except hero + lifestyle. */
  gallery: ProcessedImage[];
  /** Editorial lifestyle frames. */
  lifestyle: ProcessedImage[];
  /** True when the M6 worker stage performed real Sharp work. Always false in M5. */
  postProcessed: boolean;
}

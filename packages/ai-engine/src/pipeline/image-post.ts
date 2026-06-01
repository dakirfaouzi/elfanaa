import type { LocalizedString } from "@platform/catalog-schema";
import { ImagePostOutputSchema } from "../schemas/image-post";
import type { StageContext } from "./types";
import type {
  ImageGenResult,
} from "./types-image-gen";
import type {
  ImagePostInput,
  ImagePostOutput,
  ProcessedImage,
} from "./types-image-post";

/**
 * Stage 09 — Image post-process (PLATFORM.md §11).
 *
 * In M5 this is a pure URL/grouping transform with no I/O:
 *
 *   • Splits the image-gen results into hero / gallery / lifestyle.
 *   • Generates bilingual alt text for each image from the prompt intent
 *     + the copy headline (used as a fallback when intent is missing).
 *   • Marks the output `postProcessed: false` so downstream consumers
 *     know no Sharp work was performed.
 *
 * Real Sharp + R2 work lives in the M6 worker, which calls this stage
 * first, then walks the results array uploading WebP variants. The
 * contract is preserved: M6 only mutates `src`, `width`, `height`, and
 * flips `postProcessed: true`.
 */
export async function imagePost(
  opts: {
    input: ImagePostInput;
  } & Pick<StageContext, "storeConfig" | "runId">,
): Promise<ImagePostOutput> {
  const heroResult = opts.input.imageGen.results.find((r) => r.role === "hero");
  const lifestyleResults = opts.input.imageGen.results.filter(
    (r) => r.role === "lifestyle",
  );

  const hero = heroResult
    ? toProcessedImage(heroResult, opts.input.copy.headline, "hero")
    : undefined;

  const lifestyle = lifestyleResults.map((r) =>
    toProcessedImage(r, opts.input.copy.headline, "lifestyle"),
  );

  // M5 has no separate "gallery" generation path — the gallery section
  // is reserved for M6+ when the worker downloads supplier-uploaded
  // images and emits processed variants. In M5 it's an empty array.
  const output: ImagePostOutput = {
    hero,
    gallery: [],
    lifestyle,
    postProcessed: false,
  };
  return ImagePostOutputSchema.parse(output);
}

function toProcessedImage(
  r: ImageGenResult,
  headline: LocalizedString,
  role: "hero" | "lifestyle",
): ProcessedImage {
  return {
    src: r.url,
    alt: buildAltText({ headline, role, intent: r.intent }),
    width: r.width,
    height: r.height,
    // Phase 4.6.3 — carry the semantic intent forward so the storefront can
    // assign the scene to its matching section (mechanism → how_it_works, …).
    ...(r.intent ? { intent: r.intent } : {}),
  };
}

function buildAltText(opts: {
  headline: LocalizedString;
  role: "hero" | "lifestyle";
  intent?: string;
}): LocalizedString {
  const intentLabel = opts.intent ?? opts.role;
  return {
    ar: `${opts.headline.ar} — ${intentLabel}`,
    en: `${opts.headline.en} — ${intentLabel}`,
  };
}

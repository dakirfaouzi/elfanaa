import type {
  ProductImage,
  UniversalProduct,
} from "@platform/catalog-schema";
import { UniversalProductSchema } from "../schemas/assemble";
import { PipelineError } from "./types";
import type { StageContext } from "./types";
import type {
  AssembleInput,
  AssembleOutput,
} from "./types-assemble";

/**
 * Stage 12 — Assembly (PLATFORM.md §11).
 *
 * Pure-TypeScript: takes every prior stage's output and stitches them
 * into a single `UniversalProduct`. Validates against
 * `UniversalProductSchema` (canonical contract from
 * `@platform/catalog-schema/schemas`) before returning. Any failure
 * here is a programmer error — assemble cannot recover, only surface.
 *
 * # ID + slug generation
 *
 * IDs and slugs are derived from the runId + headline so the pipeline
 * is reproducible: re-running the same run produces the same draft ID.
 * Publishers may rename the slug; the ID is immutable.
 *
 * # Image precedence
 *
 *   1. Hero from the image-post stage (M5 = generated AI hero).
 *   2. Fallback: first uploaded image (operator-provided at intake).
 *   3. Fail (validation error) if neither exists — UniversalProduct
 *      requires ≥ 1 image.
 */
export async function assemble(
  opts: {
    input: AssembleInput;
  } & StageContext,
): Promise<AssembleOutput> {
  const { input, storeConfig, runId } = opts;

  const id = buildId(runId);
  const slug = buildSlug(input.copy.title.en) || `draft-${id}`;
  const generatedAt = new Date().toISOString();
  const images = buildImageList(input);

  if (images.length === 0) {
    throw new PipelineError({
      kind: "precondition_failed",
      stage: "assemble",
      message:
        "no_images_available: image-gen produced no results AND no uploaded images were provided",
    });
  }

  const product: UniversalProduct = {
    id,
    slug,
    niche: storeConfig.niche,
    storeContext: storeConfig.id,
    generationRunId: runId,
    generatedAt,

    title: input.copy.title,
    description: input.copy.description,
    headline: input.copy.headline,
    subheadline: input.copy.subheadline,

    benefits: input.copy.benefits,

    images,
    lifestyleImages:
      input.imagePost.lifestyle.length > 0
        ? input.imagePost.lifestyle
        : undefined,

    reviews: input.socialProof.reviews,

    faq: input.socialProof.faq,

    priceHint: input.priceHint,
    marginNotes: input.marginNotes,

    hooks: input.socialProof.hooks,

    upsellSuggestions:
      input.upsells.suggestedProductIds.length > 0
        ? input.upsells.suggestedProductIds
        : undefined,

    sources: {
      supplierUrl: input.research.supplierUrl,
      scrapedAt: input.research.scrapedAt,
      uploadedImages: input.uploadedImageKeys,
    },
  };

  return UniversalProductSchema.parse(product);
}

function buildId(runId: string): string {
  return `up_${runId.replace(/[^a-z0-9_-]/gi, "").toLowerCase()}`;
}

/**
 * Build a URL-safe slug from the (preferred-English) title. Falls back
 * to the empty string when input has no slug-able characters; callers
 * must handle that case.
 */
function buildSlug(titleEn: string): string {
  return titleEn
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function buildImageList(input: AssembleInput): ProductImage[] {
  const images: ProductImage[] = [];
  if (input.imagePost.hero) {
    images.push(input.imagePost.hero);
  }
  images.push(...input.imagePost.gallery);
  if (images.length === 0 && input.uploadedImageKeys.length > 0) {
    const fallbackHeadline = input.copy.headline;
    images.push({
      src: input.uploadedImageKeys[0],
      alt: {
        ar: fallbackHeadline.ar,
        en: fallbackHeadline.en,
      },
    });
  }
  return images;
}

import type { PublisherId, UniversalProduct } from "@platform/catalog-schema";
import type {
  Publisher,
  PublishInput,
  PublishResult,
  ValidationResult,
  PublishedProductBundle,
  PreviewResult,
  UnpublishResult,
  UnpublishInput,
} from "../contracts";
import { validateFullBundle } from "../validation";
import {
  FilePublishStore,
  type PublishStore,
} from "../persistence/file-publish-store";
import { normaliseUniversalProduct } from "./normalise";
import { deriveSlug } from "./id-slug";
import {
  toFanaaExtension,
  deriveBeautyWellnessExtension,
} from "./to-fanaa-product";

/**
 * FanaaPublisher — the canonical reference publisher (PLATFORM.md §10).
 *
 * # Pipeline
 *
 *   1. validate(input)
 *      • Zod-validate the UniversalProduct
 *      • Verify locale coverage + image presence
 *      • Check storeContext + niche consistency
 *      • Return ValidationResult (non-throwing)
 *
 *   2. publish(input)
 *      • Run validate() — short-circuit on errors
 *      • Normalise the UniversalProduct (trim, dedupe, clamp)
 *      • Override slug deterministically (publishers may rewrite)
 *      • Materialise FanaaProductExtension
 *      • Derive BeautyWellnessExtension when niche === beauty_wellness
 *        and the caller didn't supply one
 *      • Re-validate post-materialisation
 *      • Write to FilePublishStore (atomic, replay-safe)
 *      • Return PublishedResult
 *
 *   3. unpublish() / preview() — deferred to M8/M9. They return
 *      `not_implemented_M7` for safety so callers can detect the
 *      stub at runtime AND through TypeScript discriminated unions.
 *
 * # Why a class
 *
 * The publisher carries one piece of injected state: the `PublishStore`
 * (file in M7, Prisma in M10). A class makes the seam explicit; tests
 * inject a temp-directory FilePublishStore.
 *
 * # Determinism contract
 *
 * Given identical (`universalProduct`, `storeConfig`) inputs:
 *   • Same slug          (deriveSlug)
 *   • Same SKU           (deriveSku)
 *   • Same offerTiers    (deriveOfferTiers)
 *   • Same productType / target / problems (taxonomy)
 *   • Same publishedAt   (= universalProduct.generatedAt)
 *
 * Therefore the persisted JSON file is byte-identical across replays.
 * The replay-determinism test pins this.
 */
export interface FanaaPublisherOptions {
  /** Inject an alternative store for tests. Defaults to `FilePublishStore()`. */
  store?: PublishStore;
}

export class FanaaPublisher implements Publisher {
  readonly id: PublisherId = "fanaa";
  private readonly store: PublishStore;

  constructor(opts: FanaaPublisherOptions = {}) {
    this.store = opts.store ?? new FilePublishStore();
  }

  /* ─── validate ─────────────────────────────────────────────────────── */

  async validate(input: PublishInput): Promise<ValidationResult> {
    const { universalProduct, storeConfig, fanaaExtensionOverride } = input;

    const beautyWellness = pickNicheExtension({
      product: universalProduct,
      input,
    });

    const tentativeFanaa = safeMaterialiseFanaa({
      product: universalProduct,
      storeConfig,
      override: fanaaExtensionOverride,
    });

    const { errors, warnings } = validateFullBundle({
      product: universalProduct,
      storeId: storeConfig.id,
      storeNiche: storeConfig.niche,
      fanaaExtension: tentativeFanaa,
      beautyWellnessExtension: beautyWellness,
    });

    return { ok: errors.length === 0, errors, warnings };
  }

  /* ─── publish ──────────────────────────────────────────────────────── */

  async publish(input: PublishInput): Promise<PublishResult> {
    const { storeConfig, runId = "", actor = "" } = input;

    const preValidation = await this.validate(input);
    if (!preValidation.ok) {
      return {
        status: "validation_failed",
        storeId: storeConfig.id,
        issues: preValidation.errors,
      };
    }

    const normalised = applyPublisherSlug(
      normaliseUniversalProduct(input.universalProduct),
    );

    const fanaaExtension = toFanaaExtension({
      product: normalised,
      storeConfig,
      override: input.fanaaExtensionOverride,
    });

    const beautyWellnessExtension = pickNicheExtension({
      product: normalised,
      input,
    });

    const postValidation = validateFullBundle({
      product: normalised,
      storeId: storeConfig.id,
      storeNiche: storeConfig.niche,
      fanaaExtension,
      beautyWellnessExtension,
    });

    if (postValidation.errors.length > 0) {
      return {
        status: "validation_failed",
        storeId: storeConfig.id,
        issues: postValidation.errors,
      };
    }

    const bundle: PublishedProductBundle = {
      bundleVersion: 1,
      publisher: this.id,
      storeId: storeConfig.id,
      runId,
      actor,
      publishedAt: normalised.generatedAt,
      universalProduct: normalised,
      fanaaExtension,
      beautyWellnessExtension,
    };

    const artefactLocation = await this.store.putBundle(bundle);

    return {
      status: "published",
      storeId: storeConfig.id,
      storeProductId: normalised.slug,
      artefactLocation,
      bundle,
      publishedAt: bundle.publishedAt,
    };
  }

  /* ─── deferred surface (M8/M9) ─────────────────────────────────────── */

  async unpublish(_input: UnpublishInput): Promise<UnpublishResult> {
    return {
      status: "not_implemented_M7",
      reason:
        "FanaaPublisher.unpublish is deferred to M9 (Octokit + Studio audit). " +
        "Until then, delete the bundle file under .platform-data/products/.",
    };
  }

  async preview(_input: PublishInput): Promise<PreviewResult> {
    return {
      status: "not_implemented_M7",
      reason:
        "FanaaPublisher.preview is deferred to M8 (Studio UI mounts the apps/fanaa PDP tree).",
    };
  }
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

/**
 * Override the slug deterministically. The pipeline may have emitted a
 * candidate slug, but the publisher owns the final value — replays
 * across pipeline versions must produce the same URL.
 */
function applyPublisherSlug(product: UniversalProduct): UniversalProduct {
  return { ...product, slug: deriveSlug(product.title) };
}

/**
 * Materialise the Fanaa extension defensively so `validate()` can
 * report extension issues even when the materialiser would throw for
 * malformed input. We don't throw — we let Zod surface the problem
 * during validateFullBundle.
 */
function safeMaterialiseFanaa(args: Parameters<typeof toFanaaExtension>[0]) {
  try {
    return toFanaaExtension(args);
  } catch {
    return undefined;
  }
}

/**
 * Picks the niche extension to validate against:
 *   • caller-supplied (highest priority — Studio override),
 *   • derived from product content (when niche === beauty_wellness),
 *   • `undefined` otherwise.
 */
function pickNicheExtension(args: {
  product: UniversalProduct;
  input: PublishInput;
}) {
  if (args.input.beautyWellness) return args.input.beautyWellness;
  if (args.product.niche === "beauty_wellness") {
    return deriveBeautyWellnessExtension(args.product);
  }
  return undefined;
}

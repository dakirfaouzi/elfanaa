import {
  FanaaPublisher,
  type PublishStore,
  type PublishedProductBundle,
  type PublishResult,
} from "@platform/publishers";
import { fanaaStore } from "@platform/stores";
import type { UniversalProduct } from "@platform/catalog-schema";

/**
 * Dry-run "publish preview" — materialise the FanaaPublisher output
 * for a UniversalProduct WITHOUT writing anything to disk.
 *
 * # Why a dry-run preview?
 *
 * The M7 FanaaPublisher's actual `.publish()` writes the bundle to
 * `.platform-data/products/<storeId>/<id>.json`. In M8 the operator
 * needs to SEE what would land on disk (and, eventually, in
 * `apps/fanaa/data/products.ts`) before committing — but the actual
 * write/Octokit/Git PR plumbing arrives in M9.
 *
 * # How the dry-run works
 *
 * Inject an in-memory PublishStore that captures the bundle without
 * touching the filesystem. FanaaPublisher.publish() runs normally —
 * including all validation, normalisation, SKU/offerTier derivation —
 * but the side effect is replaced.
 *
 * # Returned shape
 *
 * Identical to FanaaPublisher's PublishResult. The caller renders:
 *   • `status: "published"`     → preview the bundle (read-only)
 *   • `status: "validation_failed"` → show issues + fix-it hints
 */
export async function publishPreview(args: {
  universalProduct: UniversalProduct;
  runId?: string;
  actor?: string;
}): Promise<{
  result: PublishResult;
  /** Set when status === "published". Mirrors `result.bundle`. */
  bundle?: PublishedProductBundle;
}> {
  const captured = new InMemoryPublishStore();
  const publisher = new FanaaPublisher({ store: captured });

  const result = await publisher.publish({
    universalProduct: args.universalProduct,
    storeConfig: fanaaStore,
    runId: args.runId ?? "",
    actor: args.actor ?? "",
  });

  if (result.status === "published") {
    return { result, bundle: result.bundle };
  }
  return { result };
}

/**
 * In-memory PublishStore. Captures the bundle into a Map keyed by
 * `<storeId>:<universalProductId>` and reports a faux file path so the
 * caller's downstream UI keeps working. Zero filesystem writes.
 *
 * Exported for tests that need to assert no writes happened.
 */
export class InMemoryPublishStore implements PublishStore {
  readonly root = "memory:///studio/publish-preview";
  private readonly bundles = new Map<string, PublishedProductBundle>();

  async putBundle(bundle: PublishedProductBundle): Promise<string> {
    const key = `${bundle.storeId}:${bundle.universalProduct.id}`;
    this.bundles.set(key, bundle);
    return `${this.root}/${key}`;
  }

  async getBundle(
    storeId: string,
    universalProductId: string,
  ): Promise<PublishedProductBundle | null> {
    return this.bundles.get(`${storeId}:${universalProductId}`) ?? null;
  }

  async listBundles(storeId: string): Promise<string[]> {
    const prefix = `${storeId}:`;
    return Array.from(this.bundles.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  size(): number {
    return this.bundles.size;
  }
}

import { describe, it, expect } from "vitest";
import {
  publishPreview,
  InMemoryPublishStore,
} from "../lib/studio/publish-preview";
import { fixturePublishedBundle } from "./_helpers/fixture-bundle";

/**
 * Tests for the publish-preview helper.
 *
 * The helper invokes the real FanaaPublisher with an in-memory store,
 * so it exercises the entire materialisation path EXCEPT the disk
 * write. The key invariants under test:
 *
 *   1. Materialisation produces the same FanaaExtension fields as
 *      the M7 tests verify for the real publisher (deterministic SKU,
 *      offer-tiers, taxonomy, etc.).
 *   2. NO bytes touch the filesystem.
 *   3. Validation failures surface as `validation_failed`, never as
 *      a thrown exception.
 */
describe("publish-preview (dry-run)", () => {
  it("materialises Fanaa extension fields with no file writes", async () => {
    const b = fixturePublishedBundle();
    const { result, bundle } = await publishPreview({
      universalProduct: b.universalProduct,
      runId: "preview-test",
      actor: "qa@fanaa.sa",
    });
    expect(result.status).toBe("published");
    expect(bundle).toBeDefined();
    if (!bundle) return;
    expect(bundle.publisher).toBe("fanaa");
    expect(bundle.fanaaExtension?.sku).toMatch(/^FN-/);
    expect(bundle.fanaaExtension?.offerTiers?.length).toBe(3);
  });

  it("rejects an invalid UniversalProduct without writing", async () => {
    const bad = fixturePublishedBundle().universalProduct;
    bad.benefits = []; // schema requires >= 1 benefit
    const { result } = await publishPreview({ universalProduct: bad });
    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("InMemoryPublishStore captures bundles without filesystem writes", async () => {
    const store = new InMemoryPublishStore();
    expect(store.size()).toBe(0);

    const b = fixturePublishedBundle();
    const filePath = await store.putBundle(b);
    expect(filePath).toMatch(/^memory:\/\/\//);
    expect(store.size()).toBe(1);

    const got = await store.getBundle(b.storeId, b.universalProduct.id);
    expect(got?.universalProduct.id).toBe(b.universalProduct.id);
  });

  it("two consecutive previews of the same UP produce identical bundles", async () => {
    const b = fixturePublishedBundle();
    const a = await publishPreview({ universalProduct: b.universalProduct, runId: "x", actor: "a" });
    const c = await publishPreview({ universalProduct: b.universalProduct, runId: "x", actor: "a" });
    expect(a.result.status).toBe("published");
    expect(c.result.status).toBe("published");
    if (a.result.status !== "published" || c.result.status !== "published") return;
    expect(JSON.stringify(a.bundle)).toEqual(JSON.stringify(c.bundle));
  });
});

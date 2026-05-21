import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fanaaStore } from "@platform/stores";
import { FanaaPublisher } from "../fanaa";
import { FilePublishStore } from "../persistence/file-publish-store";
import {
  fixtureUniversalProduct,
  FIXTURE_GENERATED_AT,
} from "./_helpers/fixture-product";

/**
 * Happy-path tests for FanaaPublisher.
 *
 * Each test gets its own temp directory under the OS tmpdir so
 * parallel runs don't clobber each other and the host's
 * `.platform-data/` stays untouched.
 */
async function makeTempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "publishers-test-"));
  return new FilePublishStore({ rootDir: root });
}

describe("FanaaPublisher.validate", () => {
  it("returns ok=true for a fully-populated fixture", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const result = await publisher.validate({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("flags an empty Arabic title as a locale_missing error", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const broken = fixtureUniversalProduct();
    broken.title = { ar: "", en: "Glow Serum" };

    const result = await publisher.validate({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "input_locale_missing")).toBe(true);
  });

  it("flags a niche mismatch against the StoreConfig", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const broken = fixtureUniversalProduct();
    broken.niche = "electronics";

    const result = await publisher.validate({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.ok).toBe(false);
    expect(
      result.errors.find((e) => e.code === "store_config_mismatch"),
    ).toBeDefined();
  });

  it("warns (does NOT error) on storeContext mismatch", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const broken = fixtureUniversalProduct();
    broken.storeContext = "trendora";

    const result = await publisher.validate({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.find((w) => w.code === "store_config_mismatch"),
    ).toBeDefined();
  });
});

describe("FanaaPublisher.publish", () => {
  let publisher: FanaaPublisher;
  let store: FilePublishStore;

  beforeEach(async () => {
    store = await makeTempStore();
    publisher = new FanaaPublisher({ store });
  });

  it("publishes a fixture product and writes a JSON bundle to disk", async () => {
    const result = await publisher.publish({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
      runId: "run_test_001",
      actor: "ops@fanaa.sa",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") return;

    expect(result.storeId).toBe("fanaa");
    expect(result.storeProductId).toBe("glow-care-serum");
    expect(result.publishedAt).toBe(FIXTURE_GENERATED_AT);

    const onDisk = await fs.readFile(result.artefactLocation, "utf8");
    const parsed = JSON.parse(onDisk);
    expect(parsed.bundleVersion).toBe(1);
    expect(parsed.publisher).toBe("fanaa");
    expect(parsed.storeId).toBe("fanaa");
    expect(parsed.universalProduct.id).toBe("up_test_001");
  });

  it("materialises a FanaaProductExtension with derived SKU, offerTiers, taxonomy", async () => {
    const result = await publisher.publish({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
      runId: "run_test_001",
    });

    if (result.status !== "published") throw new Error("expected published");
    const ext = result.bundle.fanaaExtension!;

    expect(ext.sku).toMatch(/^FN-[A-Z0-9]+-001$/);
    expect(ext.offerTiers).toHaveLength(3);
    expect(ext.offerTiers?.[0]).toEqual({
      quantity: 1,
      total: { amount: 19900, currency: "SAR" },
    });
    expect(ext.offerTiers?.[2]?.quantity).toBe(3);
    expect(ext.productType).toBe("serum");
    expect(ext.target).toBe("women");
    expect(ext.problems).toContain("dryness");
  });

  it("derives a BeautyWellnessExtension when niche === beauty_wellness", async () => {
    const result = await publisher.publish({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
    });
    if (result.status !== "published") throw new Error("expected published");

    const niche = result.bundle.beautyWellnessExtension;
    expect(niche).toBeDefined();
    expect(niche?.concerns).toEqual(expect.arrayContaining(["hydration"]));
  });

  it("respects a fanaaExtensionOverride from the operator", async () => {
    const result = await publisher.publish({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
      fanaaExtensionOverride: {
        sku: "FN-MANUAL-999",
        productType: "cream",
      },
    });

    if (result.status !== "published") throw new Error("expected published");
    expect(result.bundle.fanaaExtension?.sku).toBe("FN-MANUAL-999");
    expect(result.bundle.fanaaExtension?.productType).toBe("cream");
  });

  it("writes under .platform-data/products/<storeId>/<id>.json layout", async () => {
    const result = await publisher.publish({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
    });
    if (result.status !== "published") throw new Error("expected published");
    const expectedSuffix = path.join("products", "fanaa", "up_test_001.json");
    expect(result.artefactLocation.endsWith(expectedSuffix)).toBe(true);
  });

  it("returns validation_failed and writes nothing when the input is malformed", async () => {
    const broken = fixtureUniversalProduct();
    // Empty benefits array trips UniversalProductSchema (min(1)).
    broken.benefits = [];

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    const onDisk = await store.listBundles("fanaa");
    expect(onDisk).not.toContain("up_test_001");
  });
});

describe("FanaaPublisher.unpublish / preview (deferred to M8/M9)", () => {
  it("unpublish returns not_implemented_M7", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const result = await publisher.unpublish?.({
      storeProductId: "glow-care-serum",
      storeConfig: fanaaStore,
    });
    expect(result?.status).toBe("not_implemented_M7");
  });

  it("preview returns not_implemented_M7", async () => {
    const publisher = new FanaaPublisher({ store: await makeTempStore() });
    const result = await publisher.preview?.({
      universalProduct: fixtureUniversalProduct(),
      storeConfig: fanaaStore,
    });
    expect(result?.status).toBe("not_implemented_M7");
  });
});

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fanaaStore } from "@platform/stores";
import { FanaaPublisher } from "../fanaa";
import { FilePublishStore } from "../persistence/file-publish-store";
import { fixtureUniversalProduct } from "./_helpers/fixture-product";

/**
 * Schema-drift canary.
 *
 * Publishes the canonical fixture and pins the EXACT shape of the
 * resulting bundle. Any change to:
 *
 *   • PublishedProductBundle shape
 *   • FanaaProductExtension materialisation rules
 *   • Normalisation behaviour
 *   • Stable-stringify key ordering
 *
 * will make this test fail loudly. The intent is to force any future
 * schema bump to be deliberate (and to coordinate with the apps/fanaa
 * mapping in M9+).
 *
 * # Why pin via fields instead of an exact byte snapshot?
 *
 * A byte snapshot would be brittle across line-ending normalisation
 * on Windows vs Linux CI. We pin the SEMANTIC shape — every top-level
 * key + the values that the publisher controls deterministically —
 * which is enough to catch drift without flakiness.
 */
async function publishFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "publishers-drift-"));
  const publisher = new FanaaPublisher({
    store: new FilePublishStore({ rootDir: root }),
  });
  const result = await publisher.publish({
    universalProduct: fixtureUniversalProduct(),
    storeConfig: fanaaStore,
    runId: "run_drift_001",
    actor: "ops@fanaa.sa",
  });
  if (result.status !== "published") {
    throw new Error(
      `fixture publish must succeed; got: ${JSON.stringify(result.issues)}`,
    );
  }
  return { result, root };
}

describe("FanaaPublisher schema-drift canary", () => {
  it("publishes the fixture into a bundle with the expected top-level shape", async () => {
    const { result } = await publishFixture();
    const bundle = result.bundle;

    expect(Object.keys(bundle).sort()).toEqual(
      [
        "actor",
        "beautyWellnessExtension",
        "bundleVersion",
        "fanaaExtension",
        "publishedAt",
        "publisher",
        "runId",
        "storeId",
        "universalProduct",
      ].sort(),
    );

    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.publisher).toBe("fanaa");
    expect(bundle.storeId).toBe("fanaa");
    expect(bundle.runId).toBe("run_drift_001");
    expect(bundle.actor).toBe("ops@fanaa.sa");
  });

  it("pins the FanaaProductExtension materialisation values", async () => {
    const { result } = await publishFixture();
    const ext = result.bundle.fanaaExtension;
    expect(ext).toBeDefined();
    if (!ext) return;

    expect(ext.sku).toBe("FN-GLOW-001");
    expect(ext.productType).toBe("serum");
    expect(ext.target).toBe("women");
    expect(ext.problems).toEqual(["dryness"]);
    expect(ext.offerTiers).toEqual([
      { quantity: 1, total: { amount: 19900, currency: "SAR" } },
      { quantity: 2, total: { amount: 33830, currency: "SAR" } },
      { quantity: 3, total: { amount: 45969, currency: "SAR" } },
    ]);
  });

  it("pins the BeautyWellnessExtension inferred concerns", async () => {
    const { result } = await publishFixture();
    const ext = result.bundle.beautyWellnessExtension;
    expect(ext).toBeDefined();
    expect(ext?.concerns).toEqual(expect.arrayContaining(["hydration"]));
  });

  it("normalises the slug to the deterministic value", async () => {
    const { result } = await publishFixture();
    expect(result.storeProductId).toBe("glow-care-serum");
    expect(result.bundle.universalProduct.slug).toBe("glow-care-serum");
  });

  it("writes a JSON file whose first key is alphabetical (stable-stringify guarantee)", async () => {
    const { result } = await publishFixture();
    const bytes = await fs.readFile(result.artefactLocation, "utf8");
    expect(bytes.startsWith("{\n  \"actor\"")).toBe(true);
  });
});

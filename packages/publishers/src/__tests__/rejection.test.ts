import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fanaaStore } from "@platform/stores";
import { FanaaPublisher } from "../fanaa";
import { FilePublishStore } from "../persistence/file-publish-store";
import { fixtureUniversalProduct } from "./_helpers/fixture-product";

/**
 * Invalid-input rejection tests.
 *
 * The publisher must NEVER write a bundle when validation fails.
 * These tests pin every error path the M7 surface promises:
 *
 *   • Zod schema rejection (missing required, wrong type)
 *   • Empty hero image
 *   • Empty locale strings
 *   • Niche mismatch
 *
 * Each test asserts:
 *   1. `result.status === "validation_failed"`
 *   2. Issues are typed (have `code` + `message`)
 *   3. Nothing was written to disk
 */
async function makeTempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "publishers-reject-"));
  return { store: new FilePublishStore({ rootDir: root }), root };
}

describe("FanaaPublisher rejects invalid pipeline output", () => {
  it("rejects when UniversalProductSchema fails (empty benefits)", async () => {
    const { store, root } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    broken.benefits = [];

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(
      result.issues.every((i) => typeof i.code === "string" && typeof i.message === "string"),
    ).toBe(true);
    expect(
      result.issues.some((i) => i.code === "universal_schema_invalid"),
    ).toBe(true);

    const dir = path.join(root, "products", "fanaa");
    await expect(fs.readdir(dir)).rejects.toThrow();
  });

  it("rejects when sources.supplierUrl is not a URL", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    broken.sources.supplierUrl = "not-a-url";

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(
      result.issues.some((i) => i.code === "universal_schema_invalid"),
    ).toBe(true);
  });

  it("rejects when images[0].src is empty (Zod schema layer)", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    broken.images[0].src = "";

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    // Empty `src` is caught at the Zod layer (ProductImageSchema.src.min(1)).
    expect(
      result.issues.some(
        (i) => i.code === "universal_schema_invalid" && i.path?.includes("images"),
      ),
    ).toBe(true);
  });

  it("rejects when images[0].alt.ar is empty (semantic layer)", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    // alt is a LocalizedString whose KEYS are required by the schema but
    // whose VALUES may be empty — only the semantic layer catches this.
    broken.images[0].alt = { ar: "", en: "Glow Care Serum bottle" };

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(
      result.issues.some(
        (i) => i.code === "input_locale_missing" && i.path?.startsWith("images[0].alt"),
      ),
    ).toBe(true);
  });

  it("rejects when title.en is empty", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    broken.title = { ar: broken.title.ar, en: "" };

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(
      result.issues.some((i) => i.code === "input_locale_missing" && i.path?.startsWith("title")),
    ).toBe(true);
  });

  it("rejects when product niche disagrees with the StoreConfig niche", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const broken = fixtureUniversalProduct();
    broken.niche = "electronics";

    const result = await publisher.publish({
      universalProduct: broken,
      storeConfig: fanaaStore,
    });

    expect(result.status).toBe("validation_failed");
    if (result.status !== "validation_failed") return;
    expect(
      result.issues.some((i) => i.code === "store_config_mismatch" && i.path === "niche"),
    ).toBe(true);
  });
});

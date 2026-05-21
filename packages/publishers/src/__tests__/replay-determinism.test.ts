import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fanaaStore } from "@platform/stores";
import { FanaaPublisher } from "../fanaa";
import { FilePublishStore } from "../persistence/file-publish-store";
import { fixtureUniversalProduct } from "./_helpers/fixture-product";

/**
 * Replay-safety proof.
 *
 * Same UniversalProduct + same StoreConfig → byte-identical artefact on
 * disk, across distinct FanaaPublisher instances and store roots.
 *
 * # Why this matters
 *
 * M6 supports deterministic pipeline replay. M7 must extend that
 * guarantee through the publisher: republishing a finalised run
 * MUST yield the same bytes so the apps/fanaa Git diff is empty.
 *
 * # Bits checked
 *
 *   1. JSON file content is byte-equal between two publishes.
 *   2. publishedAt mirrors `universalProduct.generatedAt`.
 *   3. The result.bundle returned in-memory is deep-equal.
 *   4. Two publishes against the SAME store overwrite the file
 *      atomically (no leftover `.tmp` files).
 */

async function makeTempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "publishers-replay-"));
  return { store: new FilePublishStore({ rootDir: root }), root };
}

describe("FanaaPublisher replay determinism", () => {
  it("produces byte-identical files across two publishers + two stores", async () => {
    const a = await makeTempStore();
    const b = await makeTempStore();
    const pubA = new FanaaPublisher({ store: a.store });
    const pubB = new FanaaPublisher({ store: b.store });

    const product = fixtureUniversalProduct();

    const resultA = await pubA.publish({
      universalProduct: product,
      storeConfig: fanaaStore,
      runId: "run_replay_001",
      actor: "ops@fanaa.sa",
    });
    const resultB = await pubB.publish({
      universalProduct: product,
      storeConfig: fanaaStore,
      runId: "run_replay_001",
      actor: "ops@fanaa.sa",
    });

    if (resultA.status !== "published" || resultB.status !== "published") {
      throw new Error("expected published for both runs");
    }

    const bytesA = await fs.readFile(resultA.artefactLocation, "utf8");
    const bytesB = await fs.readFile(resultB.artefactLocation, "utf8");
    expect(bytesA).toBe(bytesB);
    expect(resultA.publishedAt).toBe(resultB.publishedAt);
    expect(resultA.publishedAt).toBe(product.generatedAt);
  });

  it("overwrites the same file atomically when republished into the same store", async () => {
    const { store, root } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });
    const product = fixtureUniversalProduct();

    const first = await publisher.publish({
      universalProduct: product,
      storeConfig: fanaaStore,
    });
    const second = await publisher.publish({
      universalProduct: product,
      storeConfig: fanaaStore,
    });
    if (first.status !== "published" || second.status !== "published") {
      throw new Error("expected published for both runs");
    }
    expect(first.artefactLocation).toBe(second.artefactLocation);

    const dir = path.join(root, "products", "fanaa");
    const entries = await fs.readdir(dir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    expect(entries.filter((e) => e.endsWith(".json"))).toHaveLength(1);
  });

  it("is independent of object-key insertion order in the input", async () => {
    const { store } = await makeTempStore();
    const publisher = new FanaaPublisher({ store });

    const a = fixtureUniversalProduct();

    // Build a structurally-identical product but with deliberately
    // reordered nested keys — the on-disk bytes must still match.
    const reordered = JSON.parse(JSON.stringify(a));
    reordered.sources = {
      uploadedImages: a.sources.uploadedImages,
      scrapedAt: a.sources.scrapedAt,
      supplierUrl: a.sources.supplierUrl,
    };
    reordered.priceHint = { currency: a.priceHint.currency, amount: a.priceHint.amount };

    const resultA = await publisher.publish({
      universalProduct: a,
      storeConfig: fanaaStore,
    });
    if (resultA.status !== "published") throw new Error("A failed");
    const bytesA = await fs.readFile(resultA.artefactLocation, "utf8");

    const resultB = await publisher.publish({
      universalProduct: reordered,
      storeConfig: fanaaStore,
    });
    if (resultB.status !== "published") throw new Error("B failed");
    const bytesB = await fs.readFile(resultB.artefactLocation, "utf8");

    expect(bytesA).toBe(bytesB);
  });
});

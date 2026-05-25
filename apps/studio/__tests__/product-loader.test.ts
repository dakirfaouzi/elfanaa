import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  extractHeroImage,
  listProducts,
  listPublishedStores,
  readProduct,
} from "../lib/studio/product-loader";
import {
  makeTempPlatformData,
  fixturePublishedBundle,
  writeFixtureBundle,
  pointPlatformDataRoot,
  restorePlatformDataRoot,
  type TempPlatformData,
} from "./_helpers/fixture-bundle";

/**
 * Tests for the product loader.
 *
 * # Coverage
 *
 *   1. Empty-state behaviour (no `.platform-data/` directory).
 *   2. Happy-path read of one bundle.
 *   3. listProducts ordering (newest first).
 *   4. listPublishedStores enumeration.
 *   5. Corrupted file: invalid JSON.
 *   6. Corrupted file: valid JSON but failing schema.
 *   7. Not-found returns the typed result, no throw.
 *
 * Every test gets its own temp `.platform-data/` directory via the
 * fixture helper.
 */
describe("product-loader", () => {
  let temp: TempPlatformData;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    temp = await makeTempPlatformData();
    prevEnv = pointPlatformDataRoot(temp.root);
  });

  afterEach(async () => {
    restorePlatformDataRoot(prevEnv);
    await temp.cleanup();
  });

  describe("listPublishedStores", () => {
    it("returns [] when .platform-data/products/ does not exist", async () => {
      // We're using a fresh temp; the helper made the dirs but we
      // delete `products/` here so the loader sees ENOENT explicitly.
      await fs.rm(temp.productsRoot, { recursive: true, force: true });
      const stores = await listPublishedStores();
      expect(stores).toEqual([]);
    });

    it("lists every immediate subdirectory under products/", async () => {
      await fs.mkdir(path.join(temp.productsRoot, "fanaa"), { recursive: true });
      await fs.mkdir(path.join(temp.productsRoot, "trendora"), { recursive: true });
      const stores = await listPublishedStores();
      expect(stores).toEqual(["fanaa", "trendora"]);
    });
  });

  describe("readProduct", () => {
    it("returns ok + bundle for a valid file", async () => {
      const bundle = fixturePublishedBundle();
      await writeFixtureBundle(temp, bundle);
      const result = await readProduct("fanaa", bundle.universalProduct.id);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.bundle.universalProduct.id).toBe("up_test_001");
      expect(result.bundle.fanaaExtension?.sku).toBe("FN-GLOW-001");
    });

    it("returns not_found when the file is missing", async () => {
      const result = await readProduct("fanaa", "does-not-exist");
      expect(result.status).toBe("not_found");
    });

    it("returns corrupted with invalid_json when JSON.parse fails", async () => {
      const dir = path.join(temp.productsRoot, "fanaa");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "broken.json"), "{not json", "utf8");
      const result = await readProduct("fanaa", "broken");
      expect(result.status).toBe("corrupted");
      if (result.status !== "corrupted") return;
      expect(result.reason).toBe("invalid_json");
    });

    it("returns corrupted with schema_mismatch when fields are missing", async () => {
      const dir = path.join(temp.productsRoot, "fanaa");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, "drifted.json"),
        JSON.stringify({ bundleVersion: 1, publisher: "fanaa" }, null, 2),
        "utf8",
      );
      const result = await readProduct("fanaa", "drifted");
      expect(result.status).toBe("corrupted");
      if (result.status !== "corrupted") return;
      expect(result.reason).toBe("schema_mismatch");
      expect(typeof result.details).toBe("string");
    });

    it("returns corrupted with schema_mismatch when bundleVersion drifts", async () => {
      const dir = path.join(temp.productsRoot, "fanaa");
      await fs.mkdir(dir, { recursive: true });
      const bundle = fixturePublishedBundle();
      const drifted = { ...bundle, bundleVersion: 99 };
      await fs.writeFile(
        path.join(dir, `${bundle.universalProduct.id}.json`),
        JSON.stringify(drifted, null, 2),
        "utf8",
      );
      const result = await readProduct("fanaa", bundle.universalProduct.id);
      expect(result.status).toBe("corrupted");
      if (result.status !== "corrupted") return;
      expect(result.reason).toBe("schema_mismatch");
    });
  });

  describe("listProducts", () => {
    it("returns [] when the store directory does not exist", async () => {
      const list = await listProducts("nonexistent");
      expect(list).toEqual([]);
    });

    it("sorts most-recently-published first", async () => {
      const a = fixturePublishedBundle();
      a.universalProduct.id = "up_test_001";
      a.publishedAt = "2026-01-15T10:00:00.000Z";

      const b = fixturePublishedBundle();
      b.universalProduct.id = "up_test_002";
      b.universalProduct.generatedAt = "2026-02-20T10:00:00.000Z";
      b.publishedAt = "2026-02-20T10:00:00.000Z";

      await writeFixtureBundle(temp, a);
      await writeFixtureBundle(temp, b);

      const list = await listProducts("fanaa");
      expect(list.map((p) => p.productId)).toEqual(["up_test_002", "up_test_001"]);
    });

    it("includes corrupted files with a corrupted marker", async () => {
      const ok = fixturePublishedBundle();
      await writeFixtureBundle(temp, ok);

      const dir = path.join(temp.productsRoot, "fanaa");
      await fs.writeFile(path.join(dir, "broken.json"), "not json", "utf8");

      const list = await listProducts("fanaa");
      const corrupted = list.find((p) => p.productId === "broken");
      expect(corrupted).toBeDefined();
      expect(corrupted?.corrupted?.reason).toBe("invalid_json");
    });

    // C3 — products-list card needs a thumbnail-ready snapshot of the
    // first bundle image. The summary must carry the original `src`
    // alongside the resolved URL, bilingual alt, and a placeholder
    // flag so the card can render the existing PreviewImage component
    // straight from the list without re-reading the full bundle.
    it("populates heroImage from the first bundle image on listProducts", async () => {
      const bundle = fixturePublishedBundle();
      await writeFixtureBundle(temp, bundle);

      const list = await listProducts("fanaa");
      const summary = list.find(
        (p) => p.productId === bundle.universalProduct.id,
      );
      expect(summary).toBeDefined();
      expect(summary?.heroImage).toBeTruthy();
      expect(summary?.heroImage?.src).toBe(
        "stores/fanaa/products/up_test_001/hero.webp",
      );
      expect(summary?.heroImage?.alt.en).toBe("Glow Care Serum bottle");
      expect(typeof summary?.heroImage?.placeholder).toBe("boolean");
      expect(typeof summary?.heroImage?.resolvedSrc).toBe("string");
    });

    it("sets heroImage to null on corrupted bundles", async () => {
      const dir = path.join(temp.productsRoot, "fanaa");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "broken.json"), "not json", "utf8");

      const list = await listProducts("fanaa");
      const corrupted = list.find((p) => p.productId === "broken");
      expect(corrupted).toBeDefined();
      expect(corrupted?.heroImage).toBeNull();
    });
  });

  describe("extractHeroImage", () => {
    it("returns null when images is undefined", () => {
      expect(extractHeroImage(undefined)).toBeNull();
    });

    it("returns null when images is empty", () => {
      expect(extractHeroImage([])).toBeNull();
    });

    it("returns the first image with src, alt, and a placeholder flag", () => {
      const prevCdn = process.env.STUDIO_ASSETS_CDN_BASE;
      delete process.env.STUDIO_ASSETS_CDN_BASE;
      try {
        const hero = extractHeroImage([
          {
            src: "stores/fanaa/p/a.webp",
            alt: { ar: "أ", en: "A" },
            width: 1200,
            height: 1500,
          },
          {
            src: "stores/fanaa/p/b.webp",
            alt: { ar: "ب", en: "B" },
            width: 1200,
            height: 1500,
          },
        ]);
        expect(hero).not.toBeNull();
        expect(hero!.src).toBe("stores/fanaa/p/a.webp");
        expect(hero!.alt.en).toBe("A");
        // No CDN → resolveImageUrl() returns a placeholder:// token.
        expect(hero!.placeholder).toBe(true);
        expect(hero!.resolvedSrc.startsWith("placeholder://")).toBe(true);
      } finally {
        if (prevCdn === undefined) {
          delete process.env.STUDIO_ASSETS_CDN_BASE;
        } else {
          process.env.STUDIO_ASSETS_CDN_BASE = prevCdn;
        }
      }
    });

    it("uses the CDN base when configured (placeholder=false)", () => {
      const prevCdn = process.env.STUDIO_ASSETS_CDN_BASE;
      process.env.STUDIO_ASSETS_CDN_BASE = "https://cdn.example.com";
      try {
        const hero = extractHeroImage([
          {
            src: "stores/fanaa/p/a.webp",
            alt: { ar: "أ", en: "A" },
            width: 1200,
            height: 1500,
          },
        ]);
        expect(hero!.placeholder).toBe(false);
        expect(hero!.resolvedSrc).toBe(
          "https://cdn.example.com/stores/fanaa/p/a.webp",
        );
      } finally {
        if (prevCdn === undefined) {
          delete process.env.STUDIO_ASSETS_CDN_BASE;
        } else {
          process.env.STUDIO_ASSETS_CDN_BASE = prevCdn;
        }
      }
    });
  });
});

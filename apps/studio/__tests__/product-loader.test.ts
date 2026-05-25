import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  extractHeroImage,
  listProducts,
  listPublishedStores,
  mapPublishedToSummary,
  readProduct,
} from "../lib/studio/product-loader";
import type { PublishedListItem } from "../lib/studio/drafts-service";
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
    // C3.1 — listPublishedStores now UNIONS FS dirs with the
    // `@platform/stores` registry's `live` stores. The registry
    // shipped today contains only "fanaa". When the FS root is
    // missing entirely the registry still contributes "fanaa" so
    // the catalog enumerates the store even before its first
    // FS-backed publish.
    it("returns the registry's live stores when no FS root exists", async () => {
      await fs.rm(temp.productsRoot, { recursive: true, force: true });
      const stores = await listPublishedStores();
      expect(stores).toContain("fanaa");
    });

    it("unions FS subdirectories with the registry live stores", async () => {
      await fs.mkdir(path.join(temp.productsRoot, "fanaa"), { recursive: true });
      await fs.mkdir(path.join(temp.productsRoot, "trendora"), {
        recursive: true,
      });
      const stores = await listPublishedStores();
      // Sorted, deduped union.
      expect(stores).toEqual(["fanaa", "trendora"]);
    });

    it("dedupes when a registry store is also present on disk", async () => {
      await fs.mkdir(path.join(temp.productsRoot, "fanaa"), { recursive: true });
      const stores = await listPublishedStores();
      // No duplicate "fanaa".
      expect(stores.filter((s) => s === "fanaa")).toHaveLength(1);
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

    it("returns the first image with src, alt, and a fetchable resolved URL", () => {
      // C3.1 follow-up: resolveAssetUrl always returns a fetchable URL
      // (the asset proxy is the universal fallback), so the placeholder
      // flag is only true for empty inputs.
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
      expect(hero!.placeholder).toBe(false);
      // R2 key → asset-proxy URL (basePath-aware).
      expect(hero!.resolvedSrc).toMatch(
        /\/api\/studio\/media\/stores\/fanaa\/p\/a\.webp$/,
      );
    });

    it("passes absolute URLs through unchanged", () => {
      const hero = extractHeroImage([
        {
          src: "https://cdn.example.com/stores/fanaa/p/a.webp",
          alt: { ar: "أ", en: "A" },
          width: 1200,
          height: 1500,
        },
      ]);
      expect(hero!.placeholder).toBe(false);
      expect(hero!.resolvedSrc).toBe(
        "https://cdn.example.com/stores/fanaa/p/a.webp",
      );
    });
  });

  /*
   * C3.1 — `mapPublishedToSummary` is the adapter that turns a
   * DB-backed published row + parsed DraftDocument into the
   * `ProductSummary` shape the products card consumes.
   *
   * The function is pure, so we test it directly without any DB
   * plumbing.
   */
  describe("mapPublishedToSummary", () => {
    function makeItem(over: Partial<PublishedListItem> = {}): PublishedListItem {
      const baseRow = {
        id: "pp_abc",
        draftId: "draft_xyz",
        storeId: "fanaa",
        slug: "glow-care-serum",
        version: 1,
        isCurrent: true,
        document: { version: 1, meta: {}, sections: [] },
        publishedBy: "studio_ui",
        publishedAt: new Date("2026-05-25T10:00:00Z"),
      };
      const baseDocument = {
        version: 1 as const,
        meta: {
          title: { ar: "سيروم", en: "Glow serum" },
          slug: "glow-care-serum",
          keywords: [] as string[],
        },
        sections: [],
      };
      return {
        row: { ...baseRow, ...(over.row ?? {}) },
        document: over.document === undefined ? baseDocument : over.document,
        documentInvalid: over.documentInvalid ?? false,
      };
    }

    it("stamps source='db' and uses the row id as productId", () => {
      const summary = mapPublishedToSummary(makeItem(), "beauty_wellness");
      expect(summary.source).toBe("db");
      // The card click destination has to be derivable from
      // productId in legacy contexts, but for DB rows we link by
      // slug instead — productId still carries the row id so the
      // UI can show it for forensics.
      expect(summary.productId).toBe("pp_abc");
      expect(summary.storeId).toBe("fanaa");
      expect(summary.slug).toBe("glow-care-serum");
      expect(summary.niche).toBe("beauty_wellness");
    });

    it("extracts the bilingual title from document.meta.title", () => {
      const summary = mapPublishedToSummary(makeItem(), "beauty_wellness");
      expect(summary.title.en).toBe("Glow serum");
      expect(summary.title.ar).toBe("سيروم");
    });

    it("publishedAt is serialised as an ISO-8601 string", () => {
      const summary = mapPublishedToSummary(makeItem(), "beauty_wellness");
      expect(summary.publishedAt).toBe("2026-05-25T10:00:00.000Z");
    });

    it("returns a corrupted card when documentInvalid is true", () => {
      const summary = mapPublishedToSummary(
        makeItem({ document: null, documentInvalid: true }),
        "beauty_wellness",
      );
      expect(summary.corrupted?.reason).toBe("document_schema_invalid");
      expect(summary.heroImage).toBeNull();
      expect(summary.title.en).toBe(summary.slug);
    });

    it("falls back to a 'no image' result when the document has no media", () => {
      const summary = mapPublishedToSummary(makeItem(), "beauty_wellness");
      expect(summary.heroImage).toBeNull();
    });

    it("picks meta.ogImage as the hero thumbnail when present", () => {
      const summary = mapPublishedToSummary(
        makeItem({
          document: {
            version: 1 as const,
            meta: {
              title: { en: "X" },
              slug: "x",
              ogImage: "stores/fanaa/p/x-og.webp",
              keywords: [],
            },
            sections: [],
          },
        }),
        "beauty_wellness",
      );
      // C3.1 follow-up: ogImage now flows through the asset proxy so
      // the card actually renders a thumbnail.
      expect(summary.heroImage?.src).toBe("stores/fanaa/p/x-og.webp");
      expect(summary.heroImage?.placeholder).toBe(false);
      expect(summary.heroImage?.resolvedSrc).toMatch(
        /\/api\/studio\/media\/stores\/fanaa\/p\/x-og\.webp$/,
      );
    });

    it("falls back to the first hero section's desktop media", () => {
      const summary = mapPublishedToSummary(
        makeItem({
          document: {
            version: 1 as const,
            meta: {
              title: { en: "X" },
              slug: "x",
              keywords: [],
            },
            sections: [
              {
                id: "sec_1",
                kind: "hero",
                enabled: true,
                title: { en: "Hero" },
                media: {
                  kind: "image",
                  desktopSrc: "stores/fanaa/p/hero.webp",
                  alt: "",
                },
                align: "center",
              },
            ],
          },
        }),
        "beauty_wellness",
      );
      expect(summary.heroImage?.src).toBe("stores/fanaa/p/hero.webp");
    });

    it("falls back to the first gallery item when no hero media exists", () => {
      const summary = mapPublishedToSummary(
        makeItem({
          document: {
            version: 1 as const,
            meta: { title: { en: "X" }, slug: "x", keywords: [] },
            sections: [
              {
                id: "sec_g",
                kind: "image_gallery",
                enabled: true,
                items: [
                  {
                    kind: "image",
                    desktopSrc: "stores/fanaa/p/g1.webp",
                    alt: "",
                  },
                ],
                columns: 3,
              },
            ],
          },
        }),
        "beauty_wellness",
      );
      expect(summary.heroImage?.src).toBe("stores/fanaa/p/g1.webp");
    });
  });
});

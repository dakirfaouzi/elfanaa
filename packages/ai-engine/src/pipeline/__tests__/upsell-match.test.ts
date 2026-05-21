import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { upsellMatch } from "../upsell-match";
import type { CopyOutput } from "../types-copy";
import type { StrategyOutput } from "../types-strategy";
import type {
  UpsellMatchCatalogPort,
} from "../types-upsell-match";
import {
  mockEmbedding,
} from "./_helpers/mock-providers";

const dummyStrategy: StrategyOutput = {
  heroPromise: { ar: "إشراق.", en: "Glow." },
  persona: { ar: "ا", en: "a" },
  benefitAngles: [
    { label: "tone", title: { ar: "ا", en: "Tone" }, body: { ar: "ا", en: "x" } },
    { label: "hydration", title: { ar: "ا", en: "Hydration" }, body: { ar: "ا", en: "x" } },
    { label: "glow", title: { ar: "ا", en: "Glow" }, body: { ar: "ا", en: "x" } },
  ],
  objections: [
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
    { objection: { ar: "ا", en: "o" }, neutraliser: { ar: "ا", en: "n" } },
  ],
  adAngles: ["a", "b", "c"],
};

const dummyCopy: CopyOutput = {
  title: { ar: "سيروم", en: "Glow Serum" },
  headline: { ar: "إشراق يومي.", en: "Daily glow." },
  description: { ar: "وصف.", en: "Description." },
  benefits: [
    {
      icon: "Sparkles",
      title: { ar: "ا", en: "x" },
      body: { ar: "ا", en: "x" },
    },
  ],
};

function catalogWithVectorHits(ids: string[]): UpsellMatchCatalogPort {
  return {
    async searchByEmbedding({ limit }) {
      return ids.slice(0, limit).map((id, i) => ({ id, score: 1 - i * 0.05 }));
    },
    async topBestSellers({ limit }) {
      return ["bestseller_a", "bestseller_b", "bestseller_c"]
        .slice(0, limit)
        .map((id) => ({ id }));
    },
  };
}

function catalogVectorEmpty(bestsellers: string[]): UpsellMatchCatalogPort {
  return {
    async searchByEmbedding() {
      return [];
    },
    async topBestSellers({ limit }) {
      return bestsellers.slice(0, limit).map((id) => ({ id }));
    },
  };
}

describe("upsell-match (stage 11)", () => {
  it("returns vector matches when an embedding provider is supplied", async () => {
    const emb = mockEmbedding({
      responses: [new Array(1536).fill(0.01)],
    });

    const out = await upsellMatch({
      input: {
        strategy: dummyStrategy,
        copy: dummyCopy,
        catalog: catalogWithVectorHits(["up_a", "up_b", "up_c", "up_d"]),
      },
      providers: { embedding: emb.provider },
      storeConfig: fanaaStore,
      runId: "run_test_upsell_1",
    });

    expect(out.source).toBe("vector");
    expect(out.suggestedProductIds).toEqual(["up_a", "up_b", "up_c", "up_d"]);
    expect(emb.calls).toHaveLength(1);
  });

  it("falls back to best-sellers when no embedding provider is configured", async () => {
    const out = await upsellMatch({
      input: {
        strategy: dummyStrategy,
        copy: dummyCopy,
        catalog: catalogWithVectorHits(["should_not_appear"]),
      },
      providers: {},
      storeConfig: fanaaStore,
      runId: "run_test_upsell_2",
    });

    expect(out.source).toBe("best_sellers");
    expect(out.suggestedProductIds[0]).toBe("bestseller_a");
  });

  it("falls back to best-sellers when vector search returns empty", async () => {
    const emb = mockEmbedding({
      responses: [new Array(1536).fill(0)],
    });

    const out = await upsellMatch({
      input: {
        strategy: dummyStrategy,
        copy: dummyCopy,
        catalog: catalogVectorEmpty(["bs_x", "bs_y"]),
      },
      providers: { embedding: emb.provider },
      storeConfig: fanaaStore,
      runId: "run_test_upsell_3",
    });

    expect(out.source).toBe("best_sellers");
    expect(out.suggestedProductIds).toEqual(["bs_x", "bs_y"]);
  });

  it("returns source=empty when catalog has zero best-sellers", async () => {
    const out = await upsellMatch({
      input: {
        strategy: dummyStrategy,
        copy: dummyCopy,
        catalog: catalogVectorEmpty([]),
      },
      providers: {},
      storeConfig: fanaaStore,
      runId: "run_test_upsell_4",
    });

    expect(out.source).toBe("empty");
    expect(out.suggestedProductIds).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { research } from "../research";
import {
  mockScraper,
  scrapeResult,
} from "./_helpers/mock-providers";

describe("research (stage 02)", () => {
  it("returns a valid output when the scraper succeeds", async () => {
    const scraper = mockScraper({
      responses: [
        scrapeResult({
          url: "https://supplier.example/product/123",
          title: "Test product",
          markdown: "# Test\n\nSome markdown.",
        }),
      ],
    });

    const out = await research({
      input: { supplierUrl: "https://supplier.example/product/123" },
      providers: { scraper: scraper.provider },
      storeConfig: fanaaStore,
      runId: "run_test_research_1",
    });

    expect(out.skipped).toBe(false);
    expect(out.title).toBe("Test product");
    expect(out.markdown).toContain("Some markdown");
    expect(out.supplierUrl).toBe("https://supplier.example/product/123");
    expect(scraper.calls).toHaveLength(1);
    expect(scraper.calls[0].url).toBe(
      "https://supplier.example/product/123",
    );
  });

  it("respects operator opt-out (skip=true) without calling the scraper", async () => {
    const scraper = mockScraper();

    const out = await research({
      input: { supplierUrl: "https://x", skip: true },
      providers: { scraper: scraper.provider },
      storeConfig: fanaaStore,
      runId: "run_test_research_2",
    });

    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("operator_opt_out");
    expect(scraper.calls).toHaveLength(0);
  });

  it("returns skipped=true (does NOT throw) when the scraper fails", async () => {
    const scraper = mockScraper({
      responses: [new Error("network down")],
    });

    const out = await research({
      input: { supplierUrl: "https://supplier.example/product/123" },
      providers: { scraper: scraper.provider },
      storeConfig: fanaaStore,
      runId: "run_test_research_3",
    });

    expect(out.skipped).toBe(true);
    expect(out.skipReason).toContain("scrape_failed");
    expect(out.skipReason).toContain("network down");
  });

  it("forwards markdown + images + links from the scraper into its output", async () => {
    const scraper = mockScraper({
      responses: [
        scrapeResult({
          markdown: "## hello",
          images: [
            {
              src: "https://supplier.example/img1.jpg",
              alt: "front",
              width: 800,
              height: 800,
            },
          ],
          links: ["https://supplier.example/related"],
        }),
      ],
    });

    const out = await research({
      input: { supplierUrl: "https://supplier.example/product/123" },
      providers: { scraper: scraper.provider },
      storeConfig: fanaaStore,
      runId: "run_test_research_4",
    });

    expect(out.markdown).toBe("## hello");
    expect(out.images).toHaveLength(1);
    expect(out.images?.[0]?.src).toBe("https://supplier.example/img1.jpg");
    expect(out.links).toEqual(["https://supplier.example/related"]);
  });
});

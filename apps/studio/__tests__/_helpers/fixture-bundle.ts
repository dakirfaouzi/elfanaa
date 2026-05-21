import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { UniversalProduct } from "@platform/catalog-schema";
import type { PublishedProductBundle } from "@platform/publishers";
import type { RunRecord } from "@platform/ingest";

/**
 * Canned test fixtures for the Studio M8 test suite.
 *
 * Goals:
 *   • Mirror the shape that the M7 FanaaPublisher actually writes
 *     (validated by the M7 tests, copied verbatim here).
 *   • Provide helpers to spin up a temp `.platform-data/` tree so each
 *     test runs in isolation.
 *
 * Drift between this fixture and the real publisher output is the
 * single most likely source of false-positive Studio test failures.
 * Whenever the publisher's bundle shape changes, refresh this file
 * by re-running the M7 publisher CLI against a known UP and copying
 * the result over.
 */

export interface TempPlatformData {
  root: string;
  productsRoot: string;
  runsRoot: string;
  /** Cleanup helper — best-effort delete; tests can ignore errors. */
  cleanup(): Promise<void>;
}

export async function makeTempPlatformData(): Promise<TempPlatformData> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-test-"));
  const productsRoot = path.join(root, "products");
  const runsRoot = path.join(root, "runs");
  await fs.mkdir(productsRoot, { recursive: true });
  await fs.mkdir(runsRoot, { recursive: true });
  return {
    root,
    productsRoot,
    runsRoot,
    async cleanup() {
      try {
        await fs.rm(root, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

/** Canonical UniversalProduct fixture (matches M7 publisher fixture). */
export function fixtureUniversalProduct(): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-care-serum",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: "2026-01-15T10:00:00.000Z",
    title: { ar: "سيروم العناية المضيء", en: "Glow Care Serum" },
    description: {
      ar: "سيروم مرطب للبشرة، يعالج جفاف البشرة ويمنحها الترطيب اليومي. مناسب للنساء.",
      en: "A hydrating serum for women that targets dryness and delivers daily hydration.",
    },
    headline: { ar: "بشرة مشرقة في 14 يوم", en: "Radiant skin in 14 days" },
    subheadline: {
      ar: "ترطيب يومي مكثّف بدون لمعة.",
      en: "Deep daily hydration, never greasy.",
    },
    benefits: [
      {
        icon: "Droplets",
        title: { ar: "ترطيب عميق", en: "Deep hydration" },
        body: {
          ar: "ترطيب عميق يدوم 24 ساعة ويعالج جفاف البشرة.",
          en: "24-hour hydration that addresses dryness.",
        },
      },
    ],
    ingredients: [
      {
        name: { ar: "حمض الهيالورونيك", en: "Hyaluronic acid" },
        role: { ar: "يرطّب البشرة بعمق", en: "Hydrates deeply" },
        inci: "Sodium Hyaluronate",
      },
    ],
    images: [
      {
        src: "stores/fanaa/products/up_test_001/hero.webp",
        alt: { ar: "سيروم العناية المضيء", en: "Glow Care Serum bottle" },
        width: 1200,
        height: 1500,
      },
    ],
    reviews: [
      {
        name: { ar: "نورة", en: "Noura" },
        city: { ar: "الرياض", en: "Riyadh" },
        rating: 5,
        body: {
          ar: "بشرتي صارت مرطبة وأكثر إشراقاً.",
          en: "My skin feels hydrated and glowing.",
        },
        date: "2026-01-10",
        verified: true,
      },
    ],
    faq: [
      {
        q: { ar: "هل مناسب للبشرة الحساسة؟", en: "Is it suitable for sensitive skin?" },
        a: { ar: "نعم.", en: "Yes." },
      },
    ],
    priceHint: { amount: 19900, currency: "SAR" },
    hooks: [
      {
        angle: "emotional",
        body: { ar: "تألقي.", en: "Glow." },
        cta: { ar: "اطلبي الآن", en: "Order now" },
      },
    ],
    sources: {
      supplierUrl: "https://example.com/glow-serum",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: ["uploads/op_test/intake-1.jpg"],
    },
  };
}

/** Canonical PublishedProductBundle fixture. */
export function fixturePublishedBundle(): PublishedProductBundle {
  const up = fixtureUniversalProduct();
  return {
    bundleVersion: 1,
    publisher: "fanaa",
    storeId: "fanaa",
    runId: "run_test_001",
    actor: "ops@fanaa.sa",
    publishedAt: up.generatedAt,
    universalProduct: up,
    fanaaExtension: {
      sku: "FN-GLOW-001",
      offerTiers: [
        { quantity: 1, total: { amount: 19900, currency: "SAR" } },
        { quantity: 2, total: { amount: 33830, currency: "SAR" } },
        { quantity: 3, total: { amount: 45969, currency: "SAR" } },
      ],
      productType: "serum",
      target: "women",
      problems: ["dryness"],
    },
    beautyWellnessExtension: {
      concerns: ["hydration"],
    },
  };
}

/** Write a bundle JSON into the temp products tree under storeId/. */
export async function writeFixtureBundle(
  temp: TempPlatformData,
  bundle: PublishedProductBundle,
): Promise<string> {
  const dir = path.join(temp.productsRoot, bundle.storeId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${bundle.universalProduct.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(bundle, null, 2), "utf8");
  return filePath;
}

/** Canonical RunRecord fixture — completed pipeline with all steps. */
export function fixtureRunRecord(): RunRecord {
  const product = fixtureUniversalProduct();
  return {
    runId: "run_test_001",
    storeId: "fanaa",
    status: "completed",
    job: {
      runId: "run_test_001",
      storeId: "fanaa",
      supplierUrl: "https://example.com/glow-serum",
      uploadedImages: [{ src: "uploads/op_test/intake-1.jpg" }],
      priceHint: { amount: 19900, currency: "SAR" },
      createdAt: "2026-01-14T18:00:00.000Z",
    },
    steps: [
      {
        stage: "research",
        status: "success",
        startedAt: "2026-01-14T18:00:01.000Z",
        finishedAt: "2026-01-14T18:00:11.000Z",
        durationMs: 10000,
        attempts: 1,
        costUsd: 0.01,
      },
    ],
    costs: [
      {
        runId: "run_test_001",
        stage: "research",
        capability: "scraper",
        providerId: "firecrawl",
        costUsd: 0.01,
        latencyMs: 10000,
        timestamp: "2026-01-14T18:00:11.000Z",
      },
    ],
    totalCostUsd: 0.01,
    createdAt: "2026-01-14T18:00:00.000Z",
    startedAt: "2026-01-14T18:00:01.000Z",
    finishedAt: "2026-01-14T18:00:50.000Z",
    finalProduct: product,
  };
}

/** Write a run record JSON into the temp runs tree. */
export async function writeFixtureRun(
  temp: TempPlatformData,
  run: RunRecord,
): Promise<string> {
  const filePath = path.join(temp.runsRoot, `${run.runId}.json`);
  await fs.writeFile(filePath, JSON.stringify(run, null, 2), "utf8");
  return filePath;
}

/** Set process.env.PLATFORM_DATA_ROOT to the temp root and return the
 *  previous value so tests can restore it. */
export function pointPlatformDataRoot(root: string): string | undefined {
  const prev = process.env.PLATFORM_DATA_ROOT;
  process.env.PLATFORM_DATA_ROOT = root;
  return prev;
}

export function restorePlatformDataRoot(prev: string | undefined): void {
  if (prev === undefined) {
    delete process.env.PLATFORM_DATA_ROOT;
  } else {
    process.env.PLATFORM_DATA_ROOT = prev;
  }
}

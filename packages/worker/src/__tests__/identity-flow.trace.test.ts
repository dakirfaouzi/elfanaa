import { describe, expect, it } from "vitest";
import { fanaaStore } from "@platform/stores";
import { MemoryStore } from "@platform/ingest";
import type { IngestJob } from "@platform/ingest";
import { runPipeline } from "../runtime/orchestrator";
import { emptyCatalog } from "../runtime/catalog-stub";
import { createMockBundle } from "./_helpers/mock-bundle";
import { textResult, visionResult } from "./_helpers/fixtures";

/**
 * ORCHESTRATOR WIRING EVIDENCE (SmileEase, 2026-05-31)
 * ===================================================
 *
 * Proves end-to-end through the REAL orchestrator that an uploaded
 * product stored as a BARE R2 KEY is resolved to a public CDN URL before
 * the vision + image providers are called — the fix for the identity-loss
 * root cause (PLATFORM.md §26.10). Also proves the structured targeting
 * object reaches the text stages' system prompts.
 */

const BARE_KEY = "studio-intake/fanaa/01SMILEEASE_PURPLE.webp";
const CDN_BASE = "https://cdn.elfanaa.com";
const RESOLVED_URL = `${CDN_BASE}/${BARE_KEY}`;

const SMILEEASE_VISION = {
  productCategory: "teeth-whitening colour-corrector serum (oral care)",
  formFactor: "30ml airless pump bottle",
  visibleColors: ["#6B4FA1", "#FFFFFF"],
  packagingMaterial: "frosted purple plastic bottle",
  visibleText: "SmileEase V34 Colour Corrector Serum — TEETH BRIGHTENING — 30ml",
  labelLanguages: ["en"],
  approximateSize: "30ml",
  visualHooks: ["purple serum bottle", "V34 colour corrector", "teeth brightening"],
  confidence: 0.92,
  notes: "Purple oral-care serum, not skincare.",
};

const smileEaseJob: IngestJob = {
  runId: "run_trace_smileease_worker",
  storeId: "fanaa",
  supplierUrl: "https://supplier.example/p/smileease",
  uploadedImages: [{ src: BARE_KEY, alt: "SmileEase purple serum" }],
  priceHint: { amount: 149, currency: "SAR" },
  operatorNotes: "purple teeth whitening serum",
  createdAt: "2026-05-31T00:00:00.000Z",
  intakeMetadata: {
    targeting: {
      gender: "female",
      market: "SA",
      primaryLanguage: "ar",
      ageMin: 25,
      ageMax: 40,
      awarenessLevel: "product-aware",
      sophisticationLevel: "intermediate",
      emotionalAngle: "transformation",
      toneStyle: "luxurious",
    },
  },
};

describe("SmileEase orchestrator wiring evidence", () => {
  it("resolves the bare R2 key to a public CDN URL before vision AND img2img, and threads targeting", async () => {
    const bundle = createMockBundle();
    bundle.vision.setResponses([visionResult(SMILEEASE_VISION)]);
    // Canned text outputs are irrelevant to the identity-INPUT evidence;
    // reuse defaults but the prompts the stages SEND are what we assert on.

    const result = await runPipeline({
      job: smileEaseJob,
      // Force a known public base so the test is env-independent.
      storeConfig: { ...fanaaStore, r2PublicBaseUrl: CDN_BASE },
      providers: bundle.providers,
      store: new MemoryStore(),
      catalog: emptyCatalog,
    });

    expect(result.run.status).toBe("completed");

    // ── Evidence #1: the VISION provider received the resolved CDN URL,
    //    NOT the bare key. (Before the fix it received the bare key and threw.)
    const visionSrc = bundle.vision.calls[0]!.images[0]!.src;
    // eslint-disable-next-line no-console
    console.log(`\n[WIRING] vision provider received image src: ${visionSrc}\n`);
    expect(visionSrc).toBe(RESOLVED_URL);

    // ── Evidence #5: the IMAGE provider's hero call used the resolved photo
    //    as an img2img (Kontext) reference.
    const heroCall = bundle.image.calls[0]!;
    // eslint-disable-next-line no-console
    console.log(
      `\n[WIRING] image hero call: model=${heroCall.model} ref=${heroCall.referenceImages?.[0]?.src}\n`,
    );
    expect(heroCall.model).toContain("kontext");
    expect(heroCall.referenceImages?.[0]?.src).toBe(RESOLVED_URL);

    // ── Evidence (targeting): the audience directive reached the text stages.
    const strategySystem = bundle.text.calls[0]!.system;
    expect(strategySystem).toContain("AUDIENCE & POSITIONING DIRECTIVE");
    expect(strategySystem).toContain("PRODUCT-AWARE");
    expect(strategySystem).toContain("LUXURIOUS");

    // ── Evidence (#3/#4): the SmileEase identity reached strategy + copy prompts.
    expect(bundle.text.calls[0]!.prompt).toContain("teeth-whitening"); // strategy
    expect(bundle.text.calls[2]!.prompt).toContain("SmileEase"); // copy
  });
});

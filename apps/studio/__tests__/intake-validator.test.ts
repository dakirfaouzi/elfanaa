import { describe, expect, it } from "vitest";
import { validateIntake } from "../lib/studio/intake-validator";

/**
 * Tests for the intake form validator.
 *
 * Coverage:
 *   1. Happy path produces a typed IngestJob with deterministic
 *      runId + createdAt (via injection).
 *   2. SAR major→minor conversion.
 *   3. Currency normalisation to uppercase.
 *   4. Rejection of non-http URLs.
 *   5. Rejection of negative / zero / huge prices.
 *   6. Rejection of >10 uploaded images.
 *   7. uploadedImages defaults to [].
 *   8. Cross-check against IngestJobSchema catches non-URL-safe runIds.
 */
describe("validateIntake", () => {
  const baseForm = {
    storeId: "fanaa",
    supplierUrl: "https://supplier.example/p/glow-serum",
    priceHintMajor: 199,
    currency: "sar",
  };

  const fixedNow = () => new Date("2026-05-22T10:00:00.000Z");
  const fixedRunId = () => "run_test_001";

  it("happy path produces a typed IngestJob", () => {
    const result = validateIntake(baseForm, {
      now: fixedNow,
      mintRunId: fixedRunId,
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.job.runId).toBe("run_test_001");
    expect(result.job.storeId).toBe("fanaa");
    expect(result.job.supplierUrl).toBe(baseForm.supplierUrl);
    expect(result.job.createdAt).toBe("2026-05-22T10:00:00.000Z");
  });

  it("converts major-units price to minor units", () => {
    const result = validateIntake(baseForm, { now: fixedNow, mintRunId: fixedRunId });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.job.priceHint).toEqual({ amount: 19900, currency: "SAR" });
  });

  it("normalises currency to uppercase", () => {
    const result = validateIntake(
      { ...baseForm, currency: "aed" },
      { now: fixedNow, mintRunId: fixedRunId },
    );
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.job.priceHint.currency).toBe("AED");
  });

  it("defaults uploadedImages to [] when omitted", () => {
    const result = validateIntake(baseForm, { now: fixedNow, mintRunId: fixedRunId });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.job.uploadedImages).toEqual([]);
  });

  it("rejects non-http URLs", () => {
    const result = validateIntake({
      ...baseForm,
      supplierUrl: "ftp://supplier.example/p/serum",
    });
    expect(result.status).toBe("invalid");
  });

  it("rejects supplier URLs that aren't URLs at all", () => {
    const result = validateIntake({ ...baseForm, supplierUrl: "not a url" });
    expect(result.status).toBe("invalid");
  });

  it("rejects non-positive price hints", () => {
    expect(validateIntake({ ...baseForm, priceHintMajor: 0 }).status).toBe("invalid");
    expect(validateIntake({ ...baseForm, priceHintMajor: -1 }).status).toBe("invalid");
  });

  it("rejects unrealistically large price hints", () => {
    const result = validateIntake({ ...baseForm, priceHintMajor: 9_999_999 });
    expect(result.status).toBe("invalid");
  });

  it("rejects > 10 uploaded images", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      src: `https://x.test/${i}.jpg`,
    }));
    const result = validateIntake({ ...baseForm, uploadedImages: tooMany });
    expect(result.status).toBe("invalid");
  });

  it("propagates operatorNotes + marginNotes verbatim", () => {
    const result = validateIntake(
      {
        ...baseForm,
        operatorNotes: "target hydration-aware women",
        marginNotes: "supplier $4.20 + ship $1.80",
        skipResearch: true,
      },
      { now: fixedNow, mintRunId: fixedRunId },
    );
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.job.operatorNotes).toBe("target hydration-aware women");
    expect(result.job.marginNotes).toBe("supplier $4.20 + ship $1.80");
    expect(result.job.skipResearch).toBe(true);
  });

  it("cross-check fails when the minted runId is not URL-safe", () => {
    // mintRunId yields an unsafe value — IngestJobSchema regex must catch it.
    const result = validateIntake(baseForm, {
      now: fixedNow,
      mintRunId: () => "run/has/slash",
    });
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.issues.some((i) => i.path === "runId")).toBe(true);
  });

  it("reports each invalid field with a stable path", () => {
    const result = validateIntake({
      storeId: "",
      supplierUrl: "not a url",
      priceHintMajor: -5,
    });
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain("storeId");
    expect(paths).toContain("supplierUrl");
    expect(paths).toContain("priceHintMajor");
  });

  // ── Phase A1 — IntakeMetadata namespace backward / forward compat ─
  //
  // The canonical IngestJobSchema acquired one new optional field
  // (`intakeMetadata`). These tests pin the THREE semantically-equal
  // shapes the system must accept, and verify the legacy fields
  // are untouched. Regression here would break replay of any
  // pre-Phase-A run record on disk.

  it("M9-shaped payload (no intakeMetadata field at all) still validates and omits the namespace", () => {
    const result = validateIntake(baseForm, {
      now: fixedNow,
      mintRunId: fixedRunId,
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // The job MUST NOT carry an intakeMetadata key when the form
    // didn't provide one — keeps on-disk JSON identical to M9 for
    // backward-compatible replay.
    expect("intakeMetadata" in result.job).toBe(false);
  });

  it("empty intakeMetadata object validates and passes through", () => {
    const result = validateIntake(
      { ...baseForm, intakeMetadata: {} },
      { now: fixedNow, mintRunId: fixedRunId },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.job.intakeMetadata).toEqual({});
  });

  it("unknown keys inside intakeMetadata are stripped, not rejected (forward compat)", () => {
    // A FUTURE studio version may emit fields not yet known to an
    // older worker. Zod's default `.strip()` behaviour means those
    // fields are dropped silently, NOT rejected — the payload
    // still validates. This is the contract that lets the studio
    // and worker deploy out of sync.
    const result = validateIntake(
      {
        ...baseForm,
        intakeMetadata: {
          someFutureField: "value",
          anotherUnknown: { nested: 1 },
        },
      },
      { now: fixedNow, mintRunId: fixedRunId },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // After strip, the namespace is empty — but it IS still
    // present on the output, so consumers can distinguish "operator
    // sent a structured intake (even if empty)" from "operator sent
    // a legacy M9 form".
    expect(result.job.intakeMetadata).toEqual({});
  });

  it("legacy free-text fields (operatorNotes, marginNotes) coexist with intakeMetadata", () => {
    // The Phase A → B migration period: forms may emit BOTH the
    // legacy string fields AND the structured namespace. Both
    // must flow through untouched so the orchestrator can decide
    // its merge strategy.
    const result = validateIntake(
      {
        ...baseForm,
        operatorNotes: "free-text positioning",
        marginNotes: "supplier $4.20",
        intakeMetadata: {},
      },
      { now: fixedNow, mintRunId: fixedRunId },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.job.operatorNotes).toBe("free-text positioning");
    expect(result.job.marginNotes).toBe("supplier $4.20");
    expect(result.job.intakeMetadata).toEqual({});
  });
});

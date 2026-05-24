import { describe, expect, it } from "vitest";
import {
  ALLOWED_CONTENT_TYPES,
  extForContentType,
  keyForIntakeUpload,
  keyForUpload,
  parseIntakeKey,
  parseKey,
  ulid,
} from "../keys";

/**
 * Key + ULID tests.
 *
 * Coverage:
 *   1. ULID format: 26 ASCII chars, Crockford base-32, monotonic time
 *      prefix.
 *   2. Content-type → extension mapping is conservative.
 *   3. `keyForUpload` produces the exact PLATFORM.md §14 pattern.
 *   4. Bad draftId / unknown content type → throws.
 *   5. parseKey is the inverse of keyForUpload for any valid input.
 */

describe("ulid", () => {
  it("emits a 26-char Crockford base-32 string", () => {
    const id = ulid();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-Z]{26}$/);
    // No I, L, O, U in Crockford alphabet.
    expect(id.includes("I")).toBe(false);
    expect(id.includes("L")).toBe(false);
    expect(id.includes("O")).toBe(false);
    expect(id.includes("U")).toBe(false);
  });

  it("is deterministic when nowMs + randomFn are pinned", () => {
    const fakeRand = () => new Uint8Array(16).fill(0);
    const a = ulid({ nowMs: 1_716_375_000_000, randomFn: fakeRand });
    const b = ulid({ nowMs: 1_716_375_000_000, randomFn: fakeRand });
    expect(a).toBe(b);
  });

  it("the time prefix sorts monotonically", () => {
    const fakeRand = () => new Uint8Array(16).fill(0);
    const a = ulid({ nowMs: 1_716_375_000_000, randomFn: fakeRand });
    const b = ulid({ nowMs: 1_716_375_001_000, randomFn: fakeRand });
    expect(a < b).toBe(true);
  });

  it("rejects negative or non-finite times", () => {
    expect(() => ulid({ nowMs: -1 })).toThrow(/ulid_invalid_time/);
    expect(() => ulid({ nowMs: Number.NaN })).toThrow(/ulid_invalid_time/);
  });
});

describe("extForContentType", () => {
  it("returns the canonical extension for every allowed content type", () => {
    for (const [ct, ext] of Object.entries(ALLOWED_CONTENT_TYPES)) {
      expect(extForContentType(ct)).toBe(ext);
    }
  });

  it("normalises whitespace + casing", () => {
    expect(extForContentType("  IMAGE/PNG  ")).toBe("png");
  });

  it("rejects unknown content types", () => {
    expect(() => extForContentType("application/exe")).toThrow(
      /unsupported_content_type/,
    );
    expect(() => extForContentType("text/html")).toThrow(
      /unsupported_content_type/,
    );
  });
});

describe("keyForUpload", () => {
  it("produces the PLATFORM.md §14 pattern: studio/<draftId>/<source>/<ulid>.<ext>", () => {
    const key = keyForUpload({
      draftId: "draft_abc123",
      source: "upload",
      contentType: "image/png",
      ulidOverride: "01HXYZTESTULIDFAKEABCDEFGH",
    });
    expect(key).toBe("studio/draft_abc123/upload/01HXYZTESTULIDFAKEABCDEFGH.png");
  });

  it("mints a fresh ULID per call by default", () => {
    const k1 = keyForUpload({
      draftId: "d",
      source: "generated",
      contentType: "image/webp",
    });
    const k2 = keyForUpload({
      draftId: "d",
      source: "generated",
      contentType: "image/webp",
    });
    expect(k1).not.toBe(k2);
    expect(k1.startsWith("studio/d/generated/")).toBe(true);
    expect(k1.endsWith(".webp")).toBe(true);
  });

  it("rejects malformed draft ids", () => {
    expect(() =>
      keyForUpload({
        draftId: "draft with spaces",
        source: "upload",
        contentType: "image/png",
      }),
    ).toThrow(/invalid_draft_id/);
    expect(() =>
      keyForUpload({
        draftId: "",
        source: "upload",
        contentType: "image/png",
      }),
    ).toThrow(/invalid_draft_id/);
  });

  it("rejects unknown content types", () => {
    expect(() =>
      keyForUpload({
        draftId: "d",
        source: "upload",
        contentType: "image/bmp",
      }),
    ).toThrow(/unsupported_content_type/);
  });
});

describe("parseKey", () => {
  it("round-trips an upload key back to its components", () => {
    const id = "01HXYZTESTULIDFAKEABCDEFGH";
    const key = `studio/draft_abc/scraped/${id}.jpg`;
    const parsed = parseKey(key);
    expect(parsed).toEqual({
      draftId: "draft_abc",
      source: "scraped",
      id,
      ext: "jpg",
    });
  });

  it("returns null for anything that doesn't match the pattern", () => {
    expect(parseKey("some/other/path.png")).toBeNull();
    expect(parseKey("studio/draft_abc/badSource/01HX...EFGH.png")).toBeNull();
    expect(parseKey("studio/has spaces/upload/01HXYZTESTULIDFAKEABCDEFGH.png")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase B1 — intake-time key helpers
// ─────────────────────────────────────────────────────────────────────────

describe("keyForIntakeUpload", () => {
  it("composes the canonical studio-intake/<storeId>/<ulid>.<ext> pattern", () => {
    const key = keyForIntakeUpload({
      storeId: "fanaa",
      contentType: "image/webp",
      ulidOverride: "01HXYZTESTULIDFAKEABCDEFGH",
    });
    expect(key).toBe("studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp");
  });

  it("produces unique keys on each call (ULID monotonicity)", () => {
    const a = keyForIntakeUpload({
      storeId: "fanaa",
      contentType: "image/webp",
    });
    const b = keyForIntakeUpload({
      storeId: "fanaa",
      contentType: "image/webp",
    });
    expect(a).not.toBe(b);
    expect(a.startsWith("studio-intake/fanaa/")).toBe(true);
    expect(a.endsWith(".webp")).toBe(true);
  });

  it("never produces a key under the draft-attached `studio/` prefix", () => {
    // Critical for the R2 lifecycle policy: the `studio-intake/`
    // prefix MUST be disjoint from `studio/` so the 24h expiry
    // rule doesn't accidentally delete draft-attached assets.
    const key = keyForIntakeUpload({
      storeId: "fanaa",
      contentType: "image/png",
    });
    expect(key.startsWith("studio-intake/")).toBe(true);
    expect(key.startsWith("studio/")).toBe(false);
  });

  it("rejects malformed store ids", () => {
    expect(() =>
      keyForIntakeUpload({
        storeId: "store with spaces",
        contentType: "image/png",
      }),
    ).toThrow(/invalid_store_id/);
    expect(() =>
      keyForIntakeUpload({
        storeId: "",
        contentType: "image/png",
      }),
    ).toThrow(/invalid_store_id/);
  });

  it("rejects unknown content types (same allow-list as keyForUpload)", () => {
    expect(() =>
      keyForIntakeUpload({
        storeId: "fanaa",
        contentType: "application/x-msdownload",
      }),
    ).toThrow(/unsupported_content_type/);
  });
});

describe("parseIntakeKey", () => {
  it("round-trips an intake key back to its components", () => {
    const id = "01HXYZTESTULIDFAKEABCDEFGH";
    const parsed = parseIntakeKey(
      `studio-intake/fanaa/${id}.webp`,
    );
    expect(parsed).toEqual({ storeId: "fanaa", id, ext: "webp" });
  });

  it("returns null for draft-attached `studio/` keys (not its concern)", () => {
    // Critical inverse: parseIntakeKey MUST refuse to parse the
    // draft-attached shape, otherwise a caller might mistake a
    // draft asset for an intake asset and apply intake-only logic
    // (like the lifecycle-expiry trace).
    expect(
      parseIntakeKey("studio/draft_abc/upload/01HXYZTESTULIDFAKEABCDEFGH.png"),
    ).toBeNull();
  });

  it("returns null for arbitrary garbage", () => {
    expect(parseIntakeKey("")).toBeNull();
    expect(parseIntakeKey("/")).toBeNull();
    expect(parseIntakeKey("studio-intake/fanaa")).toBeNull();
    expect(parseIntakeKey("studio-intake/fanaa/not-a-ulid.png")).toBeNull();
    expect(
      parseIntakeKey("studio-intake/fanaa with spaces/01HXYZTESTULIDFAKEABCDEFGH.png"),
    ).toBeNull();
  });
});

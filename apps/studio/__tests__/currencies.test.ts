import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  getCurrency,
  marketDefaultCurrency,
  marketPresets,
} from "../lib/studio/intake/currencies";

/**
 * Currency catalog tests (Phase A3).
 *
 * The catalog itself is data, but several invariants matter:
 *
 *   1. All seven required GCC currencies + USD are present.
 *   2. KWD / BHD / OMR are flagged as 3-decimal minor units
 *      (not 2). This is the audit's flagged Phase-B follow-up.
 *   3. Case-insensitive lookup works.
 *   4. Per-market presets always include a defaulted entry exactly
 *      once.
 *   5. The order returned by `marketPresets` is stable and matches
 *      the canonical list — UI dropdowns depend on this for
 *      render-stability.
 */

describe("SUPPORTED_CURRENCIES catalog", () => {
  it("includes every required GCC currency + USD", () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code).sort();
    expect(codes).toEqual(
      ["AED", "BHD", "KWD", "OMR", "QAR", "SAR", "USD"].sort(),
    );
  });

  it("flags 3-decimal currencies correctly (KWD/BHD/OMR)", () => {
    for (const code of ["KWD", "BHD", "OMR"] as const) {
      const meta = SUPPORTED_CURRENCIES.find((c) => c.code === code);
      expect(meta?.minorUnitsExponent).toBe(3);
    }
  });

  it("flags 2-decimal currencies correctly (SAR/AED/QAR/USD)", () => {
    for (const code of ["SAR", "AED", "QAR", "USD"] as const) {
      const meta = SUPPORTED_CURRENCIES.find((c) => c.code === code);
      expect(meta?.minorUnitsExponent).toBe(2);
    }
  });

  it("every entry has a non-empty displayName + nativeSymbol", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(c.displayName.length).toBeGreaterThan(0);
      expect(c.nativeSymbol.length).toBeGreaterThan(0);
    }
  });
});

describe("getCurrency", () => {
  it("is case-insensitive", () => {
    expect(getCurrency("sar")?.code).toBe("SAR");
    expect(getCurrency("Sar")?.code).toBe("SAR");
    expect(getCurrency("SAR")?.code).toBe("SAR");
  });

  it("returns undefined for unsupported codes", () => {
    expect(getCurrency("JPY")).toBeUndefined();
    expect(getCurrency("")).toBeUndefined();
    expect(getCurrency("XXXX")).toBeUndefined();
  });
});

describe("marketDefaultCurrency", () => {
  it("defaults the fanaa store to SAR", () => {
    expect(marketDefaultCurrency("fanaa")).toBe("SAR");
  });

  it("falls back to USD for unknown stores", () => {
    expect(marketDefaultCurrency("nonexistent_store")).toBe("USD");
    expect(marketDefaultCurrency("")).toBe("USD");
  });
});

describe("marketPresets", () => {
  it("returns every supported currency exactly once", () => {
    const presets = marketPresets("fanaa");
    expect(presets).toHaveLength(SUPPORTED_CURRENCIES.length);
    const codes = presets.map((p) => p.meta.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("marks exactly one preset as default", () => {
    const defaults = marketPresets("fanaa").filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.meta.code).toBe("SAR");
  });

  it("preserves SUPPORTED_CURRENCIES order (dropdown stability)", () => {
    const presetCodes = marketPresets("fanaa").map((p) => p.meta.code);
    const sourceCodes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(presetCodes).toEqual(sourceCodes);
  });

  it("unknown store defaults USD (still exactly one default)", () => {
    const presets = marketPresets("nonexistent");
    const defaults = presets.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.meta.code).toBe("USD");
  });
});

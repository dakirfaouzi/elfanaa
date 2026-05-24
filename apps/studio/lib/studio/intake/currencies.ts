/**
 * Supported intake currencies + market presets.
 *
 * # Why this is UI-side
 *
 * `IngestJobSchema.priceHint.currency` (via `MoneySchema`) accepts
 * ANY 3-letter ISO code today and has done since M6. We deliberately
 * keep it that way so old data and exotic markets aren't blocked at
 * the canonical contract. This module is the CURATED list the
 * intake form surfaces to operators — a UX restriction, not a
 * validation restriction.
 *
 * If an operator pastes an IngestJob from another tool with
 * `currency: "JPY"`, the worker accepts it. The intake FORM just
 * doesn't list JPY in its dropdown today.
 *
 * # Currencies covered
 *
 *   • GCC: SAR, AED, KWD, QAR, BHD, OMR
 *   • Anchor: USD (used by margin math + cost ceiling — never remove)
 *
 * Other markets (EGP, JOD, MAD, EUR, GBP) can be added later by
 * extending `SUPPORTED_CURRENCIES`; the schema doesn't need to
 * change.
 *
 * # Market presets
 *
 * `marketPresets()` maps a store / market hint to a default currency
 * + symbol + minor-units exponent. The intake form uses this to
 * pre-select a sensible currency based on `storeId` instead of
 * always defaulting to SAR.
 *
 * # Minor-units exponent
 *
 * Some GCC currencies (KWD, BHD, OMR) use 3-decimal minor units
 * (fils, not cents). The form's `priceHintMajor` × 100 conversion
 * in `intake-validator.ts` is currently CENT-fixed — i.e. assumes
 * 2 minor digits everywhere. KWD/BHD/OMR amounts will therefore
 * be stored as `cents × 10` (off by 10×) until the validator
 * starts consulting `minorUnitsExponent`. That's a known follow-up
 * for Phase B (offer builder ships with the exponent fix); for
 * Phase A we document the exponent here so callers can pick it up
 * when needed.
 */

export type CurrencyCode =
  | "SAR"
  | "AED"
  | "KWD"
  | "QAR"
  | "BHD"
  | "OMR"
  | "USD";

export interface CurrencyMeta {
  code: CurrencyCode;
  /** English long form for the dropdown label. */
  displayName: string;
  /** Native short form (ر.س, د.إ, etc.) for compact UI badges. */
  nativeSymbol: string;
  /**
   * Minor-units exponent. 2 = cents (1 SAR = 100 halalas).
   *               3 = fils  (1 KWD = 1000 fils). See module
   *               docstring for the Phase A → Phase B implications.
   */
  minorUnitsExponent: 2 | 3;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyMeta[] = [
  {
    code: "SAR",
    displayName: "Saudi Riyal",
    nativeSymbol: "ر.س",
    minorUnitsExponent: 2,
  },
  {
    code: "AED",
    displayName: "UAE Dirham",
    nativeSymbol: "د.إ",
    minorUnitsExponent: 2,
  },
  {
    code: "KWD",
    displayName: "Kuwaiti Dinar",
    nativeSymbol: "د.ك",
    minorUnitsExponent: 3,
  },
  {
    code: "QAR",
    displayName: "Qatari Riyal",
    nativeSymbol: "ر.ق",
    minorUnitsExponent: 2,
  },
  {
    code: "BHD",
    displayName: "Bahraini Dinar",
    nativeSymbol: "د.ب",
    minorUnitsExponent: 3,
  },
  {
    code: "OMR",
    displayName: "Omani Rial",
    nativeSymbol: "ر.ع",
    minorUnitsExponent: 3,
  },
  {
    code: "USD",
    displayName: "US Dollar",
    nativeSymbol: "$",
    minorUnitsExponent: 2,
  },
] as const;

const CURRENCY_INDEX: ReadonlyMap<CurrencyCode, CurrencyMeta> = new Map(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c]),
);

/** Look up currency metadata. Returns `undefined` for unsupported codes. */
export function getCurrency(code: string): CurrencyMeta | undefined {
  return CURRENCY_INDEX.get(code.toUpperCase() as CurrencyCode);
}

/**
 * Per-market default currency map. The intake form pre-selects the
 * currency based on `storeId` (today only `"fanaa"` exists; future
 * markets land here).
 *
 * Why a function not a const: lets us inject env-driven overrides
 * later (`process.env.STUDIO_DEFAULT_CURRENCY_FANAA=AED`) without
 * touching call sites.
 */
export function marketDefaultCurrency(storeId: string): CurrencyCode {
  // The single existing store; GCC retail audience is primarily
  // Saudi Arabia, so SAR is the sensible default.
  if (storeId === "fanaa") return "SAR";
  // Future stores: when the catalog grows, add cases here. The
  // "USD" anchor is the safe global fallback for any unknown store.
  return "USD";
}

/**
 * Convenience for UI: the full preset bundle the form renders.
 * Returns the list of all supported currencies plus a flag marking
 * which one is the default for the given market. Stable order
 * (matches `SUPPORTED_CURRENCIES`) so the dropdown doesn't reshuffle
 * between renders.
 */
export function marketPresets(storeId: string): Array<{
  meta: CurrencyMeta;
  isDefault: boolean;
}> {
  const def = marketDefaultCurrency(storeId);
  return SUPPORTED_CURRENCIES.map((meta) => ({
    meta,
    isDefault: meta.code === def,
  }));
}

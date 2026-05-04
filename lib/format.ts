import type { Locale, Money } from "./types";

/**
 * Eastern-Arabic-Indic digit mapping (U+0660–U+0669). Used for `ar`
 * presentations so the storefront preserves the GCC visual register
 * (`١٩٩ ر.س.`) while remaining fully deterministic across runtimes.
 */
const EASTERN_ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const ARABIC_DECIMAL_SEPARATOR = "\u066B"; // U+066B Arabic decimal separator
const ARABIC_THOUSANDS_SEPARATOR = "\u066C"; // U+066C Arabic thousands separator

const CURRENCY_LABEL: Record<string, Record<Locale, string>> = {
  SAR: { ar: "ر.س.", en: "SAR" },
  AED: { ar: "د.إ.", en: "AED" },
  USD: { ar: "$", en: "$" },
};

function localizeDigits(input: string, locale: Locale): string {
  if (locale !== "ar") return input;
  return input.replace(/\d/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)]);
}

function groupThousands(integerPart: string, locale: Locale): string {
  const sep = locale === "ar" ? ARABIC_THOUSANDS_SEPARATOR : ",";
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function formatNumberCore(value: number, locale: Locale, fractionDigits = 2): string {
  const fixed = value.toFixed(fractionDigits);
  const [intRaw, fracRaw = ""] = fixed.split(".");
  const trimmedFrac = fracRaw.replace(/0+$/, "");
  const intPart = groupThousands(intRaw, locale);
  if (!trimmedFrac) return localizeDigits(intPart, locale);
  const decimalSep = locale === "ar" ? ARABIC_DECIMAL_SEPARATOR : ".";
  return localizeDigits(`${intPart}${decimalSep}${trimmedFrac}`, locale);
}

/**
 * Formats a `Money` value (amount in **minor units**) to a localized,
 * SSR-safe currency string. We avoid `Intl.NumberFormat` for currency
 * specifically because Node's bundled ICU data can render Arabic
 * differently than V8 in Chromium — that mismatch surfaces as a
 * React #418 hydration error in production.
 */
export function formatMoney(money: Money, locale: Locale): string {
  const value = money.amount / 100;
  const number = formatNumberCore(value, locale, 2);
  const label =
    CURRENCY_LABEL[money.currency]?.[locale] ?? money.currency;
  return locale === "ar" ? `${number} ${label}` : `${label} ${number}`;
}

export function formatNumber(n: number, locale: Locale): string {
  return formatNumberCore(n, locale, 0);
}

export function pickLocalized<T>(
  value: Record<Locale, T>,
  locale: Locale
): T {
  return value[locale] ?? value.en;
}

/** Sum a list of money values that share a currency. Returns undefined for empty input. */
export function sumMoney(items: Money[]): Money | undefined {
  if (items.length === 0) return undefined;
  const currency = items[0].currency;
  const amount = items.reduce((acc, m) => acc + m.amount, 0);
  return { amount, currency };
}

/** Multiply a money value by an integer quantity. */
export function multiplyMoney(money: Money, qty: number): Money {
  return { amount: money.amount * qty, currency: money.currency };
}

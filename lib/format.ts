import type { Locale, Money } from "./types";

const LOCALE_TAG: Record<Locale, string> = {
  ar: "ar-SA",
  en: "en-US",
};

export function formatMoney(money: Money, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 2,
  }).format(money.amount / 100);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(n);
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

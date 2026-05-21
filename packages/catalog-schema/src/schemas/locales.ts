import { z } from "zod";
import type { Locale, LocalizedString, Money } from "../locales";

/**
 * Runtime validators mirroring `../locales.ts`.
 *
 * Every schema is annotated with `z.ZodType<TheType>` so that any drift
 * between the hand-written interface (the contract) and the Zod schema
 * (the runtime validator) is caught at TypeScript compile time. M3
 * ships schemas but no caller invokes them — that's M5+ pipeline work.
 */

export const LocaleSchema: z.ZodType<Locale> = z.enum(["ar", "en"]);

/**
 * Localised string — bilingual `{ ar, en }`. Both locales required; an
 * empty value is permitted because some niche-specific generations
 * legitimately leave the secondary locale empty in early stages and
 * fill it in later.
 */
export const LocalizedStringSchema: z.ZodType<LocalizedString> = z.object({
  ar: z.string(),
  en: z.string(),
});

/**
 * Money — minor units integer + ISO 4217 currency. Pipeline-produced
 * draft amounts may be 0 (e.g. compareAtPrice unknown); negative
 * amounts are rejected.
 */
export const MoneySchema: z.ZodType<Money> = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

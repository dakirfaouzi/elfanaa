"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  getDictionary,
  getDirection,
  type Dictionary,
} from "@/lib/i18n";
import { STORAGE_KEY_LOCALE } from "@/lib/brand";
import { htmlLangFor } from "@/lib/seo";
import type { Locale } from "@/lib/types";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Restore preference on mount; sync html attributes any time it changes.
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(STORAGE_KEY_LOCALE) as Locale | null)
        : null;
    if (saved && saved !== locale) setLocaleState(saved);
    // Run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = getDirection(locale);
    document.documentElement.lang = htmlLangFor(locale);
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY_LOCALE, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleLocale = useCallback(
    () => setLocaleState((prev) => (prev === "ar" ? "en" : "ar")),
    []
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: getDirection(locale),
      t: getDictionary(locale),
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

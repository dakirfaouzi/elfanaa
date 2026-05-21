"use client";

import { Globe } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

export function LocaleSwitcher() {
  const { locale, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label="Toggle language"
      className="fn-tap-44 inline-flex items-center gap-2 rounded-full px-3 text-sm font-medium text-ink/80 transition-colors hover:bg-brand-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <Globe className="size-4" />
      <span className="tabular-nums">{locale === "ar" ? "EN" : "ع"}</span>
    </button>
  );
}

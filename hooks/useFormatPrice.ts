"use client";

import { useCallback } from "react";
import { formatMoney } from "@/lib/format";
import type { Money } from "@/lib/types";
import { useLocale } from "./useLocale";

export function useFormatPrice() {
  const { locale } = useLocale();
  return useCallback((money: Money) => formatMoney(money, locale), [locale]);
}

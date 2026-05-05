"use client";

import { useLocale } from "@/hooks/useLocale";
import type { Product } from "@/lib/types";
import { pickLocalized } from "@/lib/format";
import { Beaker } from "lucide-react";

export function ProductIngredients({ product }: { product: Product }) {
  const { locale, t } = useLocale();

  if (!product.ingredients || product.ingredients.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-line bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/25">
            <Beaker className="size-5" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.product.ingredientsEyebrow}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {t.product.ingredientsTitle}
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {product.ingredients.map((ingredient, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-line bg-bg p-6 shadow-sm"
            >
              <h3 className="font-semibold text-ink">
                {pickLocalized(ingredient.name, locale)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {pickLocalized(ingredient.role, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

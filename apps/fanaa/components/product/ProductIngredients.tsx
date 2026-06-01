"use client";

import { useLocale } from "@/hooks/useLocale";
import type { Product, ProductImage } from "@/lib/types";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import { Beaker } from "lucide-react";

export function ProductIngredients({
  product,
  image,
}: {
  product: Product;
  image?: ProductImage;
}) {
  const { locale, t } = useLocale();

  if (!product.ingredients || product.ingredients.length === 0) {
    return null;
  }

  return (
    <section className="fn-section-y border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {image ? (
          <div className="mx-auto mb-10 max-w-3xl">
            <SectionFigure image={image} />
          </div>
        ) : null}
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/30 shadow-[0_6px_20px_rgba(199,162,124,0.18)]">
            <Beaker className="size-5" />
          </div>
          <p className="fn-eyebrow">
            <span className="fn-rule" />
            <span>{t.product.ingredientsEyebrow}</span>
            <span className="fn-rule" />
          </p>
          <h2 className="fn-section-title mt-4">
            {t.product.ingredientsTitle}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {product.ingredients.map((ingredient, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-line bg-bg p-5 shadow-[0_4px_14px_rgba(31,24,21,0.04)] transition-all duration-300 ease-premium md:p-6 md:hover:-translate-y-0.5 md:hover:shadow-[0_10px_30px_rgba(199,162,124,0.16)]"
            >
              <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink">
                {pickLocalized(ingredient.name, locale)}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.75] text-muted md:text-[14.5px]">
                {pickLocalized(ingredient.role, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

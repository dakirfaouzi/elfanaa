"use client";

import { useLocale } from "@/hooks/useLocale";
import type { Product, ProductImage } from "@/lib/types";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import { Beaker, Leaf } from "lucide-react";

/**
 * Ingredients — section-NATIVE creative (Step 4 Phase 4.6.4a).
 *
 * The benchmark "ingredients" creative is an infographic: the product shown
 * alongside ingredient call-out medallions (a circle per ingredient) + a short
 * benefit line. We compose that AT THE RENDER LAYER from the structured Arabic
 * `product.ingredients` (name + role) so the copy stays crisp Arabic RTL — never
 * baked into a generated image (diffusion can't render reliable Arabic).
 *
 * Layout: the assigned ingredient/product visual anchors one side; the ingredient
 * call-outs sit beside it (desktop) / below it (mobile-first). Each call-out is a
 * medallion + name + role, mirroring the benchmark's "ingredient circle + label".
 */
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
        <div className="mb-10 flex flex-col items-center text-center md:mb-12">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/30 shadow-[0_6px_20px_rgba(199,162,124,0.18)]">
            <Beaker className="size-5" />
          </div>
          <p className="fn-eyebrow">
            <span className="fn-rule" />
            <span>{t.product.ingredientsEyebrow}</span>
            <span className="fn-rule" />
          </p>
          <h2 className="fn-section-title mt-4">{t.product.ingredientsTitle}</h2>
        </div>

        <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Product / ingredient visual anchor — the infographic centrepiece. */}
          {image ? (
            <SectionFigure
              image={image}
              aspectClassName="aspect-square"
              className="mx-auto w-full max-w-sm"
            />
          ) : null}

          {/* Ingredient call-outs — composed from structured Arabic content. */}
          <ul className={image ? "flex flex-col gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
            {product.ingredients.map((ingredient, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-line bg-bg p-4 shadow-[0_4px_14px_rgba(31,24,21,0.04)] transition-all duration-300 ease-premium md:p-5 md:hover:-translate-y-0.5 md:hover:shadow-[0_10px_30px_rgba(199,162,124,0.16)]"
              >
                <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/25">
                  <Leaf className="size-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-semibold tracking-[-0.005em] text-ink">
                    {pickLocalized(ingredient.name, locale)}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[1.7] text-muted md:text-[14.5px]">
                    {pickLocalized(ingredient.role, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

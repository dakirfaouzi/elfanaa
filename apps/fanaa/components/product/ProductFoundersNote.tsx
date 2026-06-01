"use client";

import { Quote } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { SectionFigure } from "@/components/product/SectionFigure";
import type { Product, ProductImage } from "@/lib/types";

type Props = { product: Product; image?: ProductImage };

/**
 * Founder / brand-story note (Step 4 §4.0 + §4.1).
 *
 * Adds the human "why we made this" beat that premium GCC brands use to build
 * trust and justify a premium price. Rendered as a single editorial quote
 * block — full-bleed-feeling on mobile, centered and contained on desktop.
 * Renders nothing unless the pipeline produced a founder's note.
 */
export function ProductFoundersNote({ product, image }: Props) {
  const { locale } = useLocale();
  const note = product.foundersNote;
  if (!note) return null;

  const label = locale === "ar" ? "رسالة من المؤسس" : "A note from the founder";

  return (
    <section className="fn-section-y bg-ink text-bg">
      <Container>
        {image ? (
          <div className="mx-auto mb-8 max-w-2xl md:mb-10">
            <SectionFigure image={image} />
          </div>
        ) : null}
        <figure className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <Quote
            className="mb-6 size-8 text-accent"
            strokeWidth={1.5}
            aria-hidden
          />
          <blockquote className="text-[18px] font-medium leading-[1.7] tracking-[-0.01em] text-bg md:text-[22px] md:leading-[1.6]">
            {pickLocalized(note, locale)}
          </blockquote>
          <figcaption className="mt-6 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-bg/60">
            {label}
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}

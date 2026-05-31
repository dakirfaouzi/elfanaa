"use client";

import { ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import type { Product } from "@/lib/types";

type Props = { product: Product };

/**
 * Guarantee / risk-reversal band (Step 4 §4.1).
 *
 * The single highest-leverage COD conversion lever: a confident, specific
 * promise that moves the purchase risk onto the brand. Rendered as one
 * centered reassurance card — deliberately compact so it reads instantly on
 * mobile right before the next CTA. Renders nothing without a grounded promise.
 */
export function ProductGuarantee({ product }: Props) {
  const { locale } = useLocale();
  const content = product.sectionContent?.guarantee;
  if (!content) return null;

  return (
    <section className="fn-section-y bg-bg">
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-accent/25 bg-accent/[0.06] px-6 py-10 text-center shadow-[0_10px_40px_rgba(199,162,124,0.12)] md:px-12 md:py-14">
          <span className="mb-5 grid size-14 place-items-center rounded-full bg-bg text-accent ring-1 ring-accent/30 shadow-[0_6px_20px_rgba(199,162,124,0.2)]">
            <ShieldCheck className="size-6" strokeWidth={1.5} />
          </span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink md:text-2xl">
            {pickLocalized(content.title, locale)}
          </h2>
          <p className="mt-3 max-w-xl text-[14.5px] leading-[1.8] text-muted md:text-[15.5px]">
            {pickLocalized(content.body, locale)}
          </p>
        </div>
      </Container>
    </section>
  );
}

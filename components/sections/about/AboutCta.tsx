"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";

/**
 * Closing CTA — calm, single primary action + a quiet secondary
 * "talk to us" link to /contact for the customers who want to chat
 * before they buy.
 */
export function AboutCta() {
  const { t } = useLocale();
  const waNumber = siteConfig.contact.whatsapp.replace(/[^0-9]/g, "");
  return (
    <section className="bg-brand-soft py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            {t.about.ctaTitle}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted md:text-[17px]">
            {t.about.ctaBody}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/shop"
              className="group inline-flex h-12 items-center gap-2.5 rounded-md bg-ink px-7 text-sm font-medium text-bg transition-all duration-200 ease-premium hover:bg-ink/90 hover:gap-3.5 md:h-14 md:px-9 md:text-base"
            >
              {t.about.ctaButton}
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>

            <Link
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-line bg-bg px-7 text-sm font-medium text-ink transition-colors hover:border-ink/30 md:h-14 md:px-9 md:text-base"
            >
              <MessageCircle className="size-4" />
              {t.about.contactCta}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

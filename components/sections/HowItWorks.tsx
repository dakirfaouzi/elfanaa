"use client";

import { ShoppingBag, ClipboardList, PhoneCall, Truck, BadgeCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * "How it works" — COD reframed as an advantage.
 *
 * The customer's #1 objection on a KSA DTC store isn't price, it's
 * trust. This section answers it head-on: 5 numbered steps that show
 * exactly what happens, with the payment moment placed *last* (after
 * physical inspection). That sequencing is the whole conversion idea.
 *
 * Layout:
 *   • Mobile (1 col):  vertical timeline, dot per step
 *   • Tablet (2 cols): two rows of cards
 *   • Desktop (5 cols): horizontal timeline with connecting hairline
 *
 * Visually distinct from the surrounding sections — sits on the surface
 * tone rather than alabaster bg, so the rhythm of the page breaks here
 * and the eye lands on the trust message.
 */
export function HowItWorks() {
  const { t } = useLocale();
  const steps = [
    { Icon: ShoppingBag, title: t.howItWorks.step1Title, body: t.howItWorks.step1Body },
    { Icon: ClipboardList, title: t.howItWorks.step2Title, body: t.howItWorks.step2Body },
    { Icon: PhoneCall, title: t.howItWorks.step3Title, body: t.howItWorks.step3Body },
    { Icon: Truck, title: t.howItWorks.step4Title, body: t.howItWorks.step4Body },
    { Icon: BadgeCheck, title: t.howItWorks.step5Title, body: t.howItWorks.step5Body },
  ];

  return (
    <section className="bg-surface py-20 md:py-32" aria-labelledby="how-it-works-heading">
      <Container>
        <header className="mx-auto mb-16 max-w-2xl text-center md:mb-20">
          <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
            <span className="text-accent/60">04</span>
            <span className="h-px w-6 bg-line" aria-hidden />
            <span className="text-accent">{t.howItWorks.eyebrow}</span>
          </div>
          <h2
            id="how-it-works-heading"
            className="mt-4 whitespace-pre-line text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] md:text-5xl lg:text-[58px]"
          >
            {t.howItWorks.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            {t.howItWorks.body}
          </p>
        </header>

        <div className="relative">
          {/* Horizontal connecting hairline — desktop only, sits behind the dots */}
          <div
            aria-hidden
            className="absolute start-[10%] end-[10%] top-8 hidden h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent lg:block"
          />

          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {steps.map(({ Icon, title, body }, i) => (
              <li key={i} className="relative flex flex-col items-center text-center">
                {/* Numbered dot — bg ring keeps the connecting hairline behind it */}
                <div className="relative z-10 mb-6 grid size-16 place-items-center rounded-full bg-bg shadow-card ring-1 ring-accent/25">
                  <Icon className="size-5 text-accent" strokeWidth={1.6} />
                  <span
                    className="absolute -top-2 end-[-8px] grid size-7 place-items-center rounded-full bg-accent text-[11px] font-bold text-bg shadow-sm rtl:end-auto rtl:start-[-8px]"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-ink md:text-base">
                  {title}
                </h3>
                <p className="mt-2 max-w-[230px] text-[13px] leading-relaxed text-muted md:text-sm">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

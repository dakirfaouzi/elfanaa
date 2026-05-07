"use client";

import { Beaker, Droplets, Shield, Zap } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/cn";

/**
 * "The Mechanism" — clinical ingredient breakdown.
 *
 * This replaces a generic "how COD works" timeline with a section
 * that builds AUTHORITY. Premium skincare brands (The Ordinary,
 * Paula's Choice, Drunk Elephant) sell on mechanisms, not just outcomes.
 *
 * Structure: 3 columns showing the core active ingredient categories,
 * what they do at a cellular level, and why they work specifically
 * in the KSA environment (heat, UV, hard water).
 */
export function HowItWorks() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const mechanisms = isAr
    ? [
        {
          Icon: Beaker,
          ingredient: "فيتامين C ١٢٪",
          action: "يوقف إنتاج الميلانين",
          explanation:
            "النسبة العلاجية (١٢٪) تخترق البشرة وتمنع إنزيم التيروزيناز من تكوين بقع جديدة. أغلب المنتجات تستخدم ٢-٥٪ فقط — وهي نسبة تجميلية لا علاجية.",
        },
        {
          Icon: Shield,
          ingredient: "مركب السيراميد",
          action: "يبني جدار الحماية",
          explanation:
            "٥ أنواع من السيراميد تعيد بناء طبقة الدهون بين خلايا البشرة. هذه الطبقة هي ما يمنع تبخر الماء — التكييف والمياه الثقيلة يدمرانها يومياً.",
        },
        {
          Icon: Droplets,
          ingredient: "كيراتين نباتي + أرغان",
          action: "يرمّم بنية الشعرة",
          explanation:
            "الكيراتين النباتي يملأ الفراغات في قشرة الشعرة المكسورة، وزيت الأرغان يقفل السطح. النتيجة: شعر أقوى من أول جلسة، بدون سيليكون يخفي التلف.",
        },
      ]
    : [
        {
          Icon: Beaker,
          ingredient: "12% Vitamin C",
          action: "Stops melanin production",
          explanation:
            "Therapeutic concentration (12%) penetrates the skin and inhibits tyrosinase — the enzyme that forms new spots. Most products use 2-5%, a cosmetic dose, not a clinical one.",
        },
        {
          Icon: Shield,
          ingredient: "Ceramide Complex",
          action: "Builds a protective wall",
          explanation:
            "5 types of ceramides rebuild the lipid layer between skin cells. This layer prevents water evaporation — AC and hard water destroy it daily in Saudi Arabia.",
        },
        {
          Icon: Droplets,
          ingredient: "Vegan Keratin + Argan",
          action: "Repairs hair structure",
          explanation:
            "Vegan keratin fills gaps in the broken hair cortex, and argan oil seals the surface. Result: stronger hair from session one, without silicone masking the damage.",
        },
      ];

  const { ref: headerRef, inView: headerVisible } = useInView();
  const { ref: cardsRef, inView: cardsVisible } = useInView({ rootMargin: "0px 0px -40px 0px" });

  return (
    <section className="relative bg-ink py-16 text-bg md:py-24" aria-labelledby="mechanism-heading">
      {/* Subtle radial accent — contained by relative on parent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_50%_0%,rgba(186,110,92,0.18),transparent_60%)]"
      />

      <Container>
        <header
          ref={headerRef as React.RefObject<HTMLElement>}
          className={cn(
            "reveal mx-auto mb-8 max-w-2xl text-center md:mb-16",
            headerVisible && "in-view"
          )}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent ring-1 ring-accent/25">
            <Zap className="size-3.5" />
            {isAr ? "المنهجية العلمية" : "Clinical Methodology"}
          </div>
          <h2
            id="mechanism-heading"
            className="mt-4 whitespace-pre-line text-balance font-display text-3xl font-semibold leading-[1.06] tracking-[-0.01em] md:text-4xl lg:text-5xl"
          >
            {isAr
              ? "كيف تشتغل التركيبات؟"
              : "How do the formulas work?"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-bg/70 md:text-base">
            {isAr
              ? "كل منتج مبني على مكوّن فعّال بنسبة علاجية — ليس تجميلية. هذا الفرق بين 'محتمل يشتغل' و'مثبت علمياً'."
              : "Every product is built on an active ingredient at a therapeutic dose — not a cosmetic one. That's the difference between 'might work' and 'clinically proven'."}
          </p>
        </header>

        <div
          ref={cardsRef as React.RefObject<HTMLDivElement>}
          className={cn(
            "reveal grid gap-4 md:grid-cols-3 md:gap-8",
            cardsVisible && "in-view"
          )}
          style={{ transitionDelay: "80ms" }}
        >
          {mechanisms.map(({ Icon, ingredient, action, explanation }, i) => (
            <div
              key={i}
              className="rounded-xl border border-bg/10 bg-bg/[0.04] p-5 backdrop-blur-sm md:p-8"
            >
              <div className="mb-5 grid size-12 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/25">
                <Icon className="size-5" strokeWidth={1.6} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {ingredient}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-bg md:text-xl">
                {action}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-bg/70">
                {explanation}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

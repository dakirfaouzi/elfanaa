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
    <section className="fn-section-y relative bg-ink text-bg" aria-labelledby="mechanism-heading">
      {/* Warm champagne wash — pulls the dark band into the brand palette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_50%_0%,rgba(199,162,124,0.20),transparent_62%)]"
      />

      <Container>
        <header
          ref={headerRef as React.RefObject<HTMLElement>}
          className={cn(
            "reveal mx-auto mb-10 max-w-2xl text-center md:mb-16",
            headerVisible && "in-view"
          )}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-accent ring-1 ring-accent/30">
            <Zap className="size-3.5" />
            {isAr ? "المنهجية العلمية" : "Clinical Methodology"}
          </div>
          <h2
            id="mechanism-heading"
            className="fn-section-title text-bg"
          >
            {isAr
              ? "كيف تشتغل التركيبات؟"
              : "How do the formulas work?"}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[14.5px] leading-[1.85] text-bg/72 md:text-[16px]">
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
              className="rounded-2xl border border-bg/[0.08] bg-bg/[0.045] p-5 backdrop-blur-sm transition-colors duration-300 md:p-8 md:hover:border-accent/30"
            >
              <div className="mb-5 grid size-12 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30">
                <Icon className="size-5" strokeWidth={1.6} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.20em] text-accent">
                {ingredient}
              </p>
              <h3 className="mt-2.5 text-[18px] font-semibold tracking-[-0.005em] text-bg md:text-[20px]">
                {action}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.8] text-bg/72 md:text-[15px]">
                {explanation}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

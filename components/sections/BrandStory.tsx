"use client";

import { Thermometer, FlaskConical, Truck, BarChart3 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * "Why Fanaa is Different" — the differentiation section.
 *
 * This replaces the old "Brand Story" editorial block. Brand stories
 * are vanity; differentiators sell. This section answers the one
 * question every Saudi buyer asks: "ليش أشتري منكم مو من أمازون؟"
 *
 * Structure: 4 pillars, each with an icon, a short headline, and
 * one sentence of proof. No fluff, no adjectives — just the
 * competitive moat stated plainly.
 */
export function BrandStory() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const pillars = isAr
    ? [
        {
          Icon: Thermometer,
          title: "مصمّم لمناخ ٤٥°",
          body: "كل تركيبة مختبرة في الرياض وجدة — في حرارة حقيقية، مياه ثقيلة، وتكييف مستمر. ليس في مختبر أوروبي بارد.",
        },
        {
          Icon: FlaskConical,
          title: "نسب علاجية، مو تجميلية",
          body: "فيتامين C بـ ١٢٪ (وليس ٢٪). سيراميد ٥ أنواع (وليس نوع واحد). نختار النسبة اللي تشتغل، مو اللي تكلّف أقل.",
        },
        {
          Icon: Truck,
          title: "ادفع بس لمّا تشوفه",
          body: "الدفع عند الاستلام، إرجاع مجاني ١٤ يوم. ما نبيعك وعود — نبيعك نتيجة تشوفها بعينك قبل ما تدفع ريال.",
        },
        {
          Icon: BarChart3,
          title: "٢٤٠٠+ عميل. ٤.٩ تقييم.",
          body: "مش أرقام تسويقية — أسماء حقيقية، مدن حقيقية، تجارب موثّقة. كل تقييم مرتبط بطلب مؤكد.",
        },
      ]
    : [
        {
          Icon: Thermometer,
          title: "Formulated for 45°C",
          body: "Every formula tested in Riyadh and Jeddah — in real heat, hard water, and constant AC. Not in a cold European lab.",
        },
        {
          Icon: FlaskConical,
          title: "Therapeutic, not cosmetic doses",
          body: "12% Vitamin C (not 2%). 5 types of ceramides (not one). We choose the dose that works, not the one that costs less.",
        },
        {
          Icon: Truck,
          title: "Pay only when you see it",
          body: "Cash on delivery, free 14-day returns. We don't sell promises — we sell results you verify with your own eyes before paying.",
        },
        {
          Icon: BarChart3,
          title: "2,400+ clients. 4.9 rating.",
          body: "Not marketing numbers — real names, real cities, verified experiences. Every review tied to a confirmed order.",
        },
      ];

  return (
    <section className="fn-section-y bg-surface" aria-labelledby="diff-heading">
      <Container>
        <header className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <p className="fn-eyebrow justify-center">
            <span className="fn-rule" />
            <span>{isAr ? "ليش فناء مختلف؟" : "Why Fanaa is different"}</span>
            <span className="fn-rule" />
          </p>
          <h2 id="diff-heading" className="fn-section-title mt-5">
            {isAr
              ? "ليست علامة تجارية أخرى.\nإنها منهجية مختلفة."
              : "Not another brand.\nA different methodology."}
          </h2>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          {pillars.map(({ Icon, title, body }, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border border-line bg-bg p-5 shadow-[0_4px_14px_rgba(31,24,21,0.04)] transition-all duration-300 ease-premium md:gap-5 md:p-7 md:hover:-translate-y-0.5 md:hover:shadow-[0_10px_30px_rgba(199,162,124,0.16)]"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft/70 text-accent ring-1 ring-accent/25">
                <Icon className="size-5" strokeWidth={1.6} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.005em] text-ink md:text-lg">
                  {title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.75] text-muted md:text-[15px]">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

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
    <section className="bg-surface py-16 md:py-24" aria-labelledby="diff-heading">
      <Container>
        <header className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            {isAr ? "ليش فناء مختلف؟" : "Why Fanaa is different"}
          </p>
          <h2
            id="diff-heading"
            className="mt-3 text-balance font-display text-3xl font-semibold leading-[1.06] tracking-[-0.01em] md:text-4xl lg:text-5xl"
          >
            {isAr
              ? "ليست علامة تجارية أخرى.\nإنها منهجية مختلفة."
              : "Not another brand.\nA different methodology."}
          </h2>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
          {pillars.map(({ Icon, title, body }, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-line bg-bg p-4 shadow-sm md:gap-5 md:p-7"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-accent ring-1 ring-accent/20">
                <Icon className="size-5" strokeWidth={1.6} />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink md:text-lg">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
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

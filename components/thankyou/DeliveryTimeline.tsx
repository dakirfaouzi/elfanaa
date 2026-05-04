"use client";

import { Check, Phone, Package, Truck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/cn";

type Step = {
  icon: typeof Check;
  title: string;
  body: string;
  time: string;
  state: "complete" | "active" | "pending";
};

/**
 * Visual delivery stepper.
 *
 * Why a stepper:
 *   COD anxiety in MENA is real — customers worry the order vanished into the
 *   void after they handed over their phone number. A concrete "what happens
 *   next" timeline collapses uncertainty into known waypoints. CODRocket's
 *   research: pre-shipment communication reduces RTO by 30–40%.
 *
 * Layout:
 *   • Horizontal row of 4 steps on md+ screens.
 *   • Vertical stack on mobile with a subtle dotted connector.
 *   • Step 1 = checkmark (done), step 2 = pulsing active dot, 3–4 = muted.
 *   • Time pills sit under each step ("الآن" / "خلال ساعات" / etc.)
 */
export function DeliveryTimeline() {
  const { t } = useLocale();

  const steps: Step[] = [
    {
      icon: Check,
      title: t.thankyou.timelineStep1Title,
      body: t.thankyou.timelineStep1Body,
      time: t.thankyou.timelineStep1Time,
      state: "complete",
    },
    {
      icon: Phone,
      title: t.thankyou.timelineStep2Title,
      body: t.thankyou.timelineStep2Body,
      time: t.thankyou.timelineStep2Time,
      state: "active",
    },
    {
      icon: Package,
      title: t.thankyou.timelineStep3Title,
      body: t.thankyou.timelineStep3Body,
      time: t.thankyou.timelineStep3Time,
      state: "pending",
    },
    {
      icon: Truck,
      title: t.thankyou.timelineStep4Title,
      body: t.thankyou.timelineStep4Body,
      time: t.thankyou.timelineStep4Time,
      state: "pending",
    },
  ];

  return (
    <section aria-label={t.thankyou.timelineTitle} className="bg-bg py-14 md:py-20">
      <Container>
        <header className="mb-10 max-w-2xl md:mb-14">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {t.thankyou.timelineTitle}
          </h2>
        </header>

        <ol className="grid gap-6 md:grid-cols-4 md:gap-4">
          {steps.map((step, idx) => (
            <li key={step.title} className="relative md:pe-4">
              <div className="flex items-start gap-4 md:flex-col md:items-stretch md:gap-3">
                <StepDot state={step.state} icon={step.icon} />

                {/* Connector — only on md+ between steps */}
                {idx < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute hidden h-px md:block",
                      // Place the line between the dot of this step and the next, in LTR/RTL
                      "top-5 start-[44px] end-0",
                      step.state === "complete" || step.state === "active"
                        ? "bg-ink/40"
                        : "bg-line"
                    )}
                  />
                )}

                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {step.time}
                  </p>
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function StepDot({ state, icon: Icon }: Pick<Step, "state" | "icon">) {
  const styles =
    state === "complete"
      ? "bg-ink text-bg"
      : state === "active"
        ? "bg-bg text-ink ring-2 ring-ink"
        : "bg-bg text-muted ring-1 ring-line";

  return (
    <div className="relative">
      <span
        className={cn(
          "relative z-10 grid size-10 place-items-center rounded-full transition-colors",
          styles
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      {state === "active" && (
        <span
          aria-hidden
          className="absolute inset-0 z-0 animate-ping rounded-full bg-ink/15"
        />
      )}
    </div>
  );
}

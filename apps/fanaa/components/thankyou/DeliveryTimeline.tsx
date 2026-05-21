"use client";

import { Check, PhoneCall, Package, Truck } from "lucide-react";
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
 * JourneyTimeline — "What happens next?".
 *
 * The single most effective anti-anxiety device on a COD thank-you page is
 * a clear forward-looking timeline: order received → confirmation call →
 * preparation → delivery.  Each step collapses an unknown into a known
 * waypoint, which is exactly what a hesitant buyer needs in the first
 * twenty minutes after placing an order.
 *
 * Layout strategy:
 *   • **Mobile**: vertical stack with a continuous gold rail running down
 *     the inline-start edge.  Each step is full-width — readable thumb-
 *     friendly cards with the icon, time pill, title, body.
 *   • **Desktop (md+)**: same vertical structure (we deliberately don't
 *     flip to horizontal — the vertical rhythm is what reads as "premium
 *     editorial" rather than "feature comparison table").
 *   • Connector is a single absolutely-positioned line — it never breaks
 *     across step content, never overlaps the icon, and shrinks gracefully
 *     when the last step renders.
 *
 * State semantics: step 1 = complete (filled), step 2 = active (gold ring
 * + soft pulse), steps 3–4 = pending (muted line ring).  No client-side
 * scheduling — the visual states are fixed because the buyer is always
 * at "step 2 incoming" on this page.
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
      icon: PhoneCall,
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
    <section
      aria-labelledby="ty-journey-title"
      className="bg-bg py-12 md:py-16"
    >
      <Container size="md">
        <header className="mb-8 md:mb-10">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--color-accent-deep))]">
            {t.thankyou.timelineEyebrow}
          </p>
          <h2
            id="ty-journey-title"
            className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink md:text-3xl"
          >
            {t.thankyou.timelineTitle}
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted md:text-[15px]">
            {t.thankyou.timelineSubtitle}
          </p>
        </header>

        <ol className="relative space-y-4 md:space-y-5">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <li
                key={step.title}
                className="relative flex items-start gap-4 rounded-2xl border border-line/80 bg-surface/50 p-4 md:gap-5 md:p-5"
              >
                {/* Connector — descends from below the current dot to the
                 *  top of the next.  Skipped on the final step. */}
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-[60px] start-[34px] bottom-[-20px] w-px md:start-[38px] md:bottom-[-24px]",
                      step.state === "complete"
                        ? "bg-gradient-to-b from-success/60 to-line"
                        : step.state === "active"
                          ? "bg-gradient-to-b from-[rgb(var(--color-accent))] to-line"
                          : "bg-line"
                    )}
                  />
                ) : null}

                <StepDot state={step.state} icon={step.icon} />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink md:text-base">
                      {step.title}
                    </h3>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
                        step.state === "complete"
                          ? "bg-success/[0.08] text-success"
                          : step.state === "active"
                            ? "bg-[rgb(var(--color-accent-soft)/0.6)] text-[rgb(var(--color-accent-deep))]"
                            : "bg-bg/70 text-muted ring-1 ring-line/70"
                      )}
                    >
                      {step.time}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-muted md:text-[14.5px]">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}

function StepDot({ state, icon: Icon }: Pick<Step, "state" | "icon">) {
  const styles =
    state === "complete"
      ? "bg-success text-bg ring-success/20"
      : state === "active"
        ? "bg-ink text-bg ring-[rgb(var(--color-accent))]/40"
        : "bg-bg text-muted ring-line";

  return (
    <div className="relative shrink-0">
      <span
        className={cn(
          "relative z-10 grid size-11 place-items-center rounded-full ring-4 transition-colors md:size-[52px]",
          styles
        )}
      >
        <Icon className="size-[18px] md:size-5" strokeWidth={2} />
      </span>
      {state === "active" ? (
        <span
          aria-hidden
          className="absolute inset-0 z-0 animate-ping rounded-full bg-[rgb(var(--color-accent))]/25"
        />
      ) : null}
    </div>
  );
}

"use client";

import { Hammer, Sun, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Three operating principles — the brand's "promises behind the promise".
 *
 * Three is the conventional luxury copy count: enough to feel intentional,
 * few enough to remember. Each pillar carries a quiet line icon (lucide
 * outlines, never filled glyphs) to keep the page typographic-first.
 */
export function AboutPillars() {
  const { t } = useLocale();
  const items = [
    { icon: Hammer, title: t.about.pillar1Title, body: t.about.pillar1Body },
    { icon: Sun, title: t.about.pillar2Title, body: t.about.pillar2Body },
    { icon: Sparkles, title: t.about.pillar3Title, body: t.about.pillar3Body },
  ];
  return (
    <section className="bg-brand-soft/40 py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t.about.pillarsEyebrow}
          </p>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
          {items.map(({ icon: Icon, title, body }) => (
            <article key={title} className="space-y-4">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-bg text-accent shadow-card">
                <Icon className="size-5" />
              </span>
              <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">
                {title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

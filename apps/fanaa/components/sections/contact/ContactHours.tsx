"use client";

import { Clock, MapPin } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";

/**
 * Hours + address — quiet trust footer.
 *
 * Two cards, single icon each, never a map embed (maps slow the page
 * with a third-party iframe and rarely help — customers in KSA copy
 * the address into Maps themselves).
 */
export function ContactHours() {
  const { t } = useLocale();
  const items = [
    { icon: Clock, title: t.contact.hoursTitle, body: t.contact.hoursBody },
    { icon: MapPin, title: t.contact.addressTitle, body: t.contact.addressBody },
  ];
  return (
    <section className="bg-bg py-16 md:py-20">
      <Container>
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-md border border-line bg-bg p-5"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent">
                <Icon className="size-4" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  {title}
                </h3>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

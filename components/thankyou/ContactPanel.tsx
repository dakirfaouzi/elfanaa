"use client";

import Link from "next/link";
import { MessageCircle, Phone, ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";

type Props = {
  orderId: string;
};

/**
 * Contact + onward CTA panel — last block on the thank-you page.
 *
 * The two highest-value affordances post-purchase:
 *   1. WhatsApp — Saudi customers' default support channel. Prefilled with
 *      the order ID so the agent has context the moment they open the chat.
 *   2. Phone — for the 25% of customers who'd rather call (older demos /
 *      higher AOV / "I have a quick question").
 *
 * The "continue exploring" link is a quiet onward path — never prominent
 * enough to compete with the trust-building above it, but available for
 * customers who are ready to keep browsing.
 */
export function ContactPanel({ orderId }: Props) {
  const { t } = useLocale();

  const waMessage = encodeURIComponent(
    `${t.thankyou.orderIdLabel}: ${orderId}`
  );
  const waLink = `https://wa.me/${siteConfig.contact.whatsapp.replace(/\D/g, "")}?text=${waMessage}`;
  const telLink = `tel:${siteConfig.contact.phone.replace(/\s/g, "")}`;

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container size="md">
        <div className="space-y-8 rounded-md border border-line bg-surface p-8 text-center md:p-12">
          <header className="space-y-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t.thankyou.contactTitle}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-muted md:text-base">
              {t.thankyou.contactBody}
            </p>
          </header>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} />
              {t.thankyou.contactWhatsapp}
            </a>
            <a
              href={telLink}
              dir="ltr"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line bg-bg px-6 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              <Phone className="size-4" strokeWidth={1.75} />
              {t.thankyou.contactCall}
            </a>
          </div>

          <div className="border-t border-line pt-6">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 transition-colors hover:text-ink"
            >
              {t.thankyou.backToShop}
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

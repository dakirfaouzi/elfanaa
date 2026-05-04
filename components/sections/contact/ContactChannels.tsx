"use client";

import Link from "next/link";
import { MessageCircle, Phone, Mail, ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";

/**
 * Channel grid — three equal-weight cards.
 *
 * Each card carries:
 *   • Single line icon (lucide outline)
 *   • Title in the display face
 *   • One-sentence body in muted body face
 *   • A subtle CTA that doubles as the contact link
 *
 * Hover lifts the card with the brand's premium shadow tier
 * (`shadow-card`) — never colour-shifts; that breaks the calm.
 */
export function ContactChannels() {
  const { t } = useLocale();
  const waNumber = siteConfig.contact.whatsapp.replace(/[^0-9]/g, "");
  const phoneNumber = siteConfig.contact.phone.replace(/[^+0-9]/g, "");

  const channels = [
    {
      icon: MessageCircle,
      title: t.contact.whatsappTitle,
      body: t.contact.whatsappBody,
      cta: t.contact.whatsappCta,
      href: `https://wa.me/${waNumber}`,
      external: true,
    },
    {
      icon: Phone,
      title: t.contact.callTitle,
      body: t.contact.callBody,
      cta: t.contact.callCta,
      href: `tel:${phoneNumber}`,
      external: false,
    },
    {
      icon: Mail,
      title: t.contact.emailTitle,
      body: t.contact.emailBody,
      cta: t.contact.emailCta,
      href: `mailto:${siteConfig.contact.email}`,
      external: false,
    },
  ];

  return (
    <section className="bg-bg py-16 md:py-20">
      <Container>
        <div className="grid gap-5 md:grid-cols-3">
          {channels.map(({ icon: Icon, title, body, cta, href, external }) => (
            <Link
              key={title}
              href={href}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="group relative flex flex-col gap-4 rounded-md border border-line bg-bg p-7 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-accent">
                <Icon className="size-5" />
              </span>
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-3 text-sm font-medium text-ink">
                <span className="border-b border-ink/30 pb-0.5 transition-colors group-hover:border-ink">
                  {cta}
                </span>
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

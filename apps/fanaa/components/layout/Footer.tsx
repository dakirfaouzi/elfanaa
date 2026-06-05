"use client";

import { useState } from "react";
import Link from "next/link";
import { Instagram, Music2 } from "lucide-react";
import { Container } from "./Container";
import { PaymentMarks } from "./PaymentMarks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { collections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";

type SubscribeStatus = "idle" | "submitting" | "sent" | "error" | "invalid";

export function Footer() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscribeStatus>("idle");

  const onSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    const honeypot =
      (e.currentTarget.elements.namedItem("company") as HTMLInputElement | null)
        ?.value ?? "";
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company: honeypot }),
      });
      if (res.ok) {
        setStatus("sent");
        setEmail("");
      } else if (res.status === 422) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <footer className="mt-16 border-t border-line bg-surface md:mt-24">
      <Container>
        <div className="grid gap-8 py-10 md:gap-12 md:grid-cols-12 md:py-16">
          <div className="md:col-span-5">
            {/*
              The footer is a brand moment, so we use the full primary
              lockup (mark + wordmark + tagline). On phones the tagline
              collapses to the inline em-dash so the row never wraps
              awkwardly into three lines; on `sm+` the brass dash + tagline
              ride alongside the wordmark.
            */}
            <Logo
              variant="primary"
              size="md"
              tagline="inline"
              taglineClassName="hidden sm:inline"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              {t.footer.newsletterHint}
            </p>
            {/*
             * Stacked on mobile (full-width tap targets),
             * inline row from sm+ (space-efficient on tablet/desktop).
             */}
            <form
              className="mt-5 flex max-w-md flex-col gap-2.5 sm:flex-row sm:gap-2"
              onSubmit={onSubscribe}
            >
              {/* Honeypot — invisible to humans, catches bot submissions. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="hidden"
              />
              <Input
                type="email"
                required
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label={t.footer.emailPlaceholder}
                placeholder={t.footer.emailPlaceholder}
                className="flex-1"
                disabled={status === "submitting" || status === "sent"}
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full sm:w-auto"
                loading={status === "submitting"}
                disabled={status === "sent"}
              >
                {t.footer.subscribe}
              </Button>
            </form>
            {status !== "idle" && status !== "submitting" && (
              <p
                role="status"
                className={`mt-2.5 text-xs ${
                  status === "sent" ? "text-success" : "text-danger"
                }`}
              >
                {status === "sent"
                  ? t.footer.subscribed
                  : status === "invalid"
                    ? t.footer.subscribeInvalid
                    : t.footer.subscribeError}
              </p>
            )}

            <div className="mt-8 flex items-center gap-3">
              <a
                href={siteConfig.social.instagram}
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-brand-soft"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href={siteConfig.social.tiktok}
                aria-label="TikTok"
                className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-brand-soft"
                target="_blank"
                rel="noreferrer"
              >
                <Music2 className="size-4" />
              </a>
              <a
                href={siteConfig.social.snapchat}
                aria-label="Snapchat"
                className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-brand-soft"
                target="_blank"
                rel="noreferrer"
              >
                {/* lucide has no Snapchat brand mark — inline ghost glyph. */}
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  <path d="M12 2.2c2.6 0 4.3 1.9 4.4 4.5.02.5 0 1 .02 1.5.02.4.18.6.55.62.36.02.72-.16 1.05-.3.4-.16.83.02.93.42.08.34-.1.62-.42.78-.4.2-.86.32-1.27.5-.3.13-.36.36-.24.66.5 1.3 1.5 2.26 2.83 2.73.34.12.5.4.38.72-.22.6-1.26.96-2.06 1.16-.27.07-.36.2-.4.46-.05.36-.18.6-.6.6-.48 0-1-.16-1.5-.06-.5.1-.9.46-1.3.78-.5.4-1.04.74-1.8.74s-1.3-.34-1.8-.74c-.4-.32-.8-.68-1.3-.78-.5-.1-1.02.06-1.5.06-.42 0-.55-.24-.6-.6-.04-.26-.13-.4-.4-.46-.8-.2-1.84-.56-2.06-1.16-.12-.32.04-.6.38-.72 1.33-.47 2.33-1.43 2.83-2.73.12-.3.06-.53-.24-.66-.41-.18-.87-.3-1.27-.5-.32-.16-.5-.44-.42-.78.1-.4.53-.58.93-.42.33.14.69.32 1.05.3.37-.02.53-.22.55-.62.02-.5 0-1 .02-1.5C7.7 4.1 9.4 2.2 12 2.2z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterColumn title={t.footer.shop} className="md:col-span-2">
            <FooterLink href="/shop">{t.nav.shop}</FooterLink>
            {collections.map((c) => (
              <FooterLink key={c.id} href={`/collections/${c.slug}`}>
                {pickLocalized(c.title, locale)}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title={t.footer.help} className="md:col-span-2">
            <FooterLink href="/faq">{t.footer.faq}</FooterLink>
            <FooterLink href="/shipping">{t.footer.shipping}</FooterLink>
            <FooterLink href="/contact">{t.nav.contact}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t.footer.company} className="md:col-span-3">
            <FooterLink href="/about">{t.nav.about}</FooterLink>
            <FooterLink href="/privacy">{t.footer.privacy}</FooterLink>
            <FooterLink href="/terms">{t.footer.terms}</FooterLink>
          </FooterColumn>
        </div>

        {/*
         * Editorial closure — the gold dot-divider lifts the footer's
         * copyright row out of "generic Shopify footer" territory and
         * into the same editorial register as /sugarbear. Pure visual,
         * zero new dependencies.
         */}
        <div className="fn-dot-divider py-3" aria-hidden>
          <span />
        </div>

        {/*
         * Trust row — accepted payment marks + Saudi business identifiers.
         * VAT/CR are env-driven (`siteConfig.business`) and only render when
         * present, so no placeholder number ever ships to customers.
         */}
        <div className="flex flex-col gap-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              {t.footer.payments}
            </p>
            <PaymentMarks className="mt-2.5" />
          </div>

          {(siteConfig.business.vat || siteConfig.business.cr) && (
            <ul className="space-y-1 text-[11px] text-muted sm:text-end">
              {siteConfig.business.vat && (
                <li>
                  <span className="text-muted/70">{t.footer.vat}:</span>{" "}
                  <span className="tabular-nums" dir="ltr">
                    {siteConfig.business.vat}
                  </span>
                </li>
              )}
              {siteConfig.business.cr && (
                <li>
                  <span className="text-muted/70">{t.footer.cr}:</span>{" "}
                  <span className="tabular-nums" dir="ltr">
                    {siteConfig.business.cr}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-line/60 py-5 text-[11px] text-muted sm:flex-row sm:items-center sm:text-xs">
          <p>
            © {new Date().getFullYear()} {pickLocalized(siteConfig.name, locale)} —{" "}
            {t.footer.rights}
          </p>
          <p className="tabular-nums">{siteConfig.contact.email}</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="transition-colors hover:text-ink">
        {children}
      </Link>
    </li>
  );
}

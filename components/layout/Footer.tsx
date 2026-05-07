"use client";

import Link from "next/link";
import { Instagram, Music2 } from "lucide-react";
import { Container } from "./Container";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { collections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";

export function Footer() {
  const { locale, t } = useLocale();

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
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <Input
                type="email"
                required
                aria-label={t.footer.emailPlaceholder}
                placeholder={t.footer.emailPlaceholder}
                className="flex-1"
              />
              <Button type="submit" variant="primary" className="w-full sm:w-auto">
                {t.footer.subscribe}
              </Button>
            </form>

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
            </div>
          </div>

          <FooterColumn title={t.footer.shop} className="md:col-span-2">
            <FooterLink href="/shop">{t.nav.shop}</FooterLink>
            {collections.map((c) => (
              <FooterLink key={c.id} href={`/shop?collection=${c.slug}`}>
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

        <div className="flex flex-col items-start justify-between gap-3 border-t border-line py-5 text-[11px] text-muted sm:flex-row sm:items-center sm:text-xs">
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

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Menu, Search } from "lucide-react";
import { Container } from "./Container";
import { CartTrigger } from "@/components/cart/CartTrigger";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { useUI } from "@/hooks/useUI";
import { collections, concernCollections, genderCollections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";

const SCROLL_TRIGGER_PX = 8;

/**
 * Sticky brand header with a desktop mega menu.
 *
 * Mega menu opens on hover/focus of "المتجر" and closes when the
 * mouse leaves the header or Escape is pressed. A 120ms grace
 * period prevents accidental dismissal when moving between trigger
 * and panel.
 */
export function Header() {
  const { locale, t } = useLocale();
  const openMobileNav = useUI((s) => s.openMobileNav);
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_TRIGGER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMegaOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [megaOpen]);

  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };

  const scheduleMegaClose = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 120);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled
          ? "border-line bg-bg/85 backdrop-blur-md"
          : "border-transparent bg-bg"
      )}
    >
      <Container>
        <div className="flex h-16 items-center gap-4 lg:h-[76px]">
          {/* Mobile menu trigger */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMobileNav}
            className="grid size-10 place-items-center rounded-full hover:bg-brand-soft md:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Logo variant="primary" size="md" tagline="hidden" />

          {/* Desktop primary nav */}
          <nav
            aria-label="Primary"
            className="ms-6 hidden items-center gap-1 md:flex"
          >
            {/* Shop — mega menu trigger */}
            <div
              className="relative"
              onMouseEnter={openMega}
              onMouseLeave={scheduleMegaClose}
            >
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={megaOpen}
                onClick={() => setMegaOpen((o) => !o)}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  megaOpen
                    ? "bg-brand-soft text-ink"
                    : "text-ink/75 hover:bg-brand-soft hover:text-ink"
                )}
              >
                {t.nav.shop}
              </button>
            </div>

            {/* Static collection shortcuts */}
            {collections.slice(0, 3).map((c) => (
              <NavLink
                key={c.id}
                href={`/shop?collection=${c.slug}`}
                title={c.tagline ? pickLocalized(c.tagline, locale) : undefined}
              >
                {pickLocalized(c.title, locale)}
              </NavLink>
            ))}

            <NavLink href="/about">{t.nav.about}</NavLink>
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              aria-label={t.nav.search}
              disabled
              aria-disabled="true"
              className="hidden size-10 cursor-not-allowed place-items-center rounded-full opacity-40 sm:grid"
            >
              <Search className="size-5" />
            </button>
            <LocaleSwitcher />
            <CartTrigger />
          </div>
        </div>
      </Container>

      {/*
       * Mega menu panel — always rendered on md+ for smooth CSS transitions.
       * Fully excluded from layout on mobile via `hidden md:block` so the
       * fixed-column grid inside never contributes to mobile scroll width.
       */}
      <div
        onMouseEnter={openMega}
        onMouseLeave={scheduleMegaClose}
        aria-hidden={!megaOpen}
        className={cn(
          "absolute inset-x-0 top-full z-50 hidden border-b border-line bg-bg/98 shadow-elevated backdrop-blur-md md:block",
          "transition-[opacity,transform] duration-[220ms] ease-premium",
          megaOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        )}
        role="navigation"
        aria-label="Shop menu"
      >
        <Container>
            {/* Three-column editorial mega menu */}
          <div className="grid grid-cols-[1fr_1px_1fr_1px_224px] gap-0 py-6">

              {/* Col 1 — main collections — stagger delay 0ms */}
              <div
                className={cn(
                  "pe-8 transition-[opacity,transform] duration-300 ease-premium",
                  megaOpen ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
                )}
                style={{ transitionDelay: megaOpen ? "40ms" : "0ms" }}
              >
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t.nav.megaCollections}
                </p>
                <div className="grid gap-0.5">
                  {collections.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/collections/${c.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-start gap-3.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-soft"
                    >
                      <span className="mt-0.5 w-5 shrink-0 text-[10px] font-medium tabular-nums text-muted/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[15px] font-semibold leading-tight text-ink"
                          dir="rtl"
                        >
                          {pickLocalized(c.title, locale)}
                        </p>
                        {c.tagline && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            {pickLocalized(c.tagline, locale)}
                          </p>
                        )}
                      </div>
                      <span className="mt-0.5 shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                        ←
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  <Link
                    href="/shop"
                    onClick={() => setMegaOpen(false)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t.nav.megaExplore} ←
                  </Link>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-8 bg-line" />

              {/* Col 2 — concerns — stagger delay 80ms */}
              <div
                className={cn(
                  "px-8 transition-[opacity,transform] duration-300 ease-premium",
                  megaOpen ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
                )}
                style={{ transitionDelay: megaOpen ? "110ms" : "0ms" }}
              >
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {t.nav.megaBrowseConcern}
                </p>
                <div className="grid gap-0.5">
                  {concernCollections.map((c) => (
                    <Link
                      key={c.id}
                      href={`/concerns/${c.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-brand-soft"
                    >
                      <div>
                        <span
                          className="text-[13px] font-medium text-ink"
                          dir="rtl"
                        >
                          {pickLocalized(c.title, locale)}
                        </span>
                        {c.tagline && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            {pickLocalized(c.tagline, locale)}
                          </p>
                        )}
                      </div>
                      <span className="ms-3 shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                        ←
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {t.nav.megaBrowseGender}
                  </p>
                  <div className="flex gap-4">
                    {genderCollections.map((c) => (
                      <Link
                        key={c.id}
                        href={`/for/${c.slug}`}
                        onClick={() => setMegaOpen(false)}
                        className="text-[13px] font-medium text-ink/65 transition-colors hover:text-ink"
                      >
                        {pickLocalized(c.title, locale)}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-6 bg-line" />

              {/* Col 3 — brand panel — stagger delay 160ms */}
              <div
                className={cn(
                  "flex flex-col justify-between rounded-xl bg-ink px-5 py-5",
                  "transition-[opacity,transform] duration-300 ease-premium",
                  megaOpen ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
                )}
                style={{ transitionDelay: megaOpen ? "180ms" : "0ms" }}
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-bg/30">
                  فناء
                </span>
                <div>
                  <h3
                    className="font-display text-[19px] font-semibold leading-[1.15] text-bg"
                    dir="rtl"
                  >
                    {"علاج حقيقي.\nنتائج مثبتة."}
                  </h3>
                  <p className="mt-3 text-[11px] leading-[1.75] text-bg/48">
                    {locale === "ar"
                      ? "كل منتج مبني على مكوّن فعّال بنسبة علاجية"
                      : "Every product built on a therapeutic-dose active"}
                  </p>
                </div>
                <Link
                  href="/shop"
                  onClick={() => setMegaOpen(false)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent transition-colors hover:text-accent/75"
                >
                  {t.nav.megaExplore}
                  <ArrowLeft className="size-3" />
                </Link>
              </div>
            </div>
          </Container>
        </div>
    </header>
  );
}

function NavLink({
  href,
  title,
  children,
}: {
  href: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className="rounded-full px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-brand-soft hover:text-ink"
    >
      {children}
    </Link>
  );
}

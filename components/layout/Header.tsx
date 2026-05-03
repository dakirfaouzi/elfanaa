"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { Container } from "./Container";
import { CartTrigger } from "@/components/cart/CartTrigger";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { useUI } from "@/hooks/useUI";
import { collections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";

const SCROLL_TRIGGER_PX = 8;

/**
 * Sticky brand header.
 *
 * Brand-surface choice: the **simplified primary lockup** — mark + wordmark,
 * with the tagline hidden. The header is a navigation utility first; the
 * tagline lives in the hero and the footer where the brand has room to
 * breathe. Keeping it lean here ensures the 64–76px bar stays readable
 * with the nav, search, locale, and cart all coexisting.
 */
export function Header() {
  const { locale, t } = useLocale();
  const openMobileNav = useUI((s) => s.openMobileNav);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_TRIGGER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMobileNav}
            className="grid size-10 place-items-center rounded-full hover:bg-brand-soft md:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Logo variant="primary" size="md" tagline="hidden" />

          <nav
            aria-label="Primary"
            className="ms-6 hidden items-center gap-1 md:flex"
          >
            <NavLink href="/shop">{t.nav.shop}</NavLink>
            {/* Cap nav at 3 collections — Pottery Barn redesign research:
                cutting nav from 10 → 5 items lifts findability the most. */}
            {collections.slice(0, 3).map((c) => (
              <NavLink key={c.id} href={`/shop?collection=${c.slug}`}>
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
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-brand-soft hover:text-ink"
    >
      {children}
    </Link>
  );
}

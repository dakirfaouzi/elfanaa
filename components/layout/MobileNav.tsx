"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import { collections, concernCollections, genderCollections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Mobile slide-in navigation.
 *
 * Architecture: three-tier discovery
 *   1. Main collections  (المجموعات)      — the three catalog sections
 *   2. Browse by concern (حسب مشكلتك)    — problem-first entry points
 *   3. By gender         (حسب الجنس)      — gender-targeted collections
 *   4. Brand links       (حكايتنا / تواصل)
 *
 * `side="start"` attaches to the logical-start edge — right in RTL (Arabic),
 * left in LTR (English). No extra RTL logic needed here.
 */
export function MobileNav() {
  const mobileNavOpen = useUI((s) => s.mobileNavOpen);
  const closeMobileNav = useUI((s) => s.closeMobileNav);
  const { locale, t } = useLocale();

  return (
    <Drawer
      open={mobileNavOpen}
      onClose={closeMobileNav}
      side="start"
      widthClassName="w-72 sm:w-80"
      title={t.common.brand}
    >
      <nav aria-label="Mobile primary" className="flex flex-col py-2">

        {/* ── Section 1: Main collections ── */}
        <SectionLabel>{t.nav.megaCollections}</SectionLabel>
        {collections.slice(0, 3).map((c) => (
          <NavItem
            key={c.id}
            href={`/shop?collection=${c.slug}`}
            onClick={closeMobileNav}
            indent
            tagline={c.tagline ? pickLocalized(c.tagline, locale) : undefined}
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}
        <NavItem href="/shop" onClick={closeMobileNav} indent>
          {locale === "ar" ? "كل المنتجات" : "All products"}
        </NavItem>

        <Separator />

        {/* ── Section 2: Browse by concern ── */}
        <SectionLabel>{t.nav.megaBrowseConcern}</SectionLabel>
        {concernCollections.map((c) => (
          <NavItem
            key={c.id}
            href={`/concerns/${c.slug}`}
            onClick={closeMobileNav}
            indent
            tagline={c.tagline ? pickLocalized(c.tagline, locale) : undefined}
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}

        <Separator />

        {/* ── Section 3: By gender ── */}
        <SectionLabel>{t.nav.megaBrowseGender}</SectionLabel>
        {genderCollections.map((c) => (
          <NavItem
            key={c.id}
            href={`/for/${c.slug}`}
            onClick={closeMobileNav}
            indent
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}

        <Separator />

        {/* ── Section 4: Brand links ── */}
        <NavItem href="/about" onClick={closeMobileNav}>
          {t.nav.about}
        </NavItem>
        <NavItem href="/contact" onClick={closeMobileNav}>
          {t.nav.contact}
        </NavItem>
      </nav>

      {/* Locale switcher pinned to drawer bottom */}
      <div className="border-t border-line px-5 py-4">
        <LocaleSwitcher />
      </div>
    </Drawer>
  );
}

/* ─── Sub-components ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pb-1.5 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {children}
      </p>
    </div>
  );
}

function Separator() {
  return <div className="my-2 border-t border-line" />;
}

function NavItem({
  href,
  onClick,
  indent = false,
  tagline,
  children,
}: {
  href: string;
  onClick: () => void;
  indent?: boolean;
  tagline?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex flex-col py-2.5 transition-colors hover:bg-brand-soft",
        indent ? "px-8" : "px-5"
      )}
    >
      <span className="text-[15px] font-medium text-ink/85">{children}</span>
      {tagline ? (
        <span className="mt-0.5 text-[11px] text-muted">{tagline}</span>
      ) : null}
    </Link>
  );
}

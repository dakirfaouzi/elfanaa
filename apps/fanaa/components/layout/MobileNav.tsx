"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import { collections, concernCollections, genderCollections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";
import { isPathActive } from "@/lib/nav/active";
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
  const pathname = usePathname();

  return (
    <Drawer
      open={mobileNavOpen}
      onClose={closeMobileNav}
      side="start"
      widthClassName="w-[min(288px,85vw)] sm:w-80"
      title={t.common.brand}
    >
      <nav aria-label="Mobile primary" className="flex flex-col py-1">

        {/* ── Section 1: Main collections ── */}
        <SectionLabel>{t.nav.megaCollections}</SectionLabel>
        {collections.slice(0, 3).map((c) => (
          <NavItem
            key={c.id}
            href={`/collections/${c.slug}`}
            onClick={closeMobileNav}
            indent
            active={isPathActive(pathname, `/collections/${c.slug}`)}
            tagline={c.tagline ? pickLocalized(c.tagline, locale) : undefined}
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}
        <NavItem
          href="/shop"
          onClick={closeMobileNav}
          indent
          active={isPathActive(pathname, "/shop")}
        >
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
            active={isPathActive(pathname, `/concerns/${c.slug}`)}
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
            active={isPathActive(pathname, `/for/${c.slug}`)}
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}

        <Separator />

        {/* ── Section 4: Brand links ── */}
        <NavItem
          href="/about"
          onClick={closeMobileNav}
          active={isPathActive(pathname, "/about")}
        >
          {t.nav.about}
        </NavItem>
        <NavItem
          href="/contact"
          onClick={closeMobileNav}
          active={isPathActive(pathname, "/contact")}
        >
          {t.nav.contact}
        </NavItem>
      </nav>

      {/* Locale switcher pinned to drawer bottom — safe-area for notched phones */}
      <div
        className="border-t border-line px-5 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <LocaleSwitcher />
      </div>
    </Drawer>
  );
}

/* ─── Sub-components ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pb-1.5 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        {children}
      </p>
    </div>
  );
}

function Separator() {
  return <div className="mx-5 my-1 border-t border-line" />;
}

function NavItem({
  href,
  onClick,
  indent = false,
  active = false,
  tagline,
  children,
}: {
  href: string;
  onClick: () => void;
  indent?: boolean;
  active?: boolean;
  tagline?: string;
  children: React.ReactNode;
}) {
  return (
    /*
     * min-h-[44px] enforces Apple/Material 44px minimum touch target.
     * `active:bg-brand-soft` provides instant tactile press feedback
     * on touch devices without needing JS state.
     */
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] flex-col justify-center py-3 transition-colors",
        active ? "bg-brand-soft" : "hover:bg-brand-soft active:bg-brand-soft/70",
        indent ? "px-8" : "px-5"
      )}
    >
      <span
        className={cn(
          "text-[15px] font-medium leading-snug",
          active ? "text-ink" : "text-ink/85"
        )}
      >
        {children}
      </span>
      {tagline ? (
        <span className="mt-0.5 text-[11px] leading-snug text-muted">
          {tagline}
        </span>
      ) : null}
    </Link>
  );
}

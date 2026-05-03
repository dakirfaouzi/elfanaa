"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useUI } from "@/hooks/useUI";
import { useLocale } from "@/hooks/useLocale";
import { collections } from "@/data/collections";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Mobile slide-in navigation driven by `useUI.mobileNavOpen`.
 *
 * `side="start"` means the panel attaches to the logical-start edge —
 * left in LTR (English), right in RTL (Arabic). Drawer.tsx already
 * handles the translate-x mirror, so no extra RTL logic is needed here.
 *
 * Each link closes the drawer on click so the user lands on the new
 * page with a clean, overlay-free viewport.
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
      <nav aria-label="Mobile primary" className="flex flex-col py-4">
        <NavItem href="/shop" onClick={closeMobileNav}>
          {t.nav.shop}
        </NavItem>

        {/* Collection shortcuts — mirrors the 3-item cap in Header.tsx */}
        <div className="px-5 pb-1 pt-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            {t.nav.collections}
          </p>
        </div>
        {collections.slice(0, 3).map((c) => (
          <NavItem
            key={c.id}
            href={`/shop?collection=${c.slug}`}
            onClick={closeMobileNav}
            indent
          >
            {pickLocalized(c.title, locale)}
          </NavItem>
        ))}

        <div className="my-3 border-t border-line" />

        <NavItem href="/about" onClick={closeMobileNav}>
          {t.nav.about}
        </NavItem>
        <NavItem href="/contact" onClick={closeMobileNav}>
          {t.nav.contact}
        </NavItem>
      </nav>

      {/* Locale switcher lives at the bottom of the drawer body */}
      <div className="border-t border-line px-5 py-4">
        <LocaleSwitcher />
      </div>
    </Drawer>
  );
}

function NavItem({
  href,
  onClick,
  indent = false,
  children,
}: {
  href: string;
  onClick: () => void;
  indent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center py-3 text-base font-medium text-ink/80 transition-colors hover:bg-brand-soft hover:text-ink",
        indent ? "px-8" : "px-5"
      )}
    >
      {children}
    </Link>
  );
}

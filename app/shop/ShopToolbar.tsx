"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Collection } from "@/lib/types";

export type ShopSort = "recommended" | "best" | "price-asc" | "price-desc";

type Props = {
  collections: Collection[];
  /** Currently selected collection slug ("" for "all"). */
  active?: string;
  sort: ShopSort;
  onSortChange: (s: ShopSort) => void;
};

/**
 * Shop toolbar — collection chips (left) + sort dropdown (right).
 *
 * Filter pattern: anchor chips, not a sidebar facet. With ≤ 5
 * collections this is the calmer, more shoppable choice (BigCommerce's
 * 2024 facet study: ≤6 categories convert ~12% better with chip nav vs.
 * a left rail).
 *
 * The active chip is the only one with an `aria-current` and an inked
 * background — gives the customer a single visual anchor.
 */
export function ShopToolbar({ collections, active, sort, onSortChange }: Props) {
  const { t, locale } = useLocale();
  const sortOptions: { value: ShopSort; label: string }[] = [
    { value: "recommended", label: t.shop.sortRecommended },
    { value: "best", label: t.shop.sortBestSelling },
    { value: "price-asc", label: t.shop.sortPriceLow },
    { value: "price-desc", label: t.shop.sortPriceHigh },
  ];

  return (
    <div className="sticky top-16 z-20 border-b border-line bg-bg/95 backdrop-blur-md lg:top-[76px]">
      <div className="mx-auto flex max-w-content items-center gap-3 px-6 py-3">
        <ChipNav collections={collections} active={active} />
        <div className="ms-auto">
          <SortDropdown options={sortOptions} value={sort} onChange={onSortChange} />
        </div>
      </div>
    </div>
  );

  function ChipNav({
    collections,
    active,
  }: {
    collections: Collection[];
    active?: string;
  }) {
    const list = [
      { slug: "", label: t.shop.filterAll },
      ...collections.map((c) => ({ slug: c.slug, label: pickLocalized(c.title, locale) })),
    ];
    return (
      <nav
        aria-label="Collection filter"
        className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-none"
      >
        {list.map((item) => {
          const selected = (active ?? "") === item.slug;
          const href = item.slug ? `/shop?collection=${item.slug}` : "/shop";
          return (
            <Link
              key={item.slug || "all"}
              href={href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium transition-colors",
                selected
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink/80 hover:border-ink/40 hover:bg-brand-soft hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }
}

function SortDropdown({
  options,
  value,
  onChange,
}: {
  options: { value: ShopSort; label: string }[];
  value: ShopSort;
  onChange: (v: ShopSort) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-medium text-ink/80 transition-colors hover:border-ink/40 hover:text-ink"
      >
        <span className="hidden sm:inline">{t.shop.sortLabel} ·</span>
        <span className="text-ink">{current.label}</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t.shop.sortLabel}
          className="absolute end-0 mt-2 w-56 overflow-hidden rounded-md border border-line bg-bg shadow-elevated"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[13px] transition-colors",
                    selected ? "bg-brand-soft text-ink" : "text-ink/85 hover:bg-brand-soft"
                  )}
                >
                  <span>{o.label}</span>
                  {selected ? <Check className="size-3.5 text-ink" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

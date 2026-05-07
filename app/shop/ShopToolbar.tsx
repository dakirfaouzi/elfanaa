"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Collection, FilterOptions, FilterState } from "@/lib/types";
import { emptyFilterState } from "@/lib/types";

export type ShopSort = "recommended" | "best" | "price-asc" | "price-desc";

type Props = {
  collections: Collection[];
  /** Currently selected collection slug ("" for "all"). */
  active?: string;
  sort: ShopSort;
  onSortChange: (s: ShopSort) => void;
  filters: FilterState;
  filterOptions: FilterOptions;
  onFiltersChange: (f: FilterState) => void;
  /**
   * When false, the collection chip nav is hidden.
   * Used on dedicated collection / concern / gender pages where the
   * collection context is already set by the URL — chips would be redundant.
   * Defaults to true.
   */
  showCollectionNav?: boolean;
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
export function ShopToolbar({
  collections,
  active,
  sort,
  onSortChange,
  filters,
  filterOptions,
  onFiltersChange,
  showCollectionNav = true,
}: Props) {
  const { t, locale } = useLocale();
  const [filterOpen, setFilterOpen] = useState(false);

  const sortOptions: { value: ShopSort; label: string }[] = [
    { value: "recommended", label: t.shop.sortRecommended },
    { value: "best", label: t.shop.sortBestSelling },
    { value: "price-asc", label: t.shop.sortPriceLow },
    { value: "price-desc", label: t.shop.sortPriceHigh },
  ];

  const activeCount =
    filters.productTypes.length + filters.targets.length + filters.problems.length;

  const hasFilterOptions =
    filterOptions.productTypes.length > 0 ||
    filterOptions.targets.length > 0 ||
    filterOptions.problems.length > 0;

  const toggle = (dim: keyof FilterState, value: string) => {
    const current = filters[dim] as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [dim]: next });
  };

  return (
    <div className="sticky top-16 z-20 border-b border-line bg-bg/95 backdrop-blur-md lg:top-[76px]">
      {/* Main toolbar row */}
      <div className="mx-auto flex max-w-content items-center gap-3 px-6 py-3">
        {showCollectionNav && <ChipNav collections={collections} active={active} />}
        <div className="ms-auto flex items-center gap-2">
          {hasFilterOptions && (
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                filterOpen || activeCount > 0
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink/80 hover:border-ink/40 hover:text-ink"
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">{t.shop.filterLabel}</span>
              {activeCount > 0 && (
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                    filterOpen || activeCount > 0 ? "bg-bg text-ink" : "bg-ink text-bg"
                  )}
                >
                  {activeCount}
                </span>
              )}
            </button>
          )}
          <SortDropdown options={sortOptions} value={sort} onChange={onSortChange} />
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && hasFilterOptions && (
        <FilterPanel
          filterOptions={filterOptions}
          filters={filters}
          activeCount={activeCount}
          onToggle={toggle}
          onClear={() => onFiltersChange(emptyFilterState)}
          t={t}
          locale={locale}
        />
      )}
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
      { slug: "", label: t.shop.filterAll, tagline: undefined as string | undefined },
      ...collections.map((c) => ({
        slug: c.slug,
        label: pickLocalized(c.title, locale),
        tagline: c.tagline ? pickLocalized(c.tagline, locale) : undefined,
      })),
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
                "inline-flex shrink-0 flex-col rounded-full border px-4 py-1.5 transition-colors",
                item.tagline ? "items-start" : "items-center justify-center",
                selected
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink/80 hover:border-ink/40 hover:bg-brand-soft hover:text-ink"
              )}
            >
              <span className="text-[13px] font-medium leading-tight">{item.label}</span>
              {item.tagline ? (
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    selected ? "text-bg/70" : "text-muted"
                  )}
                >
                  {item.tagline}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }
}

/* ----------------------------- Filter panel ----------------------------- */

function FilterPanel({
  filterOptions,
  filters,
  activeCount,
  onToggle,
  onClear,
  t,
  locale,
}: {
  filterOptions: FilterOptions;
  filters: FilterState;
  activeCount: number;
  onToggle: (dim: keyof FilterState, value: string) => void;
  onClear: () => void;
  t: ReturnType<typeof useLocale>["t"];
  locale: string;
}) {
  const groups: {
    dim: keyof FilterState;
    label: string;
    options: FilterOptions[keyof FilterOptions];
  }[] = [
    { dim: "productTypes", label: t.shop.filterProductType, options: filterOptions.productTypes },
    { dim: "targets", label: t.shop.filterTarget, options: filterOptions.targets },
    { dim: "problems", label: t.shop.filterProblem, options: filterOptions.problems },
  ].filter((g) => g.options.length > 0);

  return (
    <div className="border-t border-line">
      <div className="mx-auto max-w-content px-6 py-4">
        <div className="flex flex-wrap gap-6">
          {groups.map((group) => (
            <div key={group.dim} className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const active = (filters[group.dim] as string[]).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggle(group.dim, opt.value)}
                      className={cn(
                        "inline-flex flex-col items-start rounded-full border px-3 py-1 transition-colors",
                        active
                          ? "border-ink bg-ink text-bg"
                          : "border-line text-ink/80 hover:border-ink/40 hover:bg-brand-soft hover:text-ink"
                      )}
                    >
                      <span className="text-[12px] font-medium leading-tight" dir="rtl">
                        {pickLocalized(opt.label, locale)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {activeCount > 0 && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-muted transition-colors hover:text-danger"
              >
                <X className="size-3" />
                {t.shop.filterClearAll}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

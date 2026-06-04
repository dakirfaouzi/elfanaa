"use client";

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { BrandMark } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";

/**
 * 404 — quiet, brand-coherent, and localized.
 *
 * One mark, one number, one short sentence, one CTA. Copy reads from the
 * dictionary via `useLocale` (the page renders inside `LocaleProvider`), so the
 * Arabic-first storefront stays Arabic-first even on its error boundary.
 */
export default function NotFound() {
  const { t } = useLocale();
  return (
    <Container>
      <div className="grid place-items-center py-32 text-center">
        <BrandMark size={56} className="text-accent" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {t.notFound.code}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
          {t.notFound.title}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">{t.notFound.body}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-md bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
        >
          {t.notFound.back}
        </Link>
      </div>
    </Container>
  );
}

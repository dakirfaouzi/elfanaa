import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { BrandMark } from "@/components/brand";

/**
 * 404 — quiet, brand-coherent.
 *
 * One mark, one number, one short sentence, one CTA. The 404 should feel
 * like the same brand that owns the hero, not a stock framework page.
 */
export default function NotFound() {
  return (
    <Container>
      <div className="grid place-items-center py-32 text-center">
        <BrandMark size={56} className="text-accent" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          404
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          The page you were looking for has moved or never existed.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-md bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink/90"
        >
          Back to home
        </Link>
      </div>
    </Container>
  );
}

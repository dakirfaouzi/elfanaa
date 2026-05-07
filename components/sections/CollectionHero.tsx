import Image from "next/image";
import { Container } from "@/components/layout/Container";
import type { Collection, CollectionType } from "@/lib/types";

type Props = {
  collection: Collection;
  itemCount: number;
  eyebrow: string;
  itemsLabel: string;
};

const typeIndex: Record<Exclude<CollectionType, undefined>, string> = {
  main: "01",
  concern: "02",
  gender: "03",
  ritual: "04",
  seasonal: "05",
  ingredient: "06",
  promo: "07",
};

/**
 * Cinematic editorial hero for /collections/*, /concerns/*, /for/*.
 *
 * Design direction: Aesop × Jacquemus × Saudi luxury editorial.
 *
 * Visual system:
 *   - Full-bleed image at 100% opacity (not washed-out)
 *   - Three-layer gradient: top scrim + bottom legibility zone + corner vignette
 *   - Eyebrow anchored to the top of the frame
 *   - Title + supporting copy anchored to the bottom
 *   - No decorative clutter — image and typography do all the work
 */
export function CollectionHero({
  collection,
  itemCount,
  eyebrow,
  itemsLabel,
}: Props) {
  const hasImage = Boolean(collection.heroImage);
  const typeKey = (collection.type ?? "main") as Exclude<CollectionType, undefined>;
  const index = typeIndex[typeKey];

  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="relative h-[76vh] min-h-[540px] w-full md:h-[88vh] md:min-h-[680px]">

        {/* ── Full-bleed editorial image ── */}
        {hasImage ? (
          <Image
            src={collection.heroImage!}
            alt={collection.title.ar}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : (
          /* Brand-tone fallback: warm amber glow on dark canvas */
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 25% 75%, rgba(186,110,92,0.22) 0%, transparent 68%)",
            }}
          />
        )}

        {/* ── Three-layer gradient system ─────────────────────────── */}
        {/* 1 · Top scrim — controls overly bright skies + frames the header */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/45 via-transparent to-transparent" />
        {/* 2 · Bottom gradient — primary text legibility zone */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/50 to-transparent" />
        {/* 3 · Corner vignette — editorial depth, pulls focus inward */}
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/60 via-ink/10 to-transparent" />

        {/* ── Content ─────────────────────────────────────────────── */}
        <Container
          size="xl"
          className="relative flex h-full flex-col justify-between py-10 md:py-14 lg:py-16"
        >
          {/* Eyebrow — anchored top, first to appear */}
          <div
            className="animate-rise flex items-center gap-3"
            style={{ animationDelay: "80ms" }}
          >
            <span className="text-[10px] font-medium tabular-nums text-bg/30">
              {index}
            </span>
            <span className="h-px w-6 bg-bg/20" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bg/55">
              {eyebrow}
            </span>
          </div>

          {/* Text block — anchored bottom, staggered rise */}
          <div>
            {/* Arabic title */}
            <h1
              className="animate-rise font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-bg md:text-5xl lg:text-6xl"
              dir="rtl"
              style={{ animationDelay: "220ms" }}
            >
              {collection.title.ar}
            </h1>

            {/* Tagline */}
            {collection.tagline && (
              <p
                className="animate-rise mt-3 text-[14px] font-medium text-bg/58 md:text-[15px]"
                style={{ animationDelay: "370ms" }}
              >
                {collection.tagline.ar}
              </p>
            )}

            {/* Separator */}
            <div
              className="animate-rise mt-6 h-px w-10 bg-bg/18"
              aria-hidden
              style={{ animationDelay: "460ms" }}
            />

            {/* Description + item count row */}
            <div
              className="animate-rise mt-5 flex items-end justify-between gap-8"
              style={{ animationDelay: "520ms" }}
            >
              {collection.description ? (
                <p
                  className="max-w-md text-[13px] leading-[1.8] text-bg/48 md:text-sm"
                  dir="rtl"
                >
                  {collection.description.ar}
                </p>
              ) : (
                <span />
              )}
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-bg/32">
                {itemsLabel.replace("{count}", String(itemCount))}
              </span>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}

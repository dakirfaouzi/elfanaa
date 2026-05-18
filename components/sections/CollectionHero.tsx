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
      <div className="relative h-[64vh] min-h-[440px] w-full md:h-[80vh] md:min-h-[620px] lg:h-[88vh] lg:min-h-[680px]">

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
          /* Brand-tone fallback: warm champagne glow on espresso canvas */
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 25% 75%, rgba(199,162,124,0.32) 0%, transparent 68%)",
            }}
          />
        )}

        {/* ── Editorial overlay system — warm-toned, not generic dark ─
         * 1 · Soft top scrim — lets the imagery breathe at the top
         * 2 · Bottom espresso wash — primary legibility zone for title
         * 3 · Top-right gold whisper — pulls champagne into the corner
         */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/40 to-transparent" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(45% 35% at 92% 10%, rgba(199,162,124,0.28) 0%, transparent 60%)",
          }}
        />

        {/* ── Content ─────────────────────────────────────────────── */}
          <Container
          size="xl"
          className="relative flex h-full flex-col justify-between py-8 md:py-14 lg:py-16"
        >
          {/* Eyebrow — anchored top, first to appear, gold-accented */}
          <div
            className="animate-rise flex items-center gap-3"
            style={{ animationDelay: "80ms" }}
          >
            <span className="font-display text-[12px] italic tabular-nums text-accent/85">
              {index}
            </span>
            <span
              aria-hidden
              className="h-px w-7"
              style={{
                background:
                  "linear-gradient(90deg, rgba(199,162,124,0.55), rgba(199,162,124,0))",
              }}
            />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-bg/72">
              {eyebrow}
            </span>
          </div>

          {/* Text block — anchored bottom, staggered rise */}
          <div>
            {/* Arabic title */}
            <h1
              className="animate-rise font-display text-[34px] font-semibold leading-[1.03] tracking-[-0.02em] text-bg md:text-5xl lg:text-6xl"
              dir="rtl"
              style={{ animationDelay: "220ms" }}
            >
              {collection.title.ar}
            </h1>

            {/* Tagline */}
            {collection.tagline && (
              <p
                className="animate-rise mt-3 text-[14.5px] font-medium text-bg/65 md:text-[16px]"
                style={{ animationDelay: "370ms" }}
              >
                {collection.tagline.ar}
              </p>
            )}

            {/* Gold separator — the editorial closure beat */}
            <div
              className="animate-rise mt-6 h-px w-12"
              aria-hidden
              style={{
                animationDelay: "460ms",
                background:
                  "linear-gradient(90deg, rgba(199,162,124,0.65), rgba(199,162,124,0))",
              }}
            />

            {/* Description + item count row — stacked on mobile, inline on sm+ */}
            <div
              className="animate-rise mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8"
              style={{ animationDelay: "520ms" }}
            >
              {collection.description ? (
                <p
                  className="text-[13px] leading-[1.8] text-bg/58 sm:max-w-md md:text-[14.5px]"
                  dir="rtl"
                >
                  {collection.description.ar}
                </p>
              ) : (
                <span />
              )}
              <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-bg/45">
                {itemsLabel.replace("{count}", String(itemCount))}
              </span>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}

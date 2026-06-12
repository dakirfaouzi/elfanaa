"use client";

import Link from "next/link";
import { getImageProps } from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { Pause, Play } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/cn";

/* ───────────────────────────── Slide content ─────────────────────────────
 *
 * The hero is a mobile-first social-creative carousel. Each slide is a
 * finished campaign image with its own headline, body, and CTA *baked
 * into the artwork* — produced as social-ad creatives because all traffic
 * arrives from social (Instagram / TikTok / Snapchat) on phones.
 *
 * Two dedicated, art-directed creatives per slide:
 *   • Mobile (<768px): a 9:16 portrait creative (576×1024).
 *   • Tablet/Desktop (≥768px): a 16:9 landscape creative (1024×576) with
 *     its own composition + text placement.
 * We use a native `<picture>` with a `(min-width: 768px)` source so the
 * browser downloads ONLY the creative that matches the viewport — never
 * both — and never scales one ratio's art to fit the other.
 *
 * Consequences for this component:
 *   • We do NOT render an editorial text overlay — the copy already lives
 *     in the image. Painting React text on top would duplicate it.
 *   • Each slide is a single tap target (`<Link>`) pointing at the route
 *     its baked CTA implies, so the whole creative is actionable.
 *   • `alt` carries the campaign meaning for screen readers / SEO since the
 *     headline is pixels, not text.
 *
 * Logic surface untouched: no fetch, no analytics, no cart/checkout —
 * routing only, to existing routes.
 * ────────────────────────────────────────────────────────────────────── */

type Bilingual = { ar: string; en: string };

type Slide = {
  id: string;
  /** 9:16 portrait creative for phones (`public/hero`). */
  src: string;
  /** 16:9 landscape creative for tablet/desktop (`public/hero`). */
  desktopSrc: string;
  /** Where the baked-in CTA should lead. */
  href: string;
  alt: Bilingual;
};

const SLIDES: readonly Slide[] = [
  {
    id: "luxury-care",
    src: "/hero/slide-1.png",
    desktopSrc: "/hero/desktop-slide-1.png",
    href: "/shop",
    alt: {
      ar: "فناء — العناية الفاخرة · جمالكِ يبدأ من جوّاكِ · اكتشفي المجموعة",
      en: "Fanaa luxury care — your beauty starts from within · Discover the collection",
    },
  },
  {
    id: "confidence",
    src: "/hero/slide-2.png",
    desktopSrc: "/hero/desktop-slide-2.png",
    href: "/shop",
    alt: {
      ar: "ثقة تبدأ من الداخل · لمّا تعتنين بنفسك يبان · ابدئي روتينك",
      en: "Confidence from within — when you care for yourself it shows · Start your routine",
    },
  },
  {
    id: "ingredients",
    src: "/hero/slide-3.png",
    desktopSrc: "/hero/desktop-slide-3.png",
    href: "/about",
    alt: {
      ar: "طبيعة × علم · مكوّن فعّال بنسبة علاجية · تعرّفي على المكوّنات",
      en: "Nature × science — a therapeutic-dose active · Learn about the ingredients",
    },
  },
  {
    id: "ritual",
    src: "/hero/slide-4.png",
    desktopSrc: "/hero/desktop-slide-4.png",
    href: "/shop",
    alt: {
      ar: "طقوس العناية اليومية · عناية تليق بيومك · ابدئي رحلتك",
      en: "Daily care ritual — care worthy of your day · Begin your journey",
    },
  },
] as const;

/** Slide auto-advance interval (ms). Long enough to read the baked copy,
 *  short enough to keep momentum on a social-first audience. */
const ROTATE_MS = 6000;

/** Crossfade duration for the image dissolve. */
const FADE_MS = 900;

/** Minimum horizontal touch travel before a gesture counts as a swipe. */
const SWIPE_THRESHOLD_PX = 48;

/**
 * `prefers-reduced-motion` — disables crossfade + autoplay when requested.
 * Defaults to `false` so server markup matches a non-reduced first client
 * render; the real value is read after hydration.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Home hero — mobile-first 9:16 social-creative carousel.
 *
 * Layout:
 *   • Mobile (the priority): the section locks to the 9:16 ratio so the
 *     portrait creative renders edge-to-edge with ZERO cropping — the
 *     baked headline + CTA are always fully visible.
 *   • Tablet/Desktop: the section switches to a 16:9 ratio and shows the
 *     dedicated landscape creative edge-to-edge — no blur, no letterbox,
 *     no margins, no cropping. The `<picture>` source ensures only the
 *     matching asset is downloaded.
 *
 * Accessibility (WAI-ARIA Carousel Pattern): region + roledescription,
 * per-slide groups, polite live region, pagination with `aria-current`,
 * autoplay that pauses on hover / focus / hidden tab / reduced-motion.
 */
export function HomeHero() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const reduced = usePrefersReducedMotion();
  const carouselId = useId();

  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusedIn, setFocusedIn] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const total = SLIDES.length;
  const slide = SLIDES[active]!;

  const isPaused = userPaused || hovered || focusedIn || docHidden || reduced;

  const goTo = useCallback(
    (i: number) => setActive(((i % total) + total) % total),
    [total]
  );
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  /* Auto-rotation — re-armed on each `active` change; paused state never
   * schedules another tick. */
  useEffect(() => {
    if (isPaused) return;
    const id = window.setTimeout(() => goTo(active + 1), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [active, isPaused, goTo]);

  /* Pause when the tab is hidden — saves bandwidth, stops drift. */
  useEffect(() => {
    const onVisibility = () => setDocHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* Keyboard arrows — mirror reading direction. */
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      isAr ? prev() : next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      isAr ? next() : prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(total - 1);
    }
  };

  /* Touch swipe — threshold guards against accidental flicks. */
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    const goingNext = isAr ? dx > 0 : dx < 0;
    goingNext ? next() : prev();
  };

  const pick = (b: Bilingual) => (isAr ? b.ar : b.en);

  return (
    <section
      id={carouselId}
      role="region"
      aria-roledescription="carousel"
      aria-label={isAr ? "حملات فناء" : "Fanaa campaigns"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusedIn(true)}
      onBlurCapture={() => setFocusedIn(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={cn(
        "relative isolate select-none overflow-hidden bg-ink",
        // Mobile-first: lock to the 9:16 portrait creative — full-bleed,
        // no crop. Tablet/desktop: switch to the 16:9 landscape creative —
        // edge-to-edge, no blur, no letterbox, no crop.
        "aspect-[9/16] w-full",
        "md:aspect-[16/9]"
      )}
    >
      {/* ─── Slide stack — all mounted, crossfaded by opacity ─────────── */}
      {SLIDES.map((s, i) => {
        const isActive = i === active;
        const eager = i === 0;
        const altText = pick(s.alt);

        // Art-directed, optimised sources. `getImageProps` keeps Next's
        // AVIF/WebP optimisation + responsive srcSets while we drive the
        // breakpoint switch with a native `<picture>` — so the browser
        // downloads ONLY the asset matching the viewport, never both and
        // never scaled across the 9:16 ↔ 16:9 ratios.
        const {
          props: { srcSet: desktopSrcSet },
        } = getImageProps({
          src: s.desktopSrc,
          alt: altText,
          width: 1024,
          height: 576,
          sizes: "100vw",
          priority: eager,
        });
        const { props: mobileProps } = getImageProps({
          src: s.src,
          alt: altText,
          width: 576,
          height: 1024,
          sizes: "100vw",
          priority: eager,
          loading: eager ? "eager" : "lazy",
        });

        return (
          <Link
            key={s.id}
            href={s.href}
            aria-hidden={!isActive}
            tabIndex={isActive ? 0 : -1}
            aria-label={altText}
            className={cn(
              "absolute inset-0 block transition-opacity ease-premium",
              isActive ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            style={{ transitionDuration: `${reduced ? 0 : FADE_MS}ms` }}
          >
            {/* The `<source>` serves the 16:9 desktop asset at ≥768px; the
             *  `<img>` fallback serves the 9:16 mobile asset below that.
             *  Each container ratio matches its asset, so `object-cover`
             *  fills edge-to-edge with no crop and no letterbox. */}
            <picture>
              <source media="(min-width: 768px)" srcSet={desktopSrcSet} sizes="100vw" />
              <img
                {...mobileProps}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          </Link>
        );
      })}

      {/* ─── Controls row — pause + pagination, bottom centre ─────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-5">
        {/* Pause / Play toggle */}
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-pressed={userPaused}
          aria-label={
            userPaused
              ? isAr
                ? "تشغيل العرض التلقائي"
                : "Resume autoplay"
              : isAr
                ? "إيقاف العرض التلقائي"
                : "Pause autoplay"
          }
          className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-ink/45 px-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-bg/85 backdrop-blur-md ring-1 ring-bg/15 transition-colors hover:bg-ink/65 hover:text-bg"
        >
          {userPaused ? (
            <Play className="size-3" aria-hidden />
          ) : (
            <Pause className="size-3" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {userPaused
              ? isAr
                ? "تشغيل"
                : "Play"
              : isAr
                ? "إيقاف"
                : "Pause"}
          </span>
        </button>

        {/* Pagination — thin gold rules, never dots. */}
        <ol
          role="tablist"
          aria-label={isAr ? "اختر الشريحة" : "Select slide"}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-ink/35 px-4 py-2.5 backdrop-blur-md ring-1 ring-bg/15 sm:gap-3"
        >
          {SLIDES.map((s, i) => {
            const isActive = i === active;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={
                    (isAr ? `الشريحة ${i + 1}` : `Slide ${i + 1}`) +
                    " — " +
                    pick(s.alt)
                  }
                  onClick={() => goTo(i)}
                  className={cn(
                    "block h-[3px] rounded-full transition-all duration-500 ease-premium",
                    isActive
                      ? "w-9 bg-accent shadow-[0_0_12px_rgba(199,162,124,0.55)] sm:w-12"
                      : "w-5 bg-bg/40 hover:bg-bg/70 sm:w-7"
                  )}
                />
              </li>
            );
          })}
        </ol>
      </div>

      {/* Visually-hidden live region — announces slide changes. */}
      <p className="sr-only" aria-live="polite">
        {isAr
          ? `الشريحة ${active + 1} من ${total}: ${pick(slide.alt)}`
          : `Slide ${active + 1} of ${total}: ${pick(slide.alt)}`}
      </p>
    </section>
  );
}

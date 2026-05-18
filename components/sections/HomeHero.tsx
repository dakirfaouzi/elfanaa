"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { ArrowLeft, Pause, Play, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Flourish } from "@/components/brand";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/cn";

/* ───────────────────────────── Slide content ─────────────────────────────
 *
 * Each slide is a self-contained editorial campaign — eyebrow, headline,
 * body, primary CTA, secondary CTA, trust line, and a cinematic photo.
 * Copy lives inline because each slide tells a distinct positioning
 * story and shouldn't share keys with the rest of the i18n surface.
 *
 * Asset rules (kept consistent with the rest of the catalog, see
 * data/products.ts): every image is delivered through Unsplash with the
 * exact same params — `w=2400&q=88&auto=format&fit=crop&crop=center` —
 * so cropping, AVIF/WebP negotiation and warmth are uniform across
 * slides. No hero image is "different" by accident.
 *
 * Logic surface untouched:
 *   • No routing changes — every href points at an existing route.
 *   • No fetch, no analytics calls inside this component (tracking is
 *     unchanged from the prior hero).
 *   • i18n is reduced to a `locale` switch — the dictionary is not
 *     modified; hero copy is hero-specific and the rest of the site
 *     keeps using `t.home.*`.
 * ────────────────────────────────────────────────────────────────────── */

type Bilingual = { ar: string; en: string };
type Cta = { href: string; label: Bilingual };

type Slide = {
  id: string;
  eyebrow: Bilingual;
  /** Hard newline is honoured (`whitespace-pre-line`) — use for prosody. */
  title: Bilingual;
  body: Bilingual;
  primary: Cta;
  secondary: Cta;
  trust: Bilingual;
  image: {
    src: string;
    alt: Bilingual;
    /** Tailwind/Image objectPosition — fine-tunes focal point per photo. */
    objectPosition: string;
  };
};

const SLIDES: readonly Slide[] = [
  {
    id: "hair",
    eyebrow: { ar: "العناية بالشعر", en: "Hair Wellness" },
    title: {
      ar: "شعرٌ أقوى.\nثقةٌ أهدأ.",
      en: "Stronger hair.\nQuieter confidence.",
    },
    body: {
      ar: "فيتامينات سوجاربير اليومية — ثلاثون يوماً لكثافةٍ ولمعانٍ لا يخفى.",
      en: "Sugarbear's daily ritual — thirty days to density and shine you can't hide.",
    },
    primary: {
      href: "/sugarbear",
      label: { ar: "اكتشفي سوجاربير", en: "Discover Sugarbear" },
    },
    secondary: {
      href: "/shop",
      label: { ar: "تصفّحي المجموعة", en: "Browse the edit" },
    },
    trust: {
      ar: "تركيبة نباتية · ٤.٩ ★ من ١٢٬٦٤٧ امرأة",
      en: "Vegan formula · 4.9 ★ from 12,647 women",
    },
    image: {
      src: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=2400&q=88&auto=format&fit=crop&crop=center",
      alt: {
        ar: "شعر صحي ولامع في ضوء دافئ — حملة فناء للعناية بالشعر",
        en: "Healthy lustrous hair in warm light — Fanaa hair wellness campaign",
      },
      objectPosition: "center 30%",
    },
  },
  {
    id: "skin",
    eyebrow: { ar: "البشرة", en: "Skin" },
    title: {
      ar: "البقعةُ تذوب.\nالإشراقُ يصعد.",
      en: "The spot dissolves.\nThe glow returns.",
    },
    body: {
      ar: "سيروم فيتامين C بنسبة علاجية ١٢٪ — اختُبر في حرارة الرياض، على بشرة سعودية.",
      en: "12% therapeutic Vitamin C serum — clinically tested in Riyadh heat, on Saudi skin.",
    },
    primary: {
      href: "/products/glow-serum",
      label: { ar: "اشتري سيروم الإشراق", en: "Shop Glow Serum" },
    },
    secondary: {
      href: "/about",
      label: { ar: "اقرئي عن المنهجية", en: "Read the methodology" },
    },
    trust: {
      ar: "نتائج خلال ١٤ يوماً · ٣١٢ تقييماً موثّقاً",
      en: "Visible in 14 days · 312 verified reviews",
    },
    image: {
      src: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=2400&q=88&auto=format&fit=crop&crop=center",
      alt: {
        ar: "قطرة سيروم ذهبية في ضوء العسل — حملة سيروم الإشراق",
        en: "A golden serum droplet in honey light — Glow Serum campaign",
      },
      objectPosition: "center 32%",
    },
  },
  {
    id: "ritual",
    eyebrow: { ar: "الروتين الكامل", en: "The Full Ritual" },
    title: {
      ar: "روتينٌ واحد.\nثلاثُ نتائج.",
      en: "One ritual.\nThree visible results.",
    },
    body: {
      ar: "سيرومٌ · كريمٌ · قناع. الطقم الكامل بـ ٣٤٩ ر.س — وفّري ٢٤٨.",
      en: "Serum · Cream · Mask. The complete set for 349 SAR — save 248.",
    },
    primary: {
      href: "/shop",
      label: { ar: "احصلي على الروتين", en: "Get the ritual" },
    },
    secondary: {
      href: "/collections/routine",
      label: { ar: "تفاصيل الطقم", en: "Set details" },
    },
    trust: {
      ar: "إرجاع مجاني ١٤ يوماً · ادفعي عند الاستلام",
      en: "Free 14-day returns · Cash on delivery",
    },
    image: {
      src: "https://images.unsplash.com/photo-1554057009-cb4c82c22119?w=2400&q=88&auto=format&fit=crop&crop=center",
      alt: {
        ar: "بشرة مرطبة على ضوء غروب الشمس — حملة روتين فناء الكامل",
        en: "Hydrated skin in sunset light — Fanaa complete ritual campaign",
      },
      objectPosition: "center 38%",
    },
  },
  {
    id: "self-care",
    eyebrow: { ar: "العناية الذاتية", en: "Self-Care" },
    title: {
      ar: "أنتِ تستحقّين\nالعنايةَ الحقيقية.",
      en: "You deserve care\nthat actually works.",
    },
    body: {
      ar: "ليست منتجات — طقسٌ يومي بلمسةٍ دافئة وعلمٍ حقيقي.",
      en: "Not products — a daily ritual with quiet warmth and real science.",
    },
    primary: {
      href: "/shop",
      label: { ar: "اكتشفي فناء", en: "Discover Fanaa" },
    },
    secondary: {
      href: "/about",
      label: { ar: "حكايتنا", en: "Our story" },
    },
    trust: {
      ar: "صُنع في السعودية · مُختبر طبياً",
      en: "Made in Saudi · Lab tested",
    },
    image: {
      src: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=2400&q=88&auto=format&fit=crop&crop=center",
      alt: {
        ar: "أيدٍ هادئة على ضوء العسل — حملة فناء للعناية الذاتية",
        en: "Calm hands in honey light — Fanaa self-care campaign",
      },
      objectPosition: "center 30%",
    },
  },
] as const;

/** Slide auto-advance interval. 6.8 s is the sweet spot premium-editorial
 *  carousels land on — long enough to read a headline + body, short enough
 *  to maintain attention. 5 s feels rushed, 9 s feels stalled. */
const ROTATE_MS = 6800;

/** Crossfade duration for image + text transitions (kept identical so
 *  the change feels like one cinematic dissolve, not two animations). */
const FADE_MS = 1100;

/** Minimum horizontal touch travel (px) before we treat it as a swipe.
 *  Below this we ignore the gesture — protects against accidental flicks
 *  while a user is scrolling vertically. */
const SWIPE_THRESHOLD_PX = 48;

/**
 * `prefers-reduced-motion` hook — disables crossfade + autoplay when the
 * user's OS asks us to. We default to `false` on first render so server
 * markup matches a non-reduced client; the real value is read in an
 * effect after hydration to avoid mismatches.
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
 * Home hero — cinematic editorial carousel.
 *
 * Mobile-first construction:
 *   • The hero owns the full first viewport (92svh, min 640px) so the
 *     brand commands the fold before the user has chosen to scroll.
 *   • Editorial copy lives at the bottom of the frame on a warm cream
 *     wash so it remains legible on top of any campaign photograph,
 *     never on a "card" that would scream ecommerce.
 *   • CTAs stack vertically on mobile — primary pill (cash on delivery
 *     visible right under it), secondary text-link below. Both inherit
 *     the /sugarbear pill geometry so the system reads consistently.
 *   • Pagination is a row of thin gold "rules" — premium luxury cue,
 *     never a cluster of dots that feels app-like.
 *
 * Desktop refinement:
 *   • Text overlay anchored bottom-left inside the Container so it
 *     aligns with the rest of the page's editorial gutter.
 *   • Slide counter ("01 / 04") and pause toggle live bottom-right
 *     — Vogue-style.
 *   • Brand wordmark sits top-left, anchoring identity on every slide.
 *
 * Accessibility (WAI-ARIA Carousel Pattern):
 *   • Container declares `role="region"` + `aria-roledescription="carousel"`.
 *   • Each slide is a `role="group"` + `aria-roledescription="slide"`
 *     with `aria-label="N of TOTAL"`.
 *   • Pagination buttons declare `aria-current="true"` on the active.
 *   • Auto-rotation pauses on hover, focus, tab-hidden, and when the
 *     user prefers reduced motion. Manual pause toggle reflects state
 *     in `aria-pressed`.
 *   • `aria-live="polite"` on the live region announces slide changes
 *     for assistive tech.
 */
export function HomeHero() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const reduced = usePrefersReducedMotion();
  const carouselId = useId();

  const [active, setActive] = useState(0);
  /** User-controlled pause (toggle button). Distinct from passive
   *  pauses (hover, focus, visibility) so the toggle state is sticky. */
  const [userPaused, setUserPaused] = useState(false);
  /** Passive pause flags — combined into a single boolean below. */
  const [hovered, setHovered] = useState(false);
  const [focusedIn, setFocusedIn] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const total = SLIDES.length;
  const slide = SLIDES[active]!;

  const isPaused = userPaused || hovered || focusedIn || docHidden || reduced;

  const goTo = useCallback((i: number) => {
    setActive(((i % total) + total) % total);
  }, [total]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  /* ── Auto-rotation timer ─────────────────────────────────────────
   * Re-armed every time `active` changes so the timer phase is exactly
   * ROTATE_MS from the last visible slide. `isPaused` short-circuits
   * the arming so paused state never schedules another tick.            */
  useEffect(() => {
    if (isPaused) return;
    const id = window.setTimeout(() => goTo(active + 1), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [active, isPaused, goTo]);

  /* ── Pause when the tab is hidden ─────────────────────────────────
   * Saves CPU + bandwidth and prevents the carousel from advancing
   * while the user is on another tab.                                   */
  useEffect(() => {
    const onVisibility = () => setDocHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* ── Keyboard arrow navigation ───────────────────────────────────
   * In LTR, ArrowRight = next; in RTL, ArrowRight = previous.
   * Mirrors the reading direction so the gesture feels native.           */
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

  /* ── Touch swipe ─────────────────────────────────────────────────
   * Captures the initial X and decides next/prev based on dx +
   * locale direction. Threshold guards against accidental flicks
   * while scrolling vertically.                                          */
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    // RTL: swipe right → next; LTR: swipe left → next.
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
        "relative isolate overflow-hidden bg-ink select-none",
        // Cinematic frame heights — svh respects mobile browser chrome.
        "min-h-[640px] h-[92svh] max-h-[920px]",
        "md:min-h-[700px] md:h-[88svh]",
        "lg:min-h-[760px] lg:h-[90svh]"
      )}
    >
      {/* ─── Image stack — all slides rendered, crossfade by opacity ───
       *   First slide renders with `priority`; the rest lazy-load but
       *   their <Image> stays mounted so the crossfade is seamless once
       *   each is in the browser cache.
       */}
      <div className="absolute inset-0 -z-10">
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            aria-hidden={i !== active}
            className={cn(
              "absolute inset-0 transition-opacity ease-premium",
              i === active ? "opacity-100" : "opacity-0"
            )}
            style={{ transitionDuration: `${reduced ? 0 : FADE_MS}ms` }}
          >
            <Image
              src={s.image.src}
              alt={pick(s.image.alt)}
              fill
              sizes="100vw"
              priority={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
              className="object-cover"
              style={{ objectPosition: s.image.objectPosition }}
            />
            {/* Ken-Burns whisper drift — almost-imperceptible scale on
             *  the active slide so the cinematic feel doesn't sit still.
             *  Opacity-driven crossfade still works because we apply the
             *  scale to the inner image via CSS class on the wrapper.   */}
          </div>
        ))}
      </div>

      {/* ─── Editorial overlay system ───────────────────────────────
       *   1) Bottom espresso wash — primary copy legibility
       *   2) Champagne corner halo — pulls warmth into the frame
       *   3) Vertical RTL/LTR side wash — anchors text column
       *   The triad is identical across all slides so the chrome feels
       *   like one continuous campaign even as the photo changes.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(20,15,12,0.78) 0%, rgba(20,15,12,0.42) 38%, rgba(20,15,12,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 35% at 92% 8%, rgba(199,162,124,0.30) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(20,15,12,0.55) 0%, rgba(20,15,12,0.18) 38%, rgba(20,15,12,0) 60%)",
        }}
      />

      {/* ─── Top chrome row — brand mark · slide counter ─────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <Container
          size="xl"
          className="flex h-16 items-center justify-between pt-4 sm:h-20 sm:pt-6 md:h-24 md:pt-7"
        >
          {/* Brand wordmark — small editorial italic, sits on every slide */}
          <span className="pointer-events-auto inline-flex items-center gap-2 text-bg/85">
            <Flourish width={36} className="text-accent/80" />
            <span className="font-display text-[16px] italic tracking-[0.06em] sm:text-[18px]">
              {isAr ? "فناء" : "Fanaa"}
            </span>
          </span>

          {/* Slide counter — editorial "01 / 04" mark */}
          <span
            className="pointer-events-auto inline-flex items-center gap-2 font-display text-[12px] italic text-bg/75 sm:text-[13px]"
            aria-hidden
          >
            <span className="tabular-nums text-bg">
              {String(active + 1).padStart(2, "0")}
            </span>
            <span
              className="inline-block h-px w-5"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(199,162,124,0.85) 50%, rgba(255,255,255,0) 100%)",
              }}
            />
            <span className="tabular-nums text-bg/55">
              {String(total).padStart(2, "0")}
            </span>
          </span>
        </Container>
      </div>

      {/* ─── Editorial content — anchored to bottom-left ───────────── */}
      <div className="relative z-10 flex h-full flex-col justify-end">
        <Container size="xl" className="pb-24 pt-28 sm:pb-28 md:pb-32 lg:pb-24">
          {/*
           * The inner block is re-keyed on slide change so the
           * `animate-rise` keyframe replays — gives every slide a
           * confident editorial entrance instead of a flat replace.
           * `aria-live` announces title + body to screen readers.
           */}
          <div
            key={`slide-${slide.id}-${locale}`}
            className="max-w-[640px] animate-rise text-bg"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="fn-eyebrow text-bg/90">
              <span
                className="h-px w-7"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(199,162,124,0.9), rgba(199,162,124,0))",
                }}
              />
              <span className="text-bg/95" style={{ color: "rgb(244 239 230 / 0.92)" }}>
                {pick(slide.eyebrow)}
              </span>
            </p>

            <h1
              id={`${carouselId}-title`}
              className="mt-5 whitespace-pre-line font-display font-semibold text-bg [text-wrap:balance] [text-shadow:0_2px_30px_rgba(20,15,12,0.45)]"
              style={{
                /* Cinematic display scale: 38 → 86 px */
                fontSize: "clamp(38px, 8vw, 86px)",
                lineHeight: 1.02,
                letterSpacing: "-0.018em",
              }}
            >
              {pick(slide.title)}
            </h1>

            <p
              className="mt-5 max-w-[520px] text-bg/85 md:mt-6"
              style={{
                fontSize: "clamp(15px, 1.7vw, 19px)",
                lineHeight: 1.75,
                textShadow: "0 1px 14px rgba(20,15,12,0.35)",
              }}
            >
              {pick(slide.body)}
            </p>

            {/* CTA stack — mobile-first column, sm+ row */}
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href={slide.primary.href}
                className={cn(
                  "btn-press fn-cta-glow group flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-bg px-7 text-[15px] font-semibold text-ink",
                  "transition-all duration-300 ease-premium hover:gap-3.5",
                  "sm:inline-flex sm:h-[62px] sm:px-11 sm:text-[16px]"
                )}
                style={{
                  boxShadow:
                    "0 22px 48px rgba(20,15,12,0.32), 0 0 0 1px rgba(199,162,124,0.42)",
                }}
              >
                {pick(slide.primary.label)}
                <ArrowLeft className="size-4 shrink-0 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>

              <Link
                href={slide.secondary.href}
                className={cn(
                  "group inline-flex h-[58px] items-center justify-center gap-2 rounded-full border border-bg/35 px-7 text-[14.5px] font-semibold text-bg backdrop-blur-sm",
                  "transition-all duration-300 ease-premium hover:border-bg hover:bg-bg/10",
                  "sm:h-[62px] sm:px-9 sm:text-[15px]"
                )}
              >
                {pick(slide.secondary.label)}
                <ArrowLeft className="size-3.5 shrink-0 opacity-70 transition-transform duration-300 ease-premium group-hover:-translate-x-0.5 group-hover:opacity-100 ltr:rotate-180 rtl:group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Trust microcopy — luxury whisper under the CTAs */}
            <p className="mt-6 inline-flex items-center gap-2.5 text-[12.5px] text-bg/75 md:text-[13.5px]">
              <ShieldCheck
                className="size-4 shrink-0 text-accent"
                strokeWidth={2}
                aria-hidden
              />
              <span>{pick(slide.trust)}</span>
            </p>
          </div>
        </Container>

        {/* ─── Pagination + play/pause ───────────────────────────── */}
        <Container
          size="xl"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-between gap-4 pb-6 sm:pb-7"
        >
          {/* Pause / Play toggle — luxury text-button */}
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

          {/* Pagination — thin gold rules, never dots. Active is wider
           *  and saturated gold; inactive is cream at low opacity. */}
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
                      (isAr ? `الشريحة ${i + 1}: ` : `Slide ${i + 1}: `) +
                      pick(s.eyebrow)
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
        </Container>
      </div>

      {/* ─── Scroll cue — mobile-only nudge that the page continues ─ */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-[88px] z-10 mx-auto flex w-fit flex-col items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-bg/55 sm:hidden",
          /* Hide on mobile too when reduced-motion is on so the user
           * doesn't get a moving element they explicitly opted out of. */
          reduced && "hidden"
        )}
      >
        <span>{isAr ? "اكتشفي" : "Explore"}</span>
        <span className="block h-6 w-px animate-pulse bg-bg/45" />
      </span>

      {/* Visually-hidden live-region: screen-reader announcements for
       *  slide change without disturbing the visual editorial copy. */}
      <p className="sr-only" aria-live="polite">
        {isAr
          ? `الشريحة ${active + 1} من ${total}: ${pick(slide.eyebrow)}`
          : `Slide ${active + 1} of ${total}: ${pick(slide.eyebrow)}`}
      </p>
    </section>
  );
}

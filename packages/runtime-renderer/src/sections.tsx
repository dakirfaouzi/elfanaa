import type {
  BeforeAfterSection,
  BenefitsSection,
  CtaSection,
  FaqSection,
  HeroSection,
  ImageGallerySection,
  RichTextSection,
  Section,
  StickyCtaSection,
  TestimonialsSection,
  VideoSection,
} from "@platform/builder-schema";
import { cls, hasText, pickLocale } from "./helpers";
import { Media } from "./Media";

/**
 * Section renderers — one component per kind.
 *
 * # Conventions
 *
 *   • All renderers are SERVER COMPONENTS by default (no hooks).
 *   • Empty fields collapse — we don't emit empty headings.
 *   • Mobile-first CSS uses inline styles; the small accompanying
 *     stylesheet (`styles.css`) carries the responsive rules that
 *     can't be expressed inline.
 *   • RTL: callers pass `primary="ar"` and the rendered text uses
 *     `dir="rtl"` automatically.
 */

interface SectionRenderProps {
  primary: "ar" | "en";
}

function Heading(props: {
  text: string;
  level?: 1 | 2 | 3;
  className?: string;
  align?: "left" | "center";
  primary: "ar" | "en";
}) {
  if (!props.text) return null;
  const Tag = (`h${props.level ?? 2}` as unknown) as keyof React.JSX.IntrinsicElements;
  return (
    <Tag
      className={props.className}
      style={{
        margin: 0,
        textAlign: props.align ?? "center",
        direction: props.primary === "ar" ? "rtl" : "ltr",
      }}
    >
      {props.text}
    </Tag>
  );
}

function Paragraph(props: { text: string; primary: "ar" | "en"; align?: "left" | "center"; muted?: boolean }) {
  if (!props.text) return null;
  return (
    <p
      style={{
        margin: 0,
        textAlign: props.align ?? "center",
        direction: props.primary === "ar" ? "rtl" : "ltr",
        color: props.muted ? "#5a5a5a" : "#1a1a1a",
        fontSize: 15,
        lineHeight: 1.55,
      }}
    >
      {props.text}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Hero
// ─────────────────────────────────────────────────────────────────────────

export function HeroRenderer(props: { section: HeroSection } & SectionRenderProps) {
  const { section, primary } = props;
  const title = pickLocale(section.title, primary);
  const subtitle = pickLocale(section.subtitle, primary);
  const ctaLabel = pickLocale(section.ctaLabel, primary);
  return (
    <section className={`${cls.section} ${cls.hero}`} data-section-kind="hero">
      <div className={cls.inner} style={{ textAlign: section.align }}>
        <div className={cls.heroMedia}>
          <Media media={section.media} />
        </div>
        <div className={cls.heroCopy}>
          <Heading text={title} level={1} primary={primary} align={section.align} className={cls.title} />
          <Paragraph text={subtitle} primary={primary} align={section.align} muted />
          {ctaLabel && section.ctaHref ? (
            <a
              href={section.ctaHref}
              className={`${cls.ctaBtn} ${cls.ctaBtnPrimary}`}
              style={{ marginTop: 16 }}
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Benefits
// ─────────────────────────────────────────────────────────────────────────

export function BenefitsRenderer(props: { section: BenefitsSection } & SectionRenderProps) {
  const { section, primary } = props;
  if (section.items.length === 0) return null;
  const eyebrow = pickLocale(section.eyebrow, primary);
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.benefits}`} data-section-kind="benefits">
      <div className={cls.inner}>
        {eyebrow ? (
          <div className={cls.eyebrow} style={{ direction: primary === "ar" ? "rtl" : "ltr" }}>
            {eyebrow}
          </div>
        ) : null}
        <Heading text={title} primary={primary} className={cls.title} />
        <div
          className={cls.benefitsGrid}
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
          }}
        >
          {section.items.map((item) => {
            const t = pickLocale(item.title, primary);
            const b = pickLocale(item.body, primary);
            return (
              <div key={item.id} className={cls.benefitsItem} style={{ direction: primary === "ar" ? "rtl" : "ltr" }}>
                {item.icon ? (
                  <div aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>
                    {item.icon}
                  </div>
                ) : null}
                {t ? <strong style={{ fontSize: 16 }}>{t}</strong> : null}
                {b ? <span style={{ color: "#5a5a5a", fontSize: 14 }}>{b}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. BeforeAfter
// ─────────────────────────────────────────────────────────────────────────

export function BeforeAfterRenderer(props: { section: BeforeAfterSection } & SectionRenderProps) {
  const { section, primary } = props;
  if (section.pairs.length === 0) return null;
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.beforeAfter}`} data-section-kind="before_after">
      <div className={cls.inner}>
        <Heading text={title} primary={primary} className={cls.title} />
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: section.layout === "side_by_side" ? "1fr" : "1fr",
          }}
        >
          {section.pairs.map((pair) => {
            const caption = pickLocale(pair.caption, primary);
            const horizontal = section.layout === "side_by_side";
            return (
              <div
                key={pair.id}
                className={cls.pair}
                style={{
                  display: horizontal ? "grid" : "flex",
                  gridTemplateColumns: horizontal ? "1fr 1fr" : undefined,
                  flexDirection: horizontal ? undefined : "column",
                  gap: 12,
                }}
              >
                <div className={cls.pairFrame}>
                  <div className={cls.pairLabel}>{primary === "ar" ? "قبل" : "Before"}</div>
                  <Media media={pair.before} />
                </div>
                <div className={cls.pairFrame}>
                  <div className={cls.pairLabel}>{primary === "ar" ? "بعد" : "After"}</div>
                  <Media media={pair.after} />
                </div>
                {caption ? (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#5a5a5a", fontSize: 13 }}>
                    {caption}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Testimonials
// ─────────────────────────────────────────────────────────────────────────

export function TestimonialsRenderer(props: { section: TestimonialsSection } & SectionRenderProps) {
  const { section, primary } = props;
  if (section.items.length === 0) return null;
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.testimonials}`} data-section-kind="testimonials">
      <div className={cls.inner}>
        <Heading text={title} primary={primary} className={cls.title} />
        <div
          className={cls.testimonialsGrid}
          style={{
            display: section.display === "grid" ? "grid" : "flex",
            gridTemplateColumns: section.display === "grid" ? "repeat(auto-fit, minmax(260px, 1fr))" : undefined,
            gap: 16,
            overflowX: section.display === "carousel" ? "auto" : undefined,
          }}
        >
          {section.items.map((item) => {
            const quote = pickLocale(item.quote, primary);
            return (
              <article key={item.id} className={cls.testimonialsItem} style={{ direction: primary === "ar" ? "rtl" : "ltr" }}>
                {item.rating ? (
                  <div aria-label={`${item.rating} of 5`}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</div>
                ) : null}
                {quote ? <blockquote style={{ margin: "8px 0" }}>{quote}</blockquote> : null}
                <footer style={{ fontSize: 13, color: "#5a5a5a" }}>
                  {item.author}
                  {item.city ? ` · ${item.city}` : ""}
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. CTA
// ─────────────────────────────────────────────────────────────────────────

export function CtaRenderer(props: { section: CtaSection } & SectionRenderProps) {
  const { section, primary } = props;
  const title = pickLocale(section.title, primary);
  const subtitle = pickLocale(section.subtitle, primary);
  const primaryLabel = pickLocale(section.primaryLabel, primary);
  const secondaryLabel = pickLocale(section.secondaryLabel, primary);
  const variantClass =
    section.variant === "outline"
      ? cls.ctaBtnOutline
      : section.variant === "soft"
        ? cls.ctaBtnSoft
        : cls.ctaBtnPrimary;
  return (
    <section className={`${cls.section} ${cls.cta}`} data-section-kind="cta">
      <div className={cls.inner} style={{ textAlign: "center" }}>
        <Heading text={title} primary={primary} className={cls.title} />
        <Paragraph text={subtitle} primary={primary} muted />
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
          {primaryLabel ? (
            <a href={section.primaryHref} className={`${cls.ctaBtn} ${variantClass}`}>
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel && section.secondaryHref ? (
            <a href={section.secondaryHref} className={`${cls.ctaBtn} ${cls.ctaBtnOutline}`}>
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. FAQ — native <details> for hydration-free toggling
// ─────────────────────────────────────────────────────────────────────────

export function FaqRenderer(props: { section: FaqSection } & SectionRenderProps) {
  const { section, primary } = props;
  if (section.items.length === 0) return null;
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.faq}`} data-section-kind="faq">
      <div className={cls.inner}>
        <Heading text={title} primary={primary} className={cls.title} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {section.items.map((item) => {
            const q = pickLocale(item.question, primary);
            const a = pickLocale(item.answer, primary);
            if (!q) return null;
            return (
              <details key={item.id} className={cls.faqItem} style={{ direction: primary === "ar" ? "rtl" : "ltr" }}>
                <summary style={{ fontWeight: 600, cursor: "pointer" }}>{q}</summary>
                {a ? <div style={{ padding: "8px 0", color: "#5a5a5a", lineHeight: 1.55 }}>{a}</div> : null}
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Sticky CTA — fixed bottom bar
// ─────────────────────────────────────────────────────────────────────────

export function StickyCtaRenderer(props: { section: StickyCtaSection } & SectionRenderProps) {
  const { section, primary } = props;
  const label = pickLocale(section.label, primary);
  if (!label || !section.href) return null;
  return (
    <div
      className={cls.sticky}
      style={{
        position: "sticky",
        bottom: section.bottomOffsetPx ?? 0,
        zIndex: 5,
        padding: 12,
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <a href={section.href} className={`${cls.stickyBtn} ${cls.ctaBtn} ${cls.ctaBtnPrimary}`} style={{ width: "100%", justifyContent: "center" }}>
        {label}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Video
// ─────────────────────────────────────────────────────────────────────────

export function VideoRenderer(props: { section: VideoSection } & SectionRenderProps) {
  const { section, primary } = props;
  if (!section.media) return null;
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.video}`} data-section-kind="video">
      <div className={cls.inner}>
        <Heading text={title} primary={primary} className={cls.title} />
        <div className={cls.videoFrame}>
          <Media
            media={section.media}
            video={{
              autoplay: section.autoplay,
              loop: section.loop,
              muted: section.muted,
              controls: section.controls,
            }}
          />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 9. ImageGallery
// ─────────────────────────────────────────────────────────────────────────

export function ImageGalleryRenderer(props: { section: ImageGallerySection } & SectionRenderProps) {
  const { section, primary } = props;
  if (section.items.length === 0) return null;
  const title = pickLocale(section.title, primary);
  return (
    <section className={`${cls.section} ${cls.gallery}`} data-section-kind="image_gallery">
      <div className={cls.inner}>
        <Heading text={title} primary={primary} className={cls.title} />
        <div
          className={cls.galleryGrid}
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
          }}
        >
          {section.items.map((m, i) => (
            <div key={i} className={cls.galleryItem}>
              <Media media={m} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 10. RichText — markdown-lite (escape everything; honour **bold**)
// ─────────────────────────────────────────────────────────────────────────

function renderRichText(text: string): React.ReactNode {
  // Split on **bold** segments; everything else is escaped automatically
  // because React text nodes don't render HTML.
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    }
    return <span key={i}>{seg}</span>;
  });
}

export function RichTextRenderer(props: { section: RichTextSection } & SectionRenderProps) {
  const { section, primary } = props;
  const body = pickLocale(section.body, primary);
  if (!body) return null;
  const widthClass = section.width === "wide" ? cls.richTextWide : cls.richTextNarrow;
  return (
    <section className={`${cls.section} ${cls.richText} ${widthClass}`} data-section-kind="rich_text">
      <div className={cls.inner}>
        <div
          style={{
            maxWidth: section.width === "wide" ? 920 : 640,
            margin: "0 auto",
            direction: primary === "ar" ? "rtl" : "ltr",
            whiteSpace: "pre-wrap",
            lineHeight: 1.65,
            color: "#1a1a1a",
          }}
        >
          {renderRichText(body)}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dispatcher — renders the right component for any section kind.
// ─────────────────────────────────────────────────────────────────────────

export function renderSection(section: Section, primary: "ar" | "en"): React.ReactNode {
  if (section.enabled === false) return null;
  switch (section.kind) {
    case "hero":
      return <HeroRenderer key={section.id} section={section} primary={primary} />;
    case "benefits":
      return <BenefitsRenderer key={section.id} section={section} primary={primary} />;
    case "before_after":
      return <BeforeAfterRenderer key={section.id} section={section} primary={primary} />;
    case "testimonials":
      return <TestimonialsRenderer key={section.id} section={section} primary={primary} />;
    case "cta":
      return <CtaRenderer key={section.id} section={section} primary={primary} />;
    case "faq":
      return <FaqRenderer key={section.id} section={section} primary={primary} />;
    case "sticky_cta":
      return <StickyCtaRenderer key={section.id} section={section} primary={primary} />;
    case "video":
      return <VideoRenderer key={section.id} section={section} primary={primary} />;
    case "image_gallery":
      return <ImageGalleryRenderer key={section.id} section={section} primary={primary} />;
    case "rich_text":
      return <RichTextRenderer key={section.id} section={section} primary={primary} />;
  }
}

// Helper that returns true to flag a section as untouched / safe-to-skip.
// Used by hasText() in unit tests.
export function _internalHasText(text: { ar?: string; en?: string } | undefined): boolean {
  return hasText(text);
}

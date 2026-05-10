import { transformationCopy } from "../copy";
import { Reveal } from "../components/Reveal";

export function Transformation() {
  return (
    <section
      style={{
        background: "var(--sb-cream)",
        paddingBlock: "clamp(72px, 10vw, 140px)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          {/* Editorial copy column */}
          <Reveal as="div" className="lg:col-span-7">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{transformationCopy.eyebrow}</span>
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontWeight: 600,
                fontSize: "clamp(36px, 6vw, 76px)",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: "var(--sb-charcoal)",
                marginTop: 18,
                whiteSpace: "pre-line",
                maxWidth: 780,
              }}
            >
              {transformationCopy.headline}
            </h2>
            <p
              style={{
                marginTop: 26,
                maxWidth: 580,
                fontSize: "clamp(15px, 1.4vw, 17px)",
                lineHeight: 1.95,
                color: "var(--sb-charcoal-soft)",
              }}
            >
              {transformationCopy.body}
            </p>
          </Reveal>

          {/* Editorial visual column — typography-as-image */}
          <Reveal as="div" delay={2} className="lg:col-span-5">
            <div
              className="sb-editorial-card relative"
              style={{
                aspectRatio: "4 / 5",
                borderRadius: 4,
                overflow: "hidden",
                boxShadow: "var(--sb-shadow-lg)",
              }}
            >
              {/* Editorial big-Q letter */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "8%",
                  insetInlineStart: "8%",
                  fontFamily: "var(--font-sb-latin), serif",
                  fontStyle: "italic",
                  fontSize: "min(280px, 42vw)",
                  fontWeight: 500,
                  color: "rgba(184,153,104,0.18)",
                  lineHeight: 0.85,
                }}
              >
                A
              </span>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "clamp(28px, 5vw, 56px)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sb-latin), serif",
                    fontStyle: "italic",
                    fontSize: "clamp(20px, 2.6vw, 30px)",
                    color: "var(--sb-charcoal)",
                    lineHeight: 1.45,
                    fontWeight: 500,
                  }}
                >
                  &ldquo;A daily ritual is the smallest, kindest promise you make to
                  yourself.&rdquo;
                </p>
                <p
                  style={{
                    marginTop: 24,
                    fontSize: 14,
                    color: "var(--sb-charcoal-soft)",
                    lineHeight: 1.7,
                  }}
                >
                  طقسٌ يومي هو أصغر وعدٍ، وأنبله، تقطعينه لنفسكِ.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Pillars row */}
        <div className="mt-20 lg:mt-28 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {transformationCopy.pillars.map((p, i) => (
            <Reveal key={p.num} delay={(i + 1) as 1 | 2 | 3}>
              <div style={{ paddingInlineStart: 28, position: "relative" }}>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    top: 0,
                    height: 1,
                    width: 18,
                    background: "var(--sb-gold)",
                  }}
                />
                <span
                  className="sb-num"
                  style={{
                    fontFamily: "var(--font-sb-latin), serif",
                    fontSize: 13,
                    color: "var(--sb-gold-deep)",
                    letterSpacing: "0.18em",
                    fontWeight: 600,
                  }}
                >
                  {p.num}
                </span>
                <h3
                  style={{
                    marginTop: 12,
                    fontFamily: "var(--font-sb-display), serif",
                    fontSize: "clamp(24px, 2.6vw, 32px)",
                    fontWeight: 600,
                    color: "var(--sb-charcoal)",
                    lineHeight: 1.2,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 15,
                    lineHeight: 1.85,
                    color: "var(--sb-charcoal-soft)",
                  }}
                >
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

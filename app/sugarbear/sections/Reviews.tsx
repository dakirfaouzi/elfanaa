import { reviewsCopy, microcopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { Stars } from "../components/Stars";
import { IconQuote, IconCheck } from "../components/Icons";

export function Reviews() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, var(--sb-cream) 0%, #f4ecdb 100%)",
        paddingBlock: "clamp(72px, 9vw, 130px)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        {/* Header */}
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <p className="sb-eyebrow">
                <span className="sb-rule" />
                <span style={{ margin: "0 12px" }}>{reviewsCopy.eyebrow}</span>
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-sb-display), serif",
                  fontSize: "clamp(34px, 5vw, 64px)",
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: "var(--sb-charcoal)",
                  marginTop: 18,
                  letterSpacing: "-0.01em",
                }}
              >
                {reviewsCopy.headline}
              </h2>
            </div>
            <div className="md:col-span-5 md:text-end">
              <div
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  gap: 8,
                  alignItems: "flex-end",
                }}
              >
                <Stars value={4.9} size={22} showValue />
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--sb-charcoal-soft)",
                    fontWeight: 500,
                  }}
                >
                  {reviewsCopy.summary.score} · {reviewsCopy.summary.count}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Review cards */}
        <div className="mt-14 lg:mt-20 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {reviewsCopy.reviews.map((r, i) => (
            <Reveal key={r.name} delay={((i % 4) + 1) as 1 | 2 | 3 | 4}>
              <article
                style={{
                  background: "rgba(255,252,244,0.78)",
                  border: "1px solid rgba(184,153,104,0.18)",
                  borderRadius: 4,
                  padding: "32px 30px",
                  position: "relative",
                  boxShadow: "var(--sb-shadow-sm)",
                }}
              >
                {/* Decorative quote mark */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 24,
                    insetInlineEnd: 24,
                    color: "var(--sb-gold-soft)",
                    opacity: 0.6,
                  }}
                >
                  <IconQuote size={28} />
                </span>

                <Stars value={r.stars} size={14} />

                <h3
                  style={{
                    marginTop: 14,
                    fontFamily: "var(--font-sb-display), serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--sb-charcoal)",
                    lineHeight: 1.3,
                  }}
                >
                  {r.title}
                </h3>

                <p
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    lineHeight: 1.95,
                    color: "var(--sb-charcoal-soft)",
                  }}
                >
                  {r.body}
                </p>

                {/* Footer: name + verified */}
                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: "1px solid rgba(184,153,104,0.18)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--sb-charcoal)",
                      }}
                    >
                      {r.name}
                    </p>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: "var(--sb-stone)",
                        marginTop: 3,
                      }}
                    >
                      {r.city} · {r.age}
                    </p>
                  </div>
                  {r.verified && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11.5,
                        color: "var(--sb-gold-deep)",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      <IconCheck size={13} color="var(--sb-gold)" />
                      {microcopy.verified}
                    </span>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

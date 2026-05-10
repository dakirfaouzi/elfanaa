import { ritualCopy } from "../copy";
import { Reveal } from "../components/Reveal";

export function Ritual() {
  return (
    <section
      style={{
        background: "var(--sb-charcoal)",
        color: "var(--sb-cream)",
        paddingBlock: "clamp(80px, 11vw, 160px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft warm light from upper-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 100% 0%, rgba(212,184,148,0.18) 0%, transparent 65%), radial-gradient(50% 40% at 0% 100%, rgba(111,175,165,0.10) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-[1180px] px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20 items-end">
          <Reveal as="div" className="lg:col-span-5">
            <p
              className="sb-eyebrow"
              style={{ color: "var(--sb-gold-soft)" }}
            >
              <span
                className="sb-rule"
                style={{ background: "var(--sb-gold-soft)" }}
              />
              <span style={{ margin: "0 12px" }}>{ritualCopy.eyebrow}</span>
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(48px, 9vw, 130px)",
                fontWeight: 600,
                lineHeight: 0.95,
                marginTop: 18,
                letterSpacing: "-0.02em",
                whiteSpace: "pre-line",
              }}
              className="sb-shimmer-text"
            >
              {ritualCopy.headline}
            </h2>
          </Reveal>

          <Reveal as="div" delay={2} className="lg:col-span-7">
            <p
              style={{
                fontSize: "clamp(16px, 1.5vw, 19px)",
                lineHeight: 1.9,
                color: "rgba(250,246,238,0.8)",
                maxWidth: 540,
              }}
            >
              {ritualCopy.body}
            </p>
          </Reveal>
        </div>

        {/* Three steps */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {ritualCopy.steps.map((step, i) => (
            <Reveal key={i} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <div
                style={{
                  borderTop: "1px solid rgba(212,184,148,0.30)",
                  paddingTop: 28,
                  paddingInlineEnd: 12,
                }}
              >
                <p
                  className="sb-num"
                  style={{
                    fontFamily: "var(--font-sb-display), serif",
                    fontSize: 14,
                    color: "var(--sb-gold-soft)",
                    letterSpacing: "0.06em",
                    fontWeight: 500,
                  }}
                >
                  {step.time}
                </p>
                <h3
                  style={{
                    fontFamily: "var(--font-sb-display), serif",
                    fontSize: 30,
                    fontWeight: 600,
                    marginTop: 12,
                    lineHeight: 1.2,
                    color: "var(--sb-cream)",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    lineHeight: 1.85,
                    color: "rgba(250,246,238,0.72)",
                  }}
                >
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

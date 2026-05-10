import { ingredientsCopy } from "../copy";
import { Reveal } from "../components/Reveal";

export function Ingredients() {
  return (
    <section
      style={{
        background:
          "radial-gradient(80% 50% at 100% 0%, rgba(184,153,104,0.08) 0%, transparent 60%), " +
          "linear-gradient(180deg, var(--sb-cream) 0%, #f3ead8 100%)",
        paddingBlock: "clamp(72px, 10vw, 140px)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-6 md:px-10">
        <Reveal>
          <div className="max-w-[760px]">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{ingredientsCopy.eyebrow}</span>
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(36px, 5.4vw, 70px)",
                lineHeight: 1.05,
                fontWeight: 600,
                color: "var(--sb-charcoal)",
                marginTop: 18,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
              }}
            >
              {ingredientsCopy.headline}
            </h2>
            <p
              style={{
                marginTop: 22,
                fontSize: 16,
                lineHeight: 1.95,
                color: "var(--sb-charcoal-soft)",
                maxWidth: 580,
              }}
            >
              {ingredientsCopy.body}
            </p>
          </div>
        </Reveal>

        <div className="mt-16 lg:mt-24 space-y-8 md:space-y-10">
          {ingredientsCopy.items.map((item, i) => (
            <Reveal key={item.name} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <article
                style={{
                  background: "rgba(255,252,244,0.7)",
                  border: "1px solid rgba(184,153,104,0.16)",
                  borderRadius: 4,
                  padding: "clamp(28px,4vw,48px)",
                  boxShadow: "var(--sb-shadow-sm)",
                }}
                className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start"
              >
                {/* Numeric label */}
                <div className="md:col-span-2">
                  <span
                    className="sb-num"
                    style={{
                      fontFamily: "var(--font-sb-latin), serif",
                      fontStyle: "italic",
                      fontSize: "clamp(48px, 6vw, 80px)",
                      fontWeight: 500,
                      color: "var(--sb-gold)",
                      lineHeight: 0.85,
                    }}
                  >
                    0{i + 1}
                  </span>
                </div>
                {/* Name + Amount */}
                <div className="md:col-span-4">
                  <p
                    className="sb-eyebrow"
                    style={{ color: "var(--sb-gold-deep)", marginBottom: 8 }}
                  >
                    {item.amount}
                  </p>
                  <h3
                    style={{
                      fontFamily: "var(--font-sb-display), serif",
                      fontSize: "clamp(28px, 3vw, 40px)",
                      fontWeight: 600,
                      color: "var(--sb-charcoal)",
                      lineHeight: 1.1,
                    }}
                  >
                    {item.arabic}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-sb-latin), serif",
                      fontStyle: "italic",
                      fontSize: 16,
                      color: "var(--sb-stone)",
                      marginTop: 4,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {item.name}
                  </p>
                </div>
                {/* Body */}
                <div className="md:col-span-6">
                  <p
                    style={{
                      fontFamily: "var(--font-sb-display), serif",
                      fontSize: "clamp(20px, 2vw, 26px)",
                      fontWeight: 500,
                      color: "var(--sb-charcoal)",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.lede}
                  </p>
                  <p
                    style={{
                      marginTop: 14,
                      fontSize: 15,
                      lineHeight: 1.95,
                      color: "var(--sb-charcoal-soft)",
                    }}
                  >
                    {item.body}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={3}>
          <p
            style={{
              marginTop: 56,
              textAlign: "center",
              fontFamily: "var(--font-sb-latin), serif",
              fontStyle: "italic",
              fontSize: 16,
              color: "var(--sb-stone)",
              letterSpacing: "0.04em",
            }}
          >
            — formulated quietly · made deliberately —
          </p>
        </Reveal>
      </div>
    </section>
  );
}

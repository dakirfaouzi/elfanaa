import { benefitsCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { IconLeaf, IconShine, IconHeart, IconSparkle } from "../components/Icons";

const ICONS = [IconLeaf, IconShine, IconHeart, IconSparkle];

export function Benefits() {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #f3ead8 0%, var(--sb-cream) 100%)",
        paddingBlock: "clamp(72px, 9vw, 130px)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Reveal>
          <div className="text-center max-w-[640px] mx-auto">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{benefitsCopy.eyebrow}</span>
              <span className="sb-rule" />
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(34px, 5vw, 64px)",
                lineHeight: 1.1,
                fontWeight: 600,
                color: "var(--sb-charcoal)",
                marginTop: 18,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
              }}
            >
              {benefitsCopy.headline}
            </h2>
          </div>
        </Reveal>

        <div className="mt-14 lg:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {benefitsCopy.cards.map((card, i) => {
            const Icon = ICONS[i] ?? IconSparkle;
            return (
              <Reveal key={card.title} delay={((i % 4) + 1) as 1 | 2 | 3 | 4}>
                <article
                  style={{
                    background: "rgba(255,252,244,0.72)",
                    border: "1px solid rgba(184,153,104,0.18)",
                    borderRadius: 4,
                    padding: "32px 28px 30px",
                    minHeight: 240,
                    boxShadow: "var(--sb-shadow-sm)",
                    transition:
                      "transform 320ms cubic-bezier(0.22,1,0.36,1), box-shadow 320ms ease, background 320ms ease",
                    cursor: "default",
                  }}
                  className="hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "linear-gradient(160deg, #fdf3dd 0%, #ecd6a8 100%)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--sb-gold-deep)",
                      boxShadow: "inset 0 0 0 1px rgba(184,153,104,0.20)",
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3
                    style={{
                      marginTop: 22,
                      fontFamily: "var(--font-sb-display), serif",
                      fontWeight: 600,
                      fontSize: 22,
                      color: "var(--sb-charcoal)",
                      lineHeight: 1.25,
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 14.5,
                      lineHeight: 1.85,
                      color: "var(--sb-charcoal-soft)",
                    }}
                  >
                    {card.body}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

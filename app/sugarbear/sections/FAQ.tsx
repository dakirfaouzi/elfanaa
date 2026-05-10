import { faqCopy } from "../copy";
import { Reveal } from "../components/Reveal";
import { IconPlus } from "../components/Icons";

export function FAQ() {
  return (
    <section
      style={{
        background: "var(--sb-cream)",
        paddingBlock: "clamp(72px, 9vw, 130px)",
      }}
    >
      <div className="mx-auto max-w-[920px] px-6 md:px-10">
        <Reveal>
          <div className="text-center">
            <p className="sb-eyebrow">
              <span className="sb-rule" />
              <span style={{ margin: "0 12px" }}>{faqCopy.eyebrow}</span>
              <span className="sb-rule" />
            </p>
            <h2
              style={{
                fontFamily: "var(--font-sb-display), serif",
                fontSize: "clamp(34px, 5vw, 60px)",
                fontWeight: 600,
                lineHeight: 1.1,
                color: "var(--sb-charcoal)",
                marginTop: 18,
                letterSpacing: "-0.01em",
              }}
            >
              {faqCopy.headline}
            </h2>
          </div>
        </Reveal>

        <div className="mt-14">
          {faqCopy.items.map((item, i) => (
            <Reveal key={item.q} delay={((i % 4) + 1) as 1 | 2 | 3 | 4}>
              <details
                className="sb-faq"
                style={{
                  borderTop: "1px solid rgba(184,153,104,0.24)",
                  borderBottom:
                    i === faqCopy.items.length - 1
                      ? "1px solid rgba(184,153,104,0.24)"
                      : "none",
                  padding: "26px 4px",
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    fontFamily: "var(--font-sb-display), serif",
                    fontSize: "clamp(18px, 2vw, 22px)",
                    fontWeight: 600,
                    color: "var(--sb-charcoal)",
                    lineHeight: 1.4,
                  }}
                >
                  <span>{item.q}</span>
                  <span
                    className="sb-faq-icon"
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid rgba(184,153,104,0.30)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--sb-gold-deep)",
                      background: "rgba(255,252,244,0.5)",
                    }}
                    aria-hidden
                  >
                    <IconPlus size={16} />
                  </span>
                </summary>
                <p
                  style={{
                    marginTop: 14,
                    paddingInlineEnd: 52,
                    fontSize: 15,
                    lineHeight: 1.95,
                    color: "var(--sb-charcoal-soft)",
                  }}
                >
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

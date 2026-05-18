import type { Metadata } from "next";
import { Tajawal, El_Messiri, Cormorant_Garamond } from "next/font/google";
import { SugarbearProvider } from "./state";
import "./sugarbear.css";

const sbBody = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sb-body",
  display: "swap",
});

const sbDisplay = El_Messiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sb-display",
  display: "swap",
});

const sbLatin = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sb-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sugarbear — فيتامينات شعر | جمال يومي لشعركِ",
  description:
    "تركيبة يومية تدعم كثافة الشعر، تقلّل مظهر الضعف والتقصف، وتمنحكِ نعومة ولمعاناً يبان مع كل صباح. توصيل عبر دول الخليج. الدفع عند الاستلام.",
  /*
   * Canonical URL for the Sugarbear SKU.
   *
   * The legacy `/products/sugarbear-hair` route 308-redirects here
   * (see next.config.mjs + app/products/[slug]/page.tsx), but we still
   * publish an explicit canonical on the landing page itself so:
   *   • Search engines collapse any stray inbound link onto /sugarbear.
   *   • hreflang stays consistent (Arabic-first market, same URL
   *     serves both ar-SA and en-SA — the page handles bilingual copy
   *     in-content rather than via locale-prefixed routes).
   */
  alternates: {
    canonical: "/sugarbear",
    languages: {
      "ar-SA": "/sugarbear",
      "en-SA": "/sugarbear",
      "x-default": "/sugarbear",
    },
  },
  openGraph: {
    title: "Sugarbear — فيتامينات شعر",
    description: "شعر أكثر كثافة، ولمعان يبان من أول نظرة.",
    type: "website",
    url: "/sugarbear",
  },
};

export default function SugarbearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`sb-root ${sbBody.variable} ${sbDisplay.variable} ${sbLatin.variable}`}
      style={{ fontFamily: "var(--font-sb-body), system-ui, sans-serif" }}
    >
      <SugarbearProvider>{children}</SugarbearProvider>
    </div>
  );
}

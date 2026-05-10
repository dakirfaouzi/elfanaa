import { Inter, Cormorant_Garamond, Cairo, Amiri } from "next/font/google";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChromeGate } from "@/components/layout/ChromeGate";
import { Providers } from "./providers";
import { DEFAULT_LOCALE, getDirection } from "@/lib/i18n";
import { htmlLangFor, siteMetadata } from "@/lib/seo";
import "./globals.css";

/**
 * Typography — paired across Latin and Arabic with one principle:
 *   • One sans for UI (Inter / Cairo) — quiet, neutral, never decorative.
 *   • One display for moments (Cormorant Garamond / Amiri) — used for
 *     hero headlines, brand wordmarks, and emotional pull-quotes only.
 *
 * **Amiri** is the classical-Naskh display face that the master logo for
 * "الفناء" was lettered in. We pair it with Cormorant Garamond's editorial
 * register so the Latin wordmark "ELFANAA" carries the same gravitas.
 * Both display faces are restricted to brand & headline surfaces so the
 * UI workhorses (Inter / Cairo) stay quiet.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const arabic = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const arabicDisplay = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-arabic-display",
  display: "swap",
});

/**
 * Metadata is delegated to `lib/seo.ts` which composes brand name, tagline,
 * and OG card copy from a single source of truth (`data/site.ts`). Per-page
 * routes can override via `pageMetadata({ title, description, ... })`.
 */
export const metadata = siteMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const dir = getDirection(DEFAULT_LOCALE);
  return (
    <html
      lang={htmlLangFor(DEFAULT_LOCALE)}
      dir={dir}
      className={`${inter.variable} ${display.variable} ${arabic.variable} ${arabicDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <Providers>
          <ChromeGate>
            <AnnouncementBar />
            <Header />
          </ChromeGate>
          <main id="main">{children}</main>
          <ChromeGate>
            <Footer />
          </ChromeGate>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — Studio is single-locale English-only (internal tool).
 *
 * `metadataBase` is intentionally NOT set; Studio is gated behind JWT auth
 * and not crawlable. We use `robots: noindex,nofollow` defence-in-depth in
 * case the JWT is misconfigured and the app accidentally goes public.
 */
export const metadata: Metadata = {
  title: "Fanaa Studio",
  description: "Internal AI ecommerce production system",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "data:," }, // No favicon yet — empty data URI silences 404s.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}

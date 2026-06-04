import type { Metadata } from "next";
import { PolicyPage } from "@/components/sections/legal/PolicyPage";
import { pageMetadata } from "@/lib/seo";
import { legalContent } from "@/data/legal";

export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/terms",
  title: legalContent.terms.ar.eyebrow,
  description: legalContent.terms.ar.intro,
});

export default function TermsPage() {
  return <PolicyPage docKey="terms" />;
}

import type { Metadata } from "next";
import { PolicyPage } from "@/components/sections/legal/PolicyPage";
import { pageMetadata } from "@/lib/seo";
import { legalContent } from "@/data/legal";

export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/faq",
  title: legalContent.faq.ar.eyebrow,
  description: legalContent.faq.ar.intro,
});

export default function FaqPage() {
  return <PolicyPage docKey="faq" />;
}

import type { Metadata } from "next";
import { PolicyPage } from "@/components/sections/legal/PolicyPage";
import { pageMetadata } from "@/lib/seo";
import { legalContent } from "@/data/legal";

export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/privacy",
  title: legalContent.privacy.ar.eyebrow,
  description: legalContent.privacy.ar.intro,
});

export default function PrivacyPage() {
  return <PolicyPage docKey="privacy" />;
}

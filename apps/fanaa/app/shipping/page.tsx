import type { Metadata } from "next";
import { PolicyPage } from "@/components/sections/legal/PolicyPage";
import { pageMetadata } from "@/lib/seo";
import { legalContent } from "@/data/legal";

export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/shipping",
  title: legalContent.shipping.ar.eyebrow,
  description: legalContent.shipping.ar.intro,
});

export default function ShippingPage() {
  return <PolicyPage docKey="shipping" />;
}

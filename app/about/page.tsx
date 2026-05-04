import type { Metadata } from "next";
import { AboutHero } from "@/components/sections/about/AboutHero";
import { AboutManifesto } from "@/components/sections/about/AboutManifesto";
import { AboutPillars } from "@/components/sections/about/AboutPillars";
import { AboutPromise } from "@/components/sections/about/AboutPromise";
import { AboutCta } from "@/components/sections/about/AboutCta";
import { pageMetadata } from "@/lib/seo";
import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * About — emotional brand storytelling.
 *
 * Page architecture follows the premium DTC playbook
 * (Article, Cuyana, Floyd, Outdoor Voices teardowns):
 *
 *   1. Hero            — single image + the "founding sentence"
 *   2. Manifesto       — the belief that drives the brand
 *   3. Three pillars   — translates belief into operating rules
 *   4. Promise         — what the customer gets, in plain words
 *   5. CTA             — one button back into the catalogue
 *
 * Every section sits on a left-image / right-text rhythm (alternated)
 * so the reader's eye is always rewarded with a photograph after a
 * paragraph of copy.
 */
export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/about",
  title: dictionaries.ar.about.heroEyebrow,
  description: dictionaries.ar.about.heroBody,
});

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutManifesto />
      <AboutPillars />
      <AboutPromise />
      <AboutCta />
    </>
  );
}

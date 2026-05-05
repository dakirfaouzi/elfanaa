import { HomeHero } from "@/components/sections/HomeHero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { ShopByFeeling } from "@/components/sections/ShopByFeeling";
import { BestSellers } from "@/components/sections/BestSellers";
import { Testimonials } from "@/components/sections/Testimonials";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { BrandStory } from "@/components/sections/BrandStory";
import { UrgencyCta } from "@/components/sections/UrgencyCta";
import { getBestSellers } from "@/data/products";

/**
 * Homepage composition — Clinical Beauty Conversion Funnel.
 *
 *   1. Hero            — Pain → Cause → Solution + COD trust
 *   2. Trust strip     — three KSA-specific pillars (COD / 48h / 14-day)
 *   3. Diagnosis       — problem-identification tiles (self-recognition)
 *   4. Clinical Mechanism — HOW the formulas work (authority builder)
 *   5. Best sellers    — product grid with bundle math
 *   6. Testimonials    — Saudi social proof
 *   7. Differentiation — "Why Fanaa is different" (competitive moat)
 *   8. Urgency CTA     — final offer with scarcity + clear bundle
 *
 * Funnel logic:
 *   Hook → Trust → Self-identify → Authority → Solution → Proof → Moat → Close
 */
export default function HomePage() {
  const bestSellers = getBestSellers();
  return (
    <>
      <HomeHero />
      <TrustStrip />
      <ShopByFeeling />
      <HowItWorks />
      <BestSellers products={bestSellers} />
      <Testimonials />
      <BrandStory />
      <UrgencyCta />
    </>
  );
}

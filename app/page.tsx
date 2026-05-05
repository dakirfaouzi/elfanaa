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
 * Homepage composition (top → bottom) — Saudi DTC funnel.
 *
 *   1. Hero            — Pain → Cause → Solution → Result + COD trust
 *   2. Trust strip     — three KSA-specific pillars (COD / 48h / 14-day)
 *   3. "هذا أنا"        — problem-identification tiles, the user's words
 *   4. Best sellers    — bundle-aware product grid (1/2/3 offer visible)
 *   5. Testimonials    — Saudi names, cities, verified results
 *   6. How it works    — 5-step COD reframed as "no risk, no surprises"
 *   7. Brand story     — formulated for KSA climate (emotional anchor)
 *   8. Urgency CTA     — final-fold offer ("349 SAR — save 248")
 *
 * Sequence rationale:
 *   • Hero introduces the pain.
 *   • Trust strip de-risks the brand in the first 2 seconds.
 *   • Problem tiles let the user self-identify ("this is me").
 *   • Best sellers show the *solution* and the bundle math.
 *   • Testimonials provide Saudi social proof.
 *   • How-it-works addresses the COD anxiety LAST before the CTA.
 *   • Story delivers the emotional anchor for premium positioning.
 *   • Urgency CTA closes with the offer + reassurance + single button.
 *
 * Sections are flat siblings; ordering and spacing live here, not inside
 * children, so re-merchandising the page is a one-file edit.
 */
export default function HomePage() {
  const bestSellers = getBestSellers();
  return (
    <>
      <HomeHero />
      <TrustStrip />
      <ShopByFeeling />
      <BestSellers products={bestSellers} />
      <Testimonials />
      <HowItWorks />
      <BrandStory />
      <UrgencyCta />
    </>
  );
}

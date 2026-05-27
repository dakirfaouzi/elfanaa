import { HomeHero } from "@/components/sections/HomeHero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { CollectionRow } from "@/components/sections/CollectionRow";
import { ShopByFeeling } from "@/components/sections/ShopByFeeling";
import { BestSellers } from "@/components/sections/BestSellers";
import { Testimonials } from "@/components/sections/Testimonials";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { BrandStory } from "@/components/sections/BrandStory";
import { UrgencyCta } from "@/components/sections/UrgencyCta";
import { loadBestSellers } from "@/lib/catalog/loader";

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

/*
 * ISR window for the homepage best-sellers band. The hybrid catalog
 * loader (M12 / Step 2) merges live `storefront_catalog_product`
 * commerce metadata onto the build-time snapshot, so operator-edited
 * price / badge / rating / stock changes appear within ~60s without
 * a redeploy. If the DB is unreachable, the loader transparently
 * falls back to the snapshot and the page stays online.
 */
export const revalidate = 60;

export default async function HomePage() {
  const bestSellers = await loadBestSellers();
  return (
    <>
      <HomeHero />
      <TrustStrip />
      <CollectionRow />
      <ShopByFeeling />
      <HowItWorks />
      <BestSellers products={bestSellers} />
      <Testimonials />
      <BrandStory />
      <UrgencyCta />
    </>
  );
}

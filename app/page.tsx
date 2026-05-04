import { HomeHero } from "@/components/sections/HomeHero";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { ShopByFeeling } from "@/components/sections/ShopByFeeling";
import { BestSellers } from "@/components/sections/BestSellers";
import { Testimonials } from "@/components/sections/Testimonials";
import { BrandStory } from "@/components/sections/BrandStory";
import { getBestSellers } from "@/data/products";

/**
 * Homepage composition (top → bottom):
 *
 *   1. Hero               — single CTA above the fold (NN/g + VWO research)
 *   2. Trust strip        — answers "is this brand trustworthy?" in <2s
 *   3. Shop by Feeling    — mood-led entry, Pottery Barn pattern
 *   4. Best sellers       — curated grid, lifestyle imagery
 *   5. Testimonials       — qualitative social proof from real cities
 *   6. Brand story        — emotional anchor for premium positioning
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
      <BrandStory />
    </>
  );
}

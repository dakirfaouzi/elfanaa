import { SugarbearTopBar } from "./components/TopBar";
import { Hero } from "./sections/Hero";
import { Transformation } from "./sections/Transformation";
import { BeforeAfter } from "./sections/BeforeAfter";
import { Benefits } from "./sections/Benefits";
import { Ingredients } from "./sections/Ingredients";
import { Ritual } from "./sections/Ritual";
import { Reviews } from "./sections/Reviews";
import { Offers } from "./sections/Offers";
import { FAQ } from "./sections/FAQ";
import { FinalCTA } from "./sections/FinalCTA";
import { StickyCTA } from "./sections/StickyCTA";

export default function SugarbearPage() {
  return (
    <>
      <SugarbearTopBar />
      <Hero />
      <Transformation />
      <BeforeAfter />
      <Benefits />
      <Ingredients />
      <Ritual />
      <Reviews />
      <Offers />
      <FAQ />
      <FinalCTA />
      <StickyCTA />
    </>
  );
}

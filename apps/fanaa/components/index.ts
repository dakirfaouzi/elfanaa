/**
 * Public component barrel.
 *
 * Treat this file as the storefront's "public API". Routes & sections may
 * import from `@/components`; internal helpers (e.g. CartLineItem) stay
 * unexported and reach each other via relative paths inside their feature
 * folder. This keeps refactors safe — anything not listed here is private.
 */

export { Container } from "./layout/Container";
export { Header } from "./layout/Header";
export { Footer } from "./layout/Footer";
export { AnnouncementBar } from "./layout/AnnouncementBar";

export { Logo, BrandMark } from "./brand";

export { Button } from "./ui/Button";
export { Badge } from "./ui/Badge";
export { Price } from "./ui/Price";
export { Drawer } from "./ui/Drawer";
export { Modal } from "./ui/Modal";
export { Input, Textarea, Field } from "./ui/Input";

export { ProductCard } from "./product/ProductCard";
export { ProductGrid } from "./product/ProductGrid";
export { ProductGallery } from "./product/ProductGallery";
export { AddToCartButton } from "./product/AddToCartButton";

export { CartDrawer } from "./cart/CartDrawer";
export { CartTrigger } from "./cart/CartTrigger";

export { CodCheckoutModal } from "./checkout/CodCheckoutModal";
export { CrossSellSlot } from "./cart/CrossSellSlot";
export { PostPurchaseUpsell } from "./checkout/PostPurchaseUpsell";

export { MobileStickyCTA } from "./layout/MobileStickyCTA";

export { HomeHero } from "./sections/HomeHero";
export { ShopByFeeling } from "./sections/ShopByFeeling";
export { BestSellers } from "./sections/BestSellers";
export { BrandStory } from "./sections/BrandStory";
export { TrustStrip } from "./sections/TrustStrip";
export { FeaturedCollection } from "./sections/FeaturedCollection";

export {
  ConfirmationHero,
  DeliveryTimeline,
  OrderReceipt,
  UpsellAcceptedBanner,
  TrustReinforcement,
  ThankYouCrossSells,
  ThankYouRecommendations,
  ContactPanel,
} from "./thankyou";

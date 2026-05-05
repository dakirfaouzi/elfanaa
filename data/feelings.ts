import type { LocalizedString } from "@/lib/types";

/**
 * "هذا أنا" — problem-identification tiles (Health & Beauty edition).
 *
 * Each tile names a *problem the customer is already living with*, then
 * routes them to the product that solves it. This is the classic Saudi
 * direct-response "هذا أنا" moment — the user reads a tile, feels seen,
 * and clicks. The label is the PROBLEM, the caption is the SOLUTION,
 * the CTA is the PRODUCT.
 *
 * Order is intentional:
 *   1. Skincare (broadest pain — sun spots / dullness)
 *   2. Grooming (men identity, narrow & strong)
 *   3. Haircare (women, abaya + heat damage)
 *   4. Routine bundle (highest-AOV path — the offer-led tile)
 */
export type Feeling = {
  id: string;
  /** The problem statement — short, specific, customer's own words. */
  label: LocalizedString;
  /** The solution one-liner — names the product implicitly, names the result. */
  caption: LocalizedString;
  href: string;
  image: { src: string; alt: LocalizedString };
};

export const feelings: Feeling[] = [
  {
    id: "spots",
    label: { ar: "بقع وكلف الشمس", en: "Sun spots & melasma" },
    caption: {
      ar: "بقع داكنة من الشمس؟ بشرة باهتة؟ سيرومنا يبدأ شغله من اليوم الأول.",
      en: "Dark spots from the sun? Dull skin? Our serum starts working from day one.",
    },
    href: "/shop?collection=skincare",
    image: {
      src: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1400&q=80",
      alt: { ar: "بشرة بحاجة للإشراق", en: "Skin needing glow" },
    },
  },
  {
    id: "beard",
    label: { ar: "فراغات اللحية", en: "Patchy beard" },
    caption: {
      ar: "فراغات في اللحية؟ بشرة جافة وحكّة؟ زيتنا يحلّها بـ ٣٠ ثانية في اليوم.",
      en: "Patchy beard? Dry, itchy skin underneath? Our oil fixes it in 30 seconds a day.",
    },
    href: "/shop?collection=grooming",
    image: {
      src: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=1400&q=80",
      alt: { ar: "عناية رجالية باللحية", en: "Men's beard care" },
    },
  },
  {
    id: "damage",
    label: { ar: "تلف وتقصّف الشعر", en: "Damaged & breaking hair" },
    caption: {
      ar: "تكسّر، جفاف، تساقط من الحرارة والتصفيف؟ القناع يرجّع الحيوية من أول جلسة.",
      en: "Breakage, dryness, fallout from heat and styling? The mask brings life back from session one.",
    },
    href: "/shop?collection=haircare",
    image: {
      src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=80",
      alt: { ar: "شعر بحاجة لترطيب", en: "Hair needing repair" },
    },
  },
  {
    id: "bundle",
    label: { ar: "الكل في روتين واحد", en: "All in one routine" },
    caption: {
      ar: "اطلب الثلاثة بـ ٣٤٩ ريال — وفّر ٢٤٨ ريال. الأكثر مبيعاً.",
      en: "Order all three for 349 SAR — save 248. Our best-selling routine.",
    },
    href: "/shop",
    image: {
      src: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&q=80",
      alt: { ar: "روتين العناية الكامل", en: "Complete care routine" },
    },
  },
];

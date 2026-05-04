import type { LocalizedString } from "@/lib/types";

/**
 * "Shop by Goal" entry points — Health & Beauty edition.
 *
 * Goal-led navigation (Hims / The Ordinary pattern). Each tile maps to a
 * collection slug. Keep the list TIGHT — 4 tiles, covering the 4 main
 * care goals for KSA customers: glow, grooming, hair, wellness.
 */
export type Feeling = {
  id: string;
  /** Short Arabic goal label that anchors the tile. */
  label: LocalizedString;
  /** One-line subline shown on hover / under label. */
  caption: LocalizedString;
  href: string;
  image: { src: string; alt: LocalizedString };
};

export const feelings: Feeling[] = [
  {
    id: "glow",
    label: { ar: "إشراق البشرة", en: "Skin glow" },
    caption: {
      ar: "سيروم مركّز يشتغل على التبقّع وعدم التجانس — مناسب للرجال والنساء.",
      en: "A concentrated serum targeting dark spots and uneven tone — for both men and women.",
    },
    href: "/shop?collection=skincare",
    image: {
      src: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1400&q=80",
      alt: { ar: "عناية بالبشرة وإشراق", en: "Skincare and glow" },
    },
  },
  {
    id: "grooming",
    label: { ar: "عناية الرجال", en: "Men's care" },
    caption: {
      ar: "زيت العناية الأصيل — للوجه واللحية معاً، يختفي بدون لمعة.",
      en: "The original grooming oil — for face and beard, absorbs without shine.",
    },
    href: "/shop?collection=grooming",
    image: {
      src: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=1400&q=80",
      alt: { ar: "عناية رجالية", en: "Men's grooming" },
    },
  },
  {
    id: "hair",
    label: { ar: "عناية الشعر", en: "Hair care" },
    caption: {
      ar: "قناع أسبوعي عميق يرجّع الحيوية — نتائج من أول استخدام.",
      en: "A weekly deep mask that restores vitality — results from the first use.",
    },
    href: "/shop?collection=haircare",
    image: {
      src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=80",
      alt: { ar: "شعر صحي ومشرق", en: "Healthy shiny hair" },
    },
  },
  {
    id: "routine",
    label: { ar: "الروتين الكامل", en: "Full routine" },
    caption: {
      ar: "اطلب الثلاثة معاً بـ ٣٤٩ ريال — الأكثر توفيراً والأكثر طلباً.",
      en: "Order all three for 349 SAR — best value, most ordered.",
    },
    href: "/shop",
    image: {
      src: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&q=80",
      alt: { ar: "روتين العناية الكامل", en: "Complete care routine" },
    },
  },
];

import type { LocalizedString } from "@/lib/types";

/**
 * "هذا أنا" — problem-identification tiles (Clinical Beauty edition).
 *
 * Each tile names a *problem the customer is already living with*, then
 * routes them to the product that solves it. The label is the PROBLEM,
 * the caption is the SOLUTION.
 */
export type Feeling = {
  id: string;
  label: LocalizedString;
  caption: LocalizedString;
  href: string;
  image: { src: string; alt: LocalizedString };
  branded?: boolean;
  amount?: LocalizedString;
  saveBadge?: LocalizedString;
};

export const feelings: Feeling[] = [
  {
    id: "spots",
    label: { ar: "بقع وتصبغات", en: "Spots & Pigmentation" },
    caption: {
      ar: "بشرة باهتة وبقع داكنة؟ السيروم يفتتها من الجذور.",
      en: "Dull skin and dark spots? The serum breaks them down at the root.",
    },
    href: "/concerns/dark-spots",
    image: {
      src: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1400&q=80",
      alt: { ar: "بشرة بحاجة للإشراق", en: "Skin needing glow" },
    },
  },
  {
    id: "barrier",
    label: { ar: "جفاف وحاجز متضرر", en: "Dryness & Broken Barrier" },
    caption: {
      ar: "بشرة تشرب المرطبات وتبقى جافة؟ كريم السيراميد يبني جدار الحماية.",
      en: "Skin drinks moisturizers but stays dry? The ceramide cream builds a protective wall.",
    },
    href: "/concerns/dryness",
    image: {
      src: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1400&q=80",
      alt: { ar: "عناية بحاجز البشرة", en: "Skin barrier care" },
    },
  },
  {
    id: "damage",
    label: { ar: "تلف وتقصّف الشعر", en: "Damaged & Breaking Hair" },
    caption: {
      ar: "تكسّر وجفاف من الحرارة والمياه؟ القناع يرجّع الحيوية من أول جلسة.",
      en: "Breakage and dryness from heat and water? The mask brings life back from session one.",
    },
    href: "/concerns/breakage",
    image: {
      src: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&q=80",
      alt: { ar: "شعر بحاجة لترطيب", en: "Hair needing repair" },
    },
  },
  {
    id: "bundle",
    label: { ar: "روتين التجديد الشامل", en: "The Revival Routine" },
    caption: {
      ar: "السيروم + الكريم + القناع. روتينك الكامل.",
      en: "Serum + Cream + Mask. Your complete routine.",
    },
    href: "/shop",
    branded: true,
    amount: { ar: "٣٤٩ ر.س", en: "349 SAR" },
    saveBadge: { ar: "وفّر ٢٤٨", en: "Save 248" },
    image: {
      src: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1400&q=80",
      alt: { ar: "روتين العناية الكامل", en: "Complete care routine" },
    },
  },
];

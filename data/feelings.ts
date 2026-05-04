import type { LocalizedString } from "@/lib/types";

/**
 * "Shop by Feeling" entry points.
 *
 * Mood-led navigation (Article + Pottery Barn pattern). Each tile maps to a
 * collection slug or a search query. Keep the list TIGHT — Pottery Barn's
 * redesign cut nav from 10 → 5; this is the same discipline applied to mood.
 */
export type Feeling = {
  id: string;
  /** Single-word Arabic mood label that anchors the tile. */
  label: LocalizedString;
  /** One-line subline shown on hover / under label. */
  caption: LocalizedString;
  href: string;
  image: { src: string; alt: LocalizedString };
};

export const feelings: Feeling[] = [
  {
    id: "calm",
    label: { ar: "أجواء هادئة", en: "Calm air" },
    caption: {
      ar: "خامات طبيعية وألوان دافئة تخلّي البيت يتنفّس.",
      en: "Natural textures and warm tones — a home that breathes.",
    },
    href: "/shop?collection=living",
    image: {
      src: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1400&q=80",
      alt: { ar: "غرفة معيشة هادئة", en: "Calm living room" },
    },
  },
  {
    id: "modern",
    label: { ar: "بيت عصري", en: "Modern home" },
    caption: {
      ar: "خطوط نظيفة وقطع مدروسة لبيت يشبه ذوقك اليوم.",
      en: "Clean lines and considered pieces for a home that feels current.",
    },
    href: "/shop?collection=decor",
    image: {
      src: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1400&q=80",
      alt: { ar: "بيت عصري", en: "Modern home interior" },
    },
  },
  {
    id: "coffee",
    label: { ar: "ركن القهوة", en: "Coffee corner" },
    caption: {
      ar: "كل شي تحتاجه عشان تبدأ صباحك بطقسك المفضّل.",
      en: "Everything you need for the morning ritual you've been promising yourself.",
    },
    href: "/shop?collection=coffee",
    image: {
      src: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1400&q=80",
      alt: { ar: "ركن قهوة", en: "Coffee corner" },
    },
  },
  {
    id: "luxe",
    label: { ar: "لمسة فخمة", en: "Luxe touch" },
    caption: {
      ar: "تفاصيل نحاسية وقماش فاخر — لما تبي قطعة تشد النظر.",
      en: "Brass, linen, and slow craft — for the piece that anchors the room.",
    },
    href: "/shop?collection=lighting",
    image: {
      src: "https://images.unsplash.com/photo-1532372576444-dda954194ad0?w=1400&q=80",
      alt: { ar: "لمسة فخمة", en: "Luxe interior" },
    },
  },
];

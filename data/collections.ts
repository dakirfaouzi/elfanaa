import type { Collection, ProductProblem } from "@/lib/types";
import { products } from "./products";

/* ─────────────────────── Helpers ─────────────────────── */

const byCollection = (slug: string) =>
  products.filter((p) => p.collection === slug).map((p) => p.id);

const byProblems = (problems: ProductProblem[]) =>
  products
    .filter((p) => p.problems?.some((pr) => problems.includes(pr)))
    .map((p) => p.id);

/* ──────────────────── Main collections (live) ──────────────────── */

/**
 * The three primary catalog sections.
 * Slugs are stable — used as URL params (`?collection=face`) and in
 * the ChipNav, MobileNav, Footer, and now the mega menu.
 */
export const collections: Collection[] = [
  {
    id: "c_face",
    slug: "face",
    type: "main",
    title: { ar: "سر البشرة", en: "Skin's Secret" },
    tagline: { ar: "سيروم وكريم الوجه", en: "Face Serum & Cream" },
    description: {
      ar: "بشرة مشرقة وحاجز محمي — سيروم فيتامين C بنسبة علاجية وكريم السيراميد الخماسي، معاً في روتين دقيقتين.",
      en: "Glowing skin and a protected barrier — therapeutic Vitamin C serum and five-ceramide cream, together in a two-minute routine.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1800&q=88&auto=format&fit=crop&crop=center",
    productIds: byCollection("face"),
  },
  {
    id: "c_hair",
    slug: "hair",
    type: "main",
    title: { ar: "تاج الشعر", en: "Crown of Hair" },
    tagline: { ar: "قناع الترميم الأسبوعي", en: "Weekly Repair Mask" },
    description: {
      ar: "خمس دقائق في الأسبوع تكفي. كيراتين نباتي وأرغان عضوي يدخلان خيط الشعر ويصلّحان الكسور من الداخل.",
      en: "Five minutes a week is enough. Vegan keratin and organic argan penetrate the hair shaft and mend breakage from within.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1800&q=88&auto=format&fit=crop&crop=center",
    productIds: byCollection("hair"),
  },
  {
    id: "c_routine",
    slug: "routine",
    type: "main",
    title: { ar: "روتين فناء", en: "The Fanaa Ritual" },
    tagline: { ar: "الطقم الكامل — وجه وشعر", en: "Complete Set — Face & Hair" },
    description: {
      ar: "ثلاثة منتجات تعمل معاً — سيروم، كريم، قناع. وجهك وشعرك في روتين واحد متكامل بسعر استثنائي.",
      en: "Three products that work as one system — serum, cream, mask. Face and hair in one complete routine at an exceptional price.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1800&q=88&auto=format&fit=crop&crop=center",
    productIds: products.map((p) => p.id),
  },
];

/* ──────────────────── Concern collections ──────────────────── */

/**
 * Problem-solving collections — pre-filter the catalog by the
 * concerns a customer arrives with. Each concern page shows the
 * relevant products and pre-seeds the filter panel.
 */
export const concernCollections: Collection[] = [
  {
    id: "c_concern_spots",
    slug: "dark-spots",
    type: "concern",
    title: { ar: "للبقع والكلف", en: "Dark Spots" },
    tagline: { ar: "حلول التبقّع من الجذور", en: "Spot solutions from the root" },
    description: {
      ar: "بقع داكنة وكلف من شمس السعودية؟ تركيباتنا تفتّت التصبّغ من خلايا البشرة — لا تخفيه، بل تحطّمه.",
      en: "Dark spots and melasma from the Saudi sun? Our formulas break pigmentation at the cell level — not just cover it.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1800&q=88&auto=format&fit=crop&crop=center",
    presetProblems: ["dark-spots", "uneven-tone"],
    productIds: byProblems(["dark-spots", "uneven-tone"]),
  },
  {
    id: "c_concern_dryness",
    slug: "dryness",
    type: "concern",
    title: { ar: "للجفاف وحاجز البشرة", en: "Dryness & Barrier" },
    tagline: { ar: "ترطيب عميق يدوم ٢٤ ساعة", en: "24-hour deep hydration" },
    description: {
      ar: "التكييف والمياه الثقيلة يكسران حاجز بشرتك ويجففانها. منتجاتنا تبني الحاجز من جديد وتقفل الرطوبة للداخل.",
      en: "AC and hard water break your skin barrier and dehydrate it. Our products rebuild the barrier and lock moisture in.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1800&q=88&auto=format&fit=crop&crop=center",
    presetProblems: ["dryness", "barrier-damage", "sensitive-skin"],
    productIds: byProblems(["dryness", "barrier-damage", "sensitive-skin"]),
  },
  {
    id: "c_concern_breakage",
    slug: "breakage",
    type: "concern",
    title: { ar: "لتقصف الشعر وتكسّره", en: "Hair Breakage" },
    tagline: { ar: "تقوية وترميم الخيط من الداخل", en: "Strengthen and repair from within" },
    description: {
      ar: "الحرارة والصبغات والمياه الثقيلة تتلف الشعر تدريجياً. قناعنا يرجّع البروتين المفقود ويوقف التكسر الجديد.",
      en: "Heat, dye, and hard water progressively damage hair. Our mask restores lost protein and stops new breakage.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1519735777090-ec97162dc266?w=1800&q=88&auto=format&fit=crop&crop=center",
    presetProblems: ["breakage", "hair-damage", "hair-dryness", "color-treated"],
    productIds: byProblems(["breakage", "hair-damage", "hair-dryness", "color-treated"]),
  },
];

/* ──────────────────── Gender collections ──────────────────── */

export const genderCollections: Collection[] = [
  {
    id: "c_gender_women",
    slug: "women",
    type: "gender",
    title: { ar: "عناية المرأة", en: "Women's Care" },
    tagline: { ar: "روتين البشرة والشعر", en: "Skin & hair routine" },
    description: {
      ar: "منتجات فناء المطوّرة للمرأة السعودية — بشرة مشرقة وشعر قوي في روتين يومي بسيط.",
      en: "Fanaa products developed for Saudi women — glowing skin and strong hair in a simple daily routine.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1800&q=88&auto=format&fit=crop&crop=center",
    presetTarget: "women",
    productIds: products
      .filter((p) => p.target === "women" || p.target === "unisex")
      .map((p) => p.id),
  },
  {
    id: "c_gender_men",
    slug: "men",
    type: "gender",
    title: { ar: "عناية الرجل", en: "Men's Care" },
    tagline: { ar: "روتين مصمّم للرجل", en: "Designed for men" },
    description: {
      ar: "روتين عناية بسيط وفعّال للرجل السعودي — منتجات تحمي البشرة وتجعلها تبدو صحية بدون تعقيد.",
      en: "Simple, effective care routine for Saudi men — products that protect skin and keep it looking healthy without complexity.",
    },
    heroImage:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1800&q=88&auto=format&fit=crop&crop=center",
    presetTarget: "men",
    productIds: products
      .filter((p) => p.target === "men" || p.target === "unisex")
      .map((p) => p.id),
  },
];

/* ──────────────────── Getters ──────────────────── */

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}

export function getConcernBySlug(slug: string): Collection | undefined {
  return concernCollections.find((c) => c.slug === slug);
}

export function getGenderCollectionBySlug(slug: string): Collection | undefined {
  return genderCollections.find((c) => c.slug === slug);
}

/** All browsable collections flattened — used in sitemap and full-text search. */
export const allCollections: Collection[] = [
  ...collections,
  ...concernCollections,
  ...genderCollections,
];

/**
 * Bilingual filter option definitions — single source of truth for all
 * three filter dimensions (productType, target, problems).
 *
 * These arrays define the full universe of possible values.
 * ShopExperience narrows them down to options that actually have
 * matching products in the current collection view before passing
 * them to ShopToolbar.
 */
import type {
  FilterOption,
  ProductProblem,
  ProductTarget,
  ProductType,
} from "@/lib/types";

export const productTypeOptions: FilterOption[] = [
  { value: "serum"    satisfies ProductType, label: { ar: "سيروم",    en: "Serum" } },
  { value: "cream"    satisfies ProductType, label: { ar: "كريم",     en: "Cream" } },
  { value: "mask"     satisfies ProductType, label: { ar: "قناع",     en: "Mask" } },
  { value: "oil"      satisfies ProductType, label: { ar: "زيت",      en: "Oil" } },
  { value: "capsules" satisfies ProductType, label: { ar: "كبسولات",  en: "Capsules" } },
  { value: "spray"    satisfies ProductType, label: { ar: "سبراي",    en: "Spray" } },
  { value: "device"   satisfies ProductType, label: { ar: "جهاز",     en: "Device" } },
  { value: "bundle"   satisfies ProductType, label: { ar: "طقم",      en: "Bundle" } },
] as const;

export const targetOptions: FilterOption[] = [
  { value: "women"  satisfies ProductTarget, label: { ar: "نساء",    en: "Women" } },
  { value: "men"    satisfies ProductTarget, label: { ar: "رجال",    en: "Men" } },
  { value: "unisex" satisfies ProductTarget, label: { ar: "للجنسين", en: "Unisex" } },
] as const;

/** Ordered: face concerns first, then hair, then general. */
export const problemOptions: FilterOption[] = [
  // Face / skin
  { value: "dark-spots"     satisfies ProductProblem, label: { ar: "بقع وكلف",          en: "Dark Spots" } },
  { value: "dryness"        satisfies ProductProblem, label: { ar: "الجفاف",             en: "Dryness" } },
  { value: "uneven-tone"    satisfies ProductProblem, label: { ar: "عدم توحيد اللون",   en: "Uneven Tone" } },
  { value: "barrier-damage" satisfies ProductProblem, label: { ar: "حاجز البشرة",       en: "Damaged Barrier" } },
  { value: "sensitive-skin" satisfies ProductProblem, label: { ar: "بشرة حساسة",        en: "Sensitive Skin" } },
  { value: "oily-skin"      satisfies ProductProblem, label: { ar: "بشرة دهنية",        en: "Oily Skin" } },
  { value: "pores"          satisfies ProductProblem, label: { ar: "مسام واسعة",        en: "Large Pores" } },
  // Hair
  { value: "hair-damage"    satisfies ProductProblem, label: { ar: "شعر تالف",          en: "Hair Damage" } },
  { value: "hair-dryness"   satisfies ProductProblem, label: { ar: "جفاف الشعر",        en: "Dry Hair" } },
  { value: "breakage"       satisfies ProductProblem, label: { ar: "تقصف وتكسر",        en: "Breakage" } },
  { value: "color-treated"  satisfies ProductProblem, label: { ar: "شعر مصبوغ",         en: "Color-Treated" } },
  { value: "hair-loss"      satisfies ProductProblem, label: { ar: "تساقط الشعر",       en: "Hair Loss" } },
  // General
  { value: "complete-care"  satisfies ProductProblem, label: { ar: "عناية متكاملة",     en: "Complete Care" } },
] as const;

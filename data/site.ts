import type { LocalizedString } from "@/lib/types";

/**
 * Site-wide brand & operational config.
 *
 * Treat this file as the **single source of truth** for the brand surface.
 * Header, Footer, metadata, webhook headers, storage keys, and ops dashboards
 * all read from here. A future rebrand only needs to touch this file plus the
 * `brand` keys inside `lib/i18n/dictionaries.ts`.
 *
 * About the name — فناء (Fanaa)
 * --------------------------------
 * "فناء" carries a layered meaning in Arabic: a courtyard (the open heart of
 * a home), and a Sufi concept of inner dissolution — losing the self to find
 * a deeper truth. For a Health & Beauty brand, this translates beautifully:
 * "Your beauty starts from within." The name is premium, minimal, and
 * authentically Arabic — matching the brand's KSA-first positioning.
 */
export const siteConfig = {
  /** Display name shown in the header, footer, metadata, and emails. */
  name: { ar: "الفناء", en: "ELFANAA" } satisfies LocalizedString,

  /**
   * Brand tagline — the one line that follows الفناء everywhere.
   *
   * Used in three places only (consistency rule):
   *   1. Hero lockup, beneath the brand name.
   *   2. Header logo, hidden on mobile, subtle on desktop.
   *   3. Footer brand line, inline with an em-dash.
   *
   * Anywhere else (announcement bar, breadcrumbs, secondary buttons) we
   * resist using it — overuse is what cheapens a tagline.
   */
  tagline: {
    ar: "أصلك يطلع من جوّاك",
    en: "Your beauty starts from within.",
  } satisfies LocalizedString,

  /**
   * Brand promise — one sentence that captures positioning. Used in SEO
   * descriptions and the Open Graph card so the brand reads consistently
   * across every preview surface (Google, WhatsApp, X, LinkedIn).
   */
  promise: {
    ar: "منتجات عناية مختبرة، مصممة للمناخ السعودي، توصّل لبابك وما تدفع قبل ما تشوفها.",
    en: "Lab-tested skincare formulated for the Saudi climate — delivered to your door, pay on arrival.",
  } satisfies LocalizedString,

  /**
   * Slug used as a prefix for ALL namespaced identifiers:
   *   • `${namespace}.cart.v1`        → Zustand persist key
   *   • `${namespace}.locale`         → locale storage key
   *   • `${namespace}.receipt.v1.*`   → thank-you page receipt key
   *   • `x-${namespace}-timestamp`    → outbound webhook header
   *   • `x-${namespace}-signature`    → outbound webhook header
   *
   * Lower-case ASCII, no spaces or punctuation. Changing this triggers a
   * cold-start of all client storage and re-issued webhook contracts.
   */
  namespace: "elfanaa",

  /** Canonical site URL — drives `metadataBase`, sitemap, and OG `url`. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://elfanaa.com",

  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "SAR",

  /** Free-shipping threshold in minor units (49900 = 499.00 SAR). */
  freeShippingThreshold: 49900,

  contact: {
    email: "hello@elfanaa.com",
    phone: "+966 11 000 0000",
    /** Saudi WhatsApp — digits only (used by `wa.me/...` deep links). */
    whatsapp: "+966500000000",
  },

  social: {
    instagram: "https://instagram.com/elfanaa",
    tiktok: "https://tiktok.com/@elfanaa",
    snapchat: "https://snapchat.com/add/elfanaa",
  },

  cities: [
    "الرياض",
    "جدة",
    "الدمام",
    "الخبر",
    "مكة المكرمة",
    "المدينة المنورة",
    "الطائف",
    "أبها",
    "تبوك",
    "بريدة",
  ],
} as const;

export type SiteConfig = typeof siteConfig;

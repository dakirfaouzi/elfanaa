import type { Metadata } from "next";
import { ContactHero } from "@/components/sections/contact/ContactHero";
import { ContactChannels } from "@/components/sections/contact/ContactChannels";
import { ContactForm } from "@/components/sections/contact/ContactForm";
import { ContactHours } from "@/components/sections/contact/ContactHours";
import { pageMetadata } from "@/lib/seo";
import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * Contact — calm, multi-channel, low-friction.
 *
 * The funnel is structured so customers can self-select the channel
 * that suits them:
 *   • WhatsApp     — fastest, casual
 *   • Phone        — for the customer who wants a voice
 *   • Email        — formal / partnerships
 *   • Form         — for context-rich messages they want a record of
 *
 * Hours + address sit at the bottom as a quiet trust signal — every
 * premium GCC brand surfaces a real address, even if commerce is
 * online-first.
 */
export const metadata: Metadata = pageMetadata({
  locale: "ar",
  path: "/contact",
  title: dictionaries.ar.contact.heroEyebrow,
  description: dictionaries.ar.contact.heroBody,
});

export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <ContactChannels />
      <ContactForm />
      <ContactHours />
    </>
  );
}

"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useLocale } from "@/hooks/useLocale";
import {
  formatSaudiPhoneAsYouType,
  validateSaudiPhone,
} from "@/lib/phone";
import { siteConfig } from "@/data/site";

type FormState = { fullName: string; phone: string; message: string };
type Status = "idle" | "submitting" | "sent" | "error";

const initial: FormState = { fullName: "", phone: "", message: "" };

/**
 * Contact form — fallback channel for customers who'd rather leave a
 * note than open WhatsApp. The submission posts to a WhatsApp deep link
 * (`wa.me/<number>?text=<encoded>`) by default — zero backend coupling
 * and always works, even before any contact infrastructure is wired.
 *
 * Swap to a real endpoint by changing the `submit()` body. The form
 * already validates Saudi phone numbers and trims fields the same way
 * the checkout modal does, so any backend can trust the payload.
 */
export function ContactForm() {
  const { t } = useLocale();
  const [form, setForm] = useState<FormState>(initial);
  const [status, setStatus] = useState<Status>("idle");

  const phoneCheck = validateSaudiPhone(form.phone);
  const valid =
    form.fullName.trim().length >= 2 &&
    phoneCheck.ok &&
    form.message.trim().length >= 5;

  const onChange = <K extends keyof FormState>(key: K, value: string) => {
    const next = key === "phone" ? formatSaudiPhoneAsYouType(value) : value;
    setForm((f) => ({ ...f, [key]: next }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setStatus("submitting");
    try {
      // WhatsApp deep-link fallback. When you wire a real `/api/contact`
      // endpoint, replace this block with `await fetch("/api/contact", ...)`.
      const wa = siteConfig.contact.whatsapp.replace(/[^0-9]/g, "");
      const text = [
        `${t.contact.formName}: ${form.fullName.trim()}`,
        `${t.contact.formPhone}: ${form.phone}`,
        "",
        form.message.trim(),
      ].join("\n");
      const url = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="bg-brand-soft/40 py-20 md:py-28">
      <Container>
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-12 md:gap-16">
          <header className="space-y-4 md:col-span-5">
            <h2 className="text-balance font-display text-3xl font-semibold leading-[1.12] tracking-tight md:text-4xl">
              {t.contact.formTitle}
            </h2>
            <p className="text-base leading-relaxed text-muted md:text-[17px]">
              {t.contact.formBody}
            </p>
          </header>

          <form onSubmit={submit} className="space-y-5 md:col-span-7">
            <Field label={t.contact.formName} id="contact-name">
              <Input
                id="contact-name"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
                placeholder={t.contact.formNamePlaceholder}
              />
            </Field>

            <Field label={t.contact.formPhone} id="contact-phone">
              <Input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={form.phone}
                onChange={(e) => onChange("phone", e.target.value)}
                placeholder={t.contact.formPhonePlaceholder}
              />
            </Field>

            <Field label={t.contact.formMessage} id="contact-message">
              <Textarea
                id="contact-message"
                rows={5}
                value={form.message}
                onChange={(e) => onChange("message", e.target.value)}
                placeholder={t.contact.formMessagePlaceholder}
              />
            </Field>

            {status === "sent" ? (
              <p
                role="status"
                className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
              >
                <Check className="size-4" />
                {t.contact.formSent}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              loading={status === "submitting"}
              disabled={!valid}
              iconStart={<Send className="size-4" />}
            >
              {t.contact.formSubmit}
            </Button>
          </form>
        </div>
      </Container>
    </section>
  );
}

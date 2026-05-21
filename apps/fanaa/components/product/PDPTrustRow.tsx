"use client";

import { ShieldCheck, Truck, Undo2, Wallet } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

/**
 * Compact 4-icon trust strip rendered immediately under the PDP CTA.
 *
 * The full TrustStrip lives one section down with longer copy; this row
 * is the *micro-trust* layer the eye reads while the thumb is still on
 * the order button. Keep it to four icons, single line on desktop, two
 * columns on mobile.
 */
export function PDPTrustRow() {
  const { t } = useLocale();
  const items = [
    { icon: Wallet, label: t.product.cod },
    { icon: Truck, label: t.product.delivery },
    { icon: Undo2, label: t.product.returns },
    { icon: ShieldCheck, label: t.product.warranty },
  ];

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-4 text-[12px] sm:grid-cols-4">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-ink/85">
          <Icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
          <span className="leading-tight">{label}</span>
        </li>
      ))}
    </ul>
  );
}

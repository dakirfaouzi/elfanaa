/**
 * Saudi mobile phone validation + normalisation.
 *
 * Rules (KSA):
 *   • Local format: 05XXXXXXXX  (10 digits, starts with 05)
 *   • International: +9665XXXXXXXX or 009665XXXXXXXX → normalise to local
 *   • Reject anything else with a specific reason code so the form can show
 *     a helpful inline error (Baymard: specific > generic by 22%).
 */

export type PhoneValidation =
  | { ok: true; normalised: string; e164: string }
  | { ok: false; reason: "empty" | "non_digits" | "wrong_prefix" | "wrong_length" };

export function validateSaudiPhone(input: string): PhoneValidation {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  // Strip spaces, dashes, parentheses — common copy-paste artifacts.
  const cleaned = trimmed.replace(/[\s()\-]/g, "");

  // Reject if anything but digits (and an optional leading +).
  if (!/^\+?\d+$/.test(cleaned)) return { ok: false, reason: "non_digits" };

  // Normalise +966 / 00966 → leading 0.
  let local = cleaned;
  if (local.startsWith("+966")) local = "0" + local.slice(4);
  else if (local.startsWith("00966")) local = "0" + local.slice(5);
  else if (local.startsWith("966")) local = "0" + local.slice(3);

  if (local.length !== 10) return { ok: false, reason: "wrong_length" };
  if (!local.startsWith("05")) return { ok: false, reason: "wrong_prefix" };

  return {
    ok: true,
    normalised: local,
    e164: "+966" + local.slice(1),
  };
}

/**
 * Best-effort live formatter — groups as `05XX XXX XXXX` for readability while
 * the user types. Idempotent (running it twice yields the same result).
 */
export function formatSaudiPhoneAsYouType(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

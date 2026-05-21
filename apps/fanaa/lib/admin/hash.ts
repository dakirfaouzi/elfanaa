import { createHash } from "node:crypto";

/**
 * Deterministic non-reversible hash used for IP + UA fingerprinting.
 *
 * We do NOT persist raw IPs or full user-agents — only their SHA-256 hashes,
 * salted with JWT_SECRET so that two deployments with different secrets
 * produce different hashes. This satisfies privacy expectations while still
 * letting the dashboard count uniques and flag duplicate clicks.
 */
export function fingerprint(value: string): string {
  const salt = process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "fanaa";
  return createHash("sha256").update(`${salt}::${value}`).digest("hex");
}

/** Short, 16-char fingerprint for situations where space matters. */
export function shortFingerprint(value: string): string {
  return fingerprint(value).slice(0, 16);
}

import { randomBytes } from "node:crypto";

/**
 * Compact, URL-safe random identifier for visitor + session cookies.
 *
 * 18 bytes (24 base64url chars) gives us collision-free space at petabyte
 * scale while keeping the cookie under 256 bytes (most browsers' soft cap).
 */
export function newId(): string {
  return randomBytes(18).toString("base64url");
}

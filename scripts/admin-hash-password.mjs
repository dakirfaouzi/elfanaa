#!/usr/bin/env node
/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   node scripts/admin-hash-password.mjs "my-strong-password"
 *
 * Paste the printed hash into your .env as ADMIN_PASSWORD_HASH and unset
 * ADMIN_PASSWORD. We support either, but the hash is strictly safer in
 * production logs / git history.
 */
import bcrypt from "bcryptjs";

const pw = process.argv.slice(2).join(" ");
if (!pw) {
  console.error("Usage: node scripts/admin-hash-password.mjs <password>");
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 12);
console.log(hash);

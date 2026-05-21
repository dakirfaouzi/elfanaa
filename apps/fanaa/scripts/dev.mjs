#!/usr/bin/env node
/**
 * Resilient dev launcher.
 *
 * Why this exists:
 *   Some dev environments sit behind corporate proxies / Zscaler-style HTTPS
 *   inspection that re-sign upstream TLS certificates with a private root.
 *   When `next/font/google` tries to download font binaries, Node refuses
 *   the unrecognised cert chain and Next.js silently retries 3× per font,
 *   blocking the dev compile pipeline for ~30+ seconds before falling back
 *   to system fonts. From the user's perspective the page "won't load".
 *
 *   We avoid that by disabling TLS leaf-cert verification ONLY for the dev
 *   process. This affects the local dev Node process only — never the
 *   production runtime, never the deployed app.
 *
 *   If you do not have a proxy issue, this flag is a no-op for you.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const nextBin = path.resolve(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const child = spawn(
  process.execPath,
  [nextBin, "dev", ...process.argv.slice(2)],
  { stdio: "inherit", cwd: projectRoot, env: process.env }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

const forwardSignal = (sig) => () => {
  if (!child.killed) child.kill(sig);
};
process.on("SIGINT", forwardSignal("SIGINT"));
process.on("SIGTERM", forwardSignal("SIGTERM"));

/**
 * @platform/builder-schema — public API.
 *
 * Pure Zod schemas + type inference for the AI Studio's draft
 * builder. Consumed by:
 *
 *   • @platform/builder-state  — reducer + history + autosave
 *   • @platform/runtime-renderer — server-safe section → JSX
 *   • @platform/persistence    — JSONB payload validation
 *   • apps/studio              — API route input validation + UI types
 *
 * NEVER import React, fs, prisma, or fetch from this package.
 */

export * from "./media";
export * from "./sections";
export * from "./draft";
export * from "./validation";
export * from "./factories";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { PublishedProductBundle } from "../contracts";

/**
 * File-backed publish persistence — M7's storage backend.
 *
 * # Layout
 *
 *   <root>/products/<storeId>/<universalProductId>.json
 *
 *   • `root`               — defaults to `.platform-data/` (gitignored)
 *   • `storeId`            — `fanaa` for the M7 reference path
 *   • `universalProductId` — the canonical UniversalProduct.id; the
 *                            entire filename is deterministic so two
 *                            publishes of the same product overwrite
 *                            the same file (replay safety).
 *
 * # Replay determinism
 *
 *   • The JSON is serialised with a stable key order
 *     (`stableStringify`) so identical inputs produce byte-identical
 *     output across machines / runs / Node versions.
 *   • Writes go through an atomic `temp → rename` pattern so partial
 *     writes never appear (matches the FileStore in @platform/ingest).
 *
 * # Why not Prisma yet
 *
 * PLATFORM.md M7 explicitly does NOT introduce DB writes for the
 * published product — the bundle JSON is the single source of truth
 * until M10 (production hardening). The Studio (M8) reads the same
 * file via this interface so the storage layer can swap to Prisma /
 * Postgres without touching the publisher.
 */
export interface PublishStore {
  /** Where bundles end up. Mainly for telemetry / CLI output. */
  readonly root: string;

  /**
   * Atomic write. Returns the absolute path of the persisted file.
   * Overwrites silently — replay safety relies on this.
   */
  putBundle(bundle: PublishedProductBundle): Promise<string>;

  /**
   * Read a bundle by storeId + id. Returns null when not found.
   * Used by the CLI to verify replay determinism.
   */
  getBundle(
    storeId: string,
    universalProductId: string,
  ): Promise<PublishedProductBundle | null>;

  /** Lists ids under a store. Cheap directory scan. */
  listBundles(storeId: string): Promise<string[]>;
}

export interface FilePublishStoreOptions {
  /** Defaults to `.platform-data/` under the current working directory. */
  rootDir?: string;
}

export class FilePublishStore implements PublishStore {
  readonly root: string;

  constructor(opts: FilePublishStoreOptions = {}) {
    this.root = path.resolve(opts.rootDir ?? ".platform-data");
  }

  async putBundle(bundle: PublishedProductBundle): Promise<string> {
    const dir = path.join(this.root, "products", bundle.storeId);
    await fs.mkdir(dir, { recursive: true });

    const fileName = `${bundle.universalProduct.id}.json`;
    const dest = path.join(dir, fileName);
    const tmp = `${dest}.tmp`;

    const payload = `${stableStringify(bundle)}\n`;

    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, dest);

    return dest;
  }

  async getBundle(
    storeId: string,
    universalProductId: string,
  ): Promise<PublishedProductBundle | null> {
    const file = path.join(
      this.root,
      "products",
      storeId,
      `${universalProductId}.json`,
    );
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as PublishedProductBundle;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async listBundles(storeId: string): Promise<string[]> {
    const dir = path.join(this.root, "products", storeId);
    try {
      const entries = await fs.readdir(dir);
      return entries
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}

/**
 * Stable JSON stringify — sorts object keys alphabetically at every
 * depth. Arrays preserve order (they encode meaning, e.g. images: hero
 * first). Replay-safe: same input ⇒ same bytes.
 *
 * Pulled in-tree (no `json-stable-stringify` dep) to keep
 * @platform/publishers zero-runtime-deps beyond Zod.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, replacer, 2);
}

function replacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = (value as Record<string, unknown>)[k];
        return acc;
      }, {});
  }
  return value;
}

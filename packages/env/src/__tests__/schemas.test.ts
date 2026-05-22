import { describe, expect, it } from "vitest";
import {
  PersistenceEnvSchema,
  R2EnvSchema,
  StudioEnvSchema,
  validateEnv,
  validateEnvOrThrow,
} from "../schemas";

/**
 * Schema-level tests for the env validators.
 *
 * Each schema's happy + sad paths are pinned; the loader-context
 * tests in `contexts.test.ts` exercise the resolution glue on top.
 */

describe("PersistenceEnvSchema", () => {
  it("defaults STUDIO_PERSISTENCE_MODE to 'file' when unset", () => {
    const r = PersistenceEnvSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.STUDIO_PERSISTENCE_MODE).toBe("file");
  });

  it("accepts the canonical mode values", () => {
    for (const mode of ["file", "dual"] as const) {
      const r = PersistenceEnvSchema.safeParse({
        STUDIO_PERSISTENCE_MODE: mode,
      });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown modes", () => {
    const r = PersistenceEnvSchema.safeParse({
      STUDIO_PERSISTENCE_MODE: "weird",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid postgresql URL", () => {
    const r = PersistenceEnvSchema.safeParse({
      ADMIN_DATABASE_URL: "postgresql://user:pass@host:5432/db",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-postgres URL", () => {
    const r = PersistenceEnvSchema.safeParse({
      ADMIN_DATABASE_URL: "mysql://user:pass@host:3306/db",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes("env_invalid:ADMIN_DATABASE_URL"),
        ),
      ).toBe(true);
    }
  });
});

describe("R2EnvSchema", () => {
  it("defaults STORAGE_DRIVER to 'memory'", () => {
    const r = R2EnvSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.STORAGE_DRIVER).toBe("memory");
  });

  it("accepts a 32-char hex account id", () => {
    const r = R2EnvSchema.safeParse({
      R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-hex account id", () => {
    const r = R2EnvSchema.safeParse({ R2_ACCOUNT_ID: "not-hex" });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL public base", () => {
    const r = R2EnvSchema.safeParse({
      R2_PUBLIC_BASE_URL_FANAA: "not a url",
    });
    expect(r.success).toBe(false);
  });
});

describe("StudioEnvSchema", () => {
  it("merges persistence + R2 + Studio-specific fields", () => {
    const r = StudioEnvSchema.safeParse({
      STUDIO_PERSISTENCE_MODE: "dual",
      ADMIN_DATABASE_URL: "postgresql://x@y/z",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      R2_ACCESS_KEY_ID: "id",
      R2_SECRET_ACCESS_KEY: "sec",
      R2_BUCKET_FANAA: "fanaa-assets",
      PLATFORM_DATA_ROOT: "/var/lib/platform",
      STUDIO_ASSETS_CDN_BASE: "https://cdn.elfanaa.com",
    });
    expect(r.success).toBe(true);
  });

  it("works with completely empty input (all defaults are safe)", () => {
    const r = StudioEnvSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.STUDIO_PERSISTENCE_MODE).toBe("file");
      expect(r.data.STORAGE_DRIVER).toBe("memory");
    }
  });
});

describe("validateEnv + validateEnvOrThrow", () => {
  it("validateEnv returns a typed env on success", () => {
    const r = validateEnv(PersistenceEnvSchema, {
      STUDIO_PERSISTENCE_MODE: "file",
    });
    expect(r.status).toBe("ok");
  });

  it("validateEnv returns structured issues on failure", () => {
    const r = validateEnv(PersistenceEnvSchema, {
      STUDIO_PERSISTENCE_MODE: "weird",
    });
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") {
      expect(r.issues.length).toBeGreaterThan(0);
      expect(r.issues[0]!.path).toContain("STUDIO_PERSISTENCE_MODE");
    }
  });

  it("validateEnvOrThrow throws with `env_invalid:` prefix on failure", () => {
    expect(() =>
      validateEnvOrThrow(PersistenceEnvSchema, {
        STUDIO_PERSISTENCE_MODE: "weird",
      }),
    ).toThrow(/^env_invalid:/);
  });
});

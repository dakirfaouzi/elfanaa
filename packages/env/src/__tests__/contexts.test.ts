import { describe, expect, it } from "vitest";
import {
  loadPersistenceEnv,
  loadR2Env,
  loadStudioEnv,
  resolvePersistenceConfig,
  resolveR2Config,
} from "../contexts";

describe("loadStudioEnv", () => {
  it("returns ok for a minimal env", () => {
    const r = loadStudioEnv({});
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.env.STUDIO_PERSISTENCE_MODE).toBe("file");
      expect(r.env.STORAGE_DRIVER).toBe("memory");
    }
  });

  it("returns invalid when an explicit field fails its rule", () => {
    const r = loadStudioEnv({
      ADMIN_DATABASE_URL: "mysql://nope",
    });
    expect(r.status).toBe("invalid");
  });
});

describe("loadPersistenceEnv + resolvePersistenceConfig", () => {
  it("file mode requires no DB URL", () => {
    const env = loadPersistenceEnv({});
    expect(env.status).toBe("ok");
    if (env.status !== "ok") return;
    const resolved = resolvePersistenceConfig(env.env);
    expect(resolved.mode).toBe("file");
    expect(resolved.enableDualWrite).toBe(false);
    expect(resolved.prismaUrl).toBeUndefined();
    expect(resolved.warnings).toEqual([]);
  });

  it("dual mode + DB URL → enableDualWrite=true", () => {
    const env = loadPersistenceEnv({
      STUDIO_PERSISTENCE_MODE: "dual",
      ADMIN_DATABASE_URL: "postgresql://u@h/d",
    });
    expect(env.status).toBe("ok");
    if (env.status !== "ok") return;
    const resolved = resolvePersistenceConfig(env.env);
    expect(resolved.mode).toBe("dual");
    expect(resolved.enableDualWrite).toBe(true);
    expect(resolved.prismaUrl).toBe("postgresql://u@h/d");
    expect(resolved.warnings).toEqual([]);
  });

  it("dual mode WITHOUT DB URL → degrades to file with warning", () => {
    const env = loadPersistenceEnv({
      STUDIO_PERSISTENCE_MODE: "dual",
    });
    expect(env.status).toBe("ok");
    if (env.status !== "ok") return;
    const resolved = resolvePersistenceConfig(env.env);
    expect(resolved.mode).toBe("file");
    expect(resolved.enableDualWrite).toBe(false);
    expect(resolved.warnings).toHaveLength(1);
    expect(resolved.warnings[0]).toContain("degrading to file-only");
  });

  it("prefers DATABASE_URL over ADMIN_DATABASE_URL when both present", () => {
    const env = loadPersistenceEnv({
      STUDIO_PERSISTENCE_MODE: "dual",
      ADMIN_DATABASE_URL: "postgresql://admin@h/d",
      DATABASE_URL: "postgresql://pool@h/d",
    });
    if (env.status !== "ok") throw new Error("expected ok");
    const resolved = resolvePersistenceConfig(env.env);
    expect(resolved.prismaUrl).toBe("postgresql://pool@h/d");
  });
});

describe("loadR2Env + resolveR2Config", () => {
  const fullR2 = {
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    R2_ACCESS_KEY_ID: "id",
    R2_SECRET_ACCESS_KEY: "sec",
    R2_BUCKET_FANAA: "fanaa-assets",
    R2_PUBLIC_BASE_URL_FANAA: "https://cdn.elfanaa.com",
  };

  it("memory driver is the default + needs no creds", () => {
    const env = loadR2Env({});
    if (env.status !== "ok") throw new Error("expected ok");
    const resolved = resolveR2Config(env.env);
    expect(resolved.driver).toBe("memory");
    expect(resolved.warnings).toEqual([]);
  });

  it("complete r2 driver config keeps r2 selected and populates buckets/CDN", () => {
    const env = loadR2Env(fullR2);
    if (env.status !== "ok") throw new Error("expected ok");
    const resolved = resolveR2Config(env.env);
    expect(resolved.driver).toBe("r2");
    expect(resolved.accountId).toBe(fullR2.R2_ACCOUNT_ID);
    expect(resolved.buckets).toEqual({ fanaa: "fanaa-assets" });
    expect(resolved.publicBaseUrls).toEqual({
      fanaa: "https://cdn.elfanaa.com",
    });
    expect(resolved.warnings).toEqual([]);
  });

  it("r2 driver WITH missing creds → degrades to memory + warns", () => {
    const env = loadR2Env({
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      // missing access key, secret, bucket
    });
    if (env.status !== "ok") throw new Error("expected ok");
    const resolved = resolveR2Config(env.env);
    expect(resolved.driver).toBe("memory");
    expect(resolved.warnings).toHaveLength(1);
    expect(resolved.warnings[0]).toContain("R2_ACCESS_KEY_ID");
    expect(resolved.warnings[0]).toContain("R2_SECRET_ACCESS_KEY");
    expect(resolved.warnings[0]).toContain("R2_BUCKET_FANAA");
  });
});

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * C3.1 follow-up — asset-proxy route tests.
 *
 * The route at `app/api/studio/media/[...path]/route.ts` is the bridge
 * between R2 keys (stored in `MediaRef.desktopSrc`) and the browser's
 * `<img>` fetcher. It must:
 *
 *   1. Validate the catch-all path is a non-empty key in one of the two
 *      issued formats (intake / draft).
 *   2. Resolve the bucket from the persistence config (or 503 when it's
 *      not configured for the store).
 *   3. Mint a presigned R2 GET URL via `mediaStore.presignDownload` and
 *      302-redirect with a tight `Cache-Control` header.
 *   4. Surface a clear 502 when running in memory mode (dev-only path).
 *   5. Refuse arbitrary keys — defence-in-depth against the proxy
 *      becoming a generic R2 read endpoint.
 *
 * We mock `getStudioPersistence` at the module boundary so the route
 * receives a controlled persistence snapshot per test. This keeps the
 * tests deterministic without needing real R2 credentials.
 */

vi.mock("@/lib/studio/persistence", () => {
  return {
    getStudioPersistence: vi.fn(),
  };
});

import { getStudioPersistence } from "@/lib/studio/persistence";
import { GET } from "../app/api/studio/media/[...path]/route";

type PersistenceMock = ReturnType<typeof vi.fn>;

function makePersistence(overrides: {
  driver?: "r2" | "memory";
  buckets?: Record<string, string>;
  presignDownload?: (opts: {
    bucket: string;
    key: string;
    expiresInSec?: number;
  }) => Promise<{ url: string; expiresAt: string }>;
}) {
  const driver = overrides.driver ?? "r2";
  const buckets = overrides.buckets ?? { fanaa: "fanaa-assets" };
  return {
    config: { r2: { driver, buckets } },
    mediaStore: {
      presignDownload:
        overrides.presignDownload ??
        (async (opts) => ({
          url: `https://${opts.bucket}.r2.example/${opts.key}?signed=1`,
          expiresAt: "2099-01-01T00:00:00.000Z",
        })),
    },
  };
}

beforeEach(() => {
  (getStudioPersistence as unknown as PersistenceMock).mockReset();
});

describe("GET /api/studio/media/[...path]", () => {
  it("400 when path is empty (root request)", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({}),
    );
    const res = await GET(new Request("http://x.test/api/studio/media"), {
      params: Promise.resolve({ path: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_key");
  });

  it("404 when the key shape matches neither intake nor draft format", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({}),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({ path: ["arbitrary", "thing"] }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("invalid_key_shape");
  });

  it("404 when the key is intake-shaped but the ULID is malformed", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({}),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: ["studio-intake", "fanaa", "not-a-ulid.webp"],
      }),
    });
    expect(res.status).toBe(404);
  });

  it("503 when the resolved store has no configured bucket", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({ buckets: {} }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: ["studio-intake", "fanaa", "01HXYZTESTULIDFAKEABCDEFGH.webp"],
      }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("bucket_missing");
  });

  it("302 with a presigned URL for a valid intake key in r2 mode", async () => {
    const presignSpy = vi.fn(async (opts: { bucket: string; key: string }) => ({
      url: `https://${opts.bucket}.r2.example/${opts.key}?signed=ok`,
      expiresAt: "2099-01-01T00:00:00.000Z",
    }));
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({ driver: "r2", presignDownload: presignSpy }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: ["studio-intake", "fanaa", "01HXYZTESTULIDFAKEABCDEFGH.webp"],
      }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://fanaa-assets.r2.example/studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp?signed=ok",
    );
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(presignSpy).toHaveBeenCalledWith({
      bucket: "fanaa-assets",
      key: "studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp",
      expiresInSec: 300,
    });
  });

  it("302 for a draft-attached key (defaults to the fanaa bucket)", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({ driver: "r2" }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: [
          "studio",
          "draft_abc",
          "upload",
          "01HXYZTESTULIDFAKEABCDEFGH.png",
        ],
      }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "studio/draft_abc/upload/01HXYZTESTULIDFAKEABCDEFGH.png",
    );
  });

  it("502 when the MediaStore raises while presigning", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({
        driver: "r2",
        presignDownload: async () => {
          throw new Error("r2_throttled");
        },
      }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: ["studio-intake", "fanaa", "01HXYZTESTULIDFAKEABCDEFGH.webp"],
      }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("presign_failed");
    expect(body.error).toContain("r2_throttled");
  });

  it("502 driver_unsupported when running in memory mode", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({ driver: "memory" }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: ["studio-intake", "fanaa", "01HXYZTESTULIDFAKEABCDEFGH.webp"],
      }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("driver_unsupported_for_proxy");
  });

  it("400 when the path is bigger than the key cap", async () => {
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({}),
    );
    const huge = "x".repeat(550);
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({ path: ["studio-intake", "fanaa", huge] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_key");
  });

  it("decodes URI-encoded segments before validating the key", async () => {
    // `resolveAssetUrl()` URI-encodes awkward characters inside each
    // segment. The route must decode them so the key parser sees the
    // original byte sequence.
    (getStudioPersistence as unknown as PersistenceMock).mockReturnValue(
      makePersistence({ driver: "r2" }),
    );
    const res = await GET(new Request("http://x.test"), {
      params: Promise.resolve({
        path: [
          "studio-intake",
          "fanaa",
          encodeURIComponent("01HXYZTESTULIDFAKEABCDEFGH.webp"),
        ],
      }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(
      "studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp",
    );
  });
});

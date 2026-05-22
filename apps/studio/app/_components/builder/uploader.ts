/**
 * Client-side uploader — handles the full presign → PUT → confirm
 * round-trip with progress tracking, abort support, and (optional)
 * a single retry on network failure.
 *
 * # Why XHR instead of fetch
 *
 * `fetch()` doesn't expose upload-progress events. XHR does
 * (`upload.onprogress`). We use a tiny wrapper that returns a
 * Promise + an abort function — the consumer never sees XHR APIs
 * directly.
 *
 * # Confirm step
 *
 * After the bytes hit R2 (or the memory store), we POST to the
 * confirm endpoint to materialise a `studio_asset` row. If confirm
 * fails the row never gets created and the R2 object becomes an
 * orphan (lifecycle policy cleans it up).
 *
 * # Memory mode
 *
 * When the presign URL uses the `memory://` scheme, the browser
 * cannot PUT directly. We translate the URL into the Studio-local
 * fallback (`/api/studio/uploads/local/<bucket>/<key>`). Production
 * (R2) URLs are PUT as-is.
 */

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadResult {
  id: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  altAr: string | null;
  altEn: string | null;
  key: string;
  bucket: string;
  draftId: string;
}

export interface UploadFileOptions {
  file: File;
  draftId: string;
  altAr?: string;
  altEn?: string;
  onProgress?: (p: UploadProgress) => void;
  /** Lets the caller install an abort handle. */
  registerAbort?: (abort: () => void) => void;
}

import { studioPath } from "@/lib/base-path";

export async function uploadFile(opts: UploadFileOptions): Promise<UploadResult> {
  const { file, draftId } = opts;
  const controller = new AbortController();
  opts.registerAbort?.(() => controller.abort());

  // 1. Presign.
  const presignResp = await fetch(
    studioPath(`/api/studio/drafts/${encodeURIComponent(draftId)}/assets/presign`),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        source: "upload",
        contentType: file.type,
        bytes: file.size,
        altAr: opts.altAr,
        altEn: opts.altEn,
      }),
    },
  );
  if (!presignResp.ok) {
    throw new Error(
      `presign_failed:${presignResp.status}:${await presignResp.text().catch(() => "")}`,
    );
  }
  const presignJson = await presignResp.json();
  const presigned = presignJson.presigned ?? presignJson.value?.presigned;
  if (!presigned) {
    throw new Error("presign_response_invalid");
  }

  // 2. Upload bytes via XHR for progress tracking.
  const putUrl = rewriteMemoryUrl(presigned.url);
  await putWithProgress({
    url: putUrl,
    method: "PUT",
    body: file,
    headers: presigned.headers ?? { "content-type": file.type },
    abortSignal: controller.signal,
    onProgress: (p) =>
      opts.onProgress?.({
        fileName: file.name,
        loaded: p.loaded,
        total: p.total || file.size,
        percent: p.total > 0 ? (p.loaded / p.total) * 100 : 0,
      }),
  });

  // 3. Confirm.
  const confirmResp = await fetch(
    studioPath(`/api/studio/drafts/${encodeURIComponent(draftId)}/assets/confirm`),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        key: presigned.ref.key,
        bucket: presigned.ref.bucket,
        contentType: file.type,
        bytes: file.size,
        altAr: opts.altAr,
        altEn: opts.altEn,
      }),
    },
  );
  if (!confirmResp.ok) {
    throw new Error(
      `confirm_failed:${confirmResp.status}:${await confirmResp.text().catch(() => "")}`,
    );
  }
  const confirmJson = await confirmResp.json();
  const asset = confirmJson.value ?? confirmJson;
  return asset as UploadResult;
}

function rewriteMemoryUrl(url: string): string {
  if (!url.startsWith("memory://")) return url;
  // memory://media/<bucket>/<key>?signed=put&exp=...
  // → /api/studio/uploads/local/<bucket>/<key>?signed=...
  const stripped = url.replace(/^memory:\/\/[^/]+\//, "");
  return studioPath(`/api/studio/uploads/local/${stripped}`);
}

interface PutOpts {
  url: string;
  method: "PUT";
  body: Blob | File;
  headers: Record<string, string>;
  abortSignal: AbortSignal;
  onProgress?: (p: { loaded: number; total: number }) => void;
}

function putWithProgress(opts: PutOpts): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url, true);
    for (const [k, v] of Object.entries(opts.headers)) {
      try {
        xhr.setRequestHeader(k, v);
      } catch {
        // Some headers (host, content-length, etc.) are forbidden;
        // ignore and let the browser handle them.
      }
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        opts.onProgress?.({ loaded: e.loaded, total: e.total });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`put_failed:${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    opts.abortSignal.addEventListener("abort", () => xhr.abort());
    xhr.send(opts.body);
  });
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studioPath } from "@/lib/base-path";
import { detectProvider } from "@/lib/studio/intake/provider-detect";
import { marketPresets } from "@/lib/studio/intake/currencies";
import type { Targeting } from "@platform/ingest";
import {
  ImageUploader,
  type IntakeImageItem,
} from "./intake/ImageUploader";
import { TargetingControls } from "./intake/TargetingControls";
import { renderTargetingAsNotes } from "@/lib/studio/intake/serialize-targeting";

/**
 * Intake form — submits to `/api/studio/intake` and on 202 navigates
 * to `/runs/<runId>` where the LiveStepTimeline takes over.
 *
 * # Why a client component
 *
 * The form needs to handle the async POST + validation-error rendering
 * + navigation without a full page reload. Server actions can't return
 * a runId AND navigate without a hop, so we use fetch+router.replace.
 *
 * # Field set
 *
 * Mirrors `validateIntake`'s expected shape:
 *   - storeId            (select)
 *   - supplierUrl        (required, universal — any ecommerce URL)
 *   - priceHintMajor     (required, number)
 *   - currency           (select; market-default per storeId)
 *   - operatorNotes      (textarea)
 *   - skipResearch       (checkbox)
 *
 * # Phase A4 — universal supplier + currency
 *
 *   • Supplier URL hint reflects the full provider set
 *     (Alibaba/AliExpress/Amazon/Shopify/WooCommerce/Etsy/eBay/
 *     TikTok Shop/Temu/Noon/CJ + generic) instead of the M9
 *     Alibaba-only copy.
 *   • Detected platform is surfaced inline so the operator can
 *     confirm before dispatching — purely informational; the
 *     research stage is provider-agnostic.
 *   • Currency dropdown now lists all GCC currencies (SAR, AED,
 *     KWD, QAR, BHD, OMR) + USD anchor; default is derived from
 *     `marketDefaultCurrency(storeId)`.
 *
 * Uploaded images are intentionally still minimal — Phase B1 swaps
 * the textarea for a drag-drop uploader wired into the existing R2
 * presign infrastructure.
 */
export function IntakeForm(props: { defaultStoreId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  // Mirror the supplier URL into local state so we can re-detect the
  // provider on every keystroke. `detectProvider` is a pure function
  // — no network — and gives the operator instant feedback like
  // "Detected: Shopify" inline below the input.
  const [supplierUrl, setSupplierUrl] = useState("");
  const detected = useMemo(() => detectProvider(supplierUrl), [supplierUrl]);

  // Currency options derive from the per-store preset list. Stable
  // order across renders (matches `SUPPORTED_CURRENCIES`) so the
  // dropdown doesn't reshuffle as the user types.
  const currencyOptions = useMemo(
    () => marketPresets(props.defaultStoreId),
    [props.defaultStoreId],
  );
  const defaultCurrency =
    currencyOptions.find((c) => c.isDefault)?.meta.code ?? "SAR";

  // ImageUploader (Phase B1) holds the list of completed uploads
  // in its own state and pushes the current list up via onChange.
  // We mirror it here so the form-submit handler picks the latest
  // snapshot without round-tripping through the DOM.
  const [uploadedImages, setUploadedImages] = useState<IntakeImageItem[]>(
    [],
  );

  // Targeting (Phase B2) is mirror-controlled here too. On submit
  // we serialise it INTO `operatorNotes` (string) so the strategy
  // stage's existing prompt template picks it up unchanged, AND
  // we send the raw object via `intakeMetadata.targeting` so
  // future stages can read it directly.
  const [targeting, setTargeting] = useState<Targeting>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);

    const form = new FormData(e.currentTarget);

    // Serialise structured targeting INTO operatorNotes so the
    // strategy stage's existing prompt picks it up — strategy
    // stage code is intentionally untouched per the Phase B
    // non-regression constraint.
    const freeformNotes = String(form.get("operatorNotes") ?? "");
    const serialisedNotes = renderTargetingAsNotes(targeting, freeformNotes);

    // Only attach intakeMetadata.targeting when the operator
    // actually made structured picks. An empty targeting object
    // is semantically equivalent to "no preferences" and we omit
    // it entirely to keep on-disk run records lean.
    const hasTargetingPicks = Object.keys(targeting).length > 0;

    const payload = {
      storeId: String(form.get("storeId") ?? ""),
      supplierUrl: String(form.get("supplierUrl") ?? ""),
      priceHintMajor: Number(form.get("priceHintMajor") ?? 0),
      currency: String(form.get("currency") ?? "SAR"),
      operatorNotes: serialisedNotes || undefined,
      marginNotes: String(form.get("marginNotes") ?? "") || undefined,
      skipResearch: form.get("skipResearch") === "on",
      uploadedImages,
      ...(hasTargetingPicks
        ? { intakeMetadata: { targeting } }
        : {}),
    };

    try {
      const res = await fetch(studioPath("/api/studio/intake"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { runId: string }
        | { error: string; issues?: Array<{ path: string; message: string }> };
      if (res.status === 202 && "runId" in json) {
        router.replace(`/runs/${encodeURIComponent(json.runId)}`);
        router.refresh();
        return;
      }
      if ("issues" in json && Array.isArray(json.issues)) {
        setIssues(json.issues);
      }
      setError(("error" in json && json.error) || "intake_failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      <Field label="Store" htmlFor="storeId">
        <select id="storeId" name="storeId" defaultValue={props.defaultStoreId} required>
          <option value="fanaa">fanaa</option>
        </select>
      </Field>

      <Field
        label="Supplier URL"
        htmlFor="supplierUrl"
        hint="Any ecommerce product page (https). Alibaba, AliExpress, Amazon, Shopify, WooCommerce, Etsy, eBay, TikTok Shop, Temu, Noon, CJ Dropshipping — or any generic store."
      >
        <input
          id="supplierUrl"
          name="supplierUrl"
          type="url"
          required
          value={supplierUrl}
          onChange={(e) => setSupplierUrl(e.target.value)}
          placeholder="https://store.example.com/products/…"
        />
        {supplierUrl.length > 0 && detected.hostname && (
          <span
            className="text-faint"
            style={{ fontSize: 11, marginTop: 2 }}
          >
            Detected platform: <strong>{detected.displayName}</strong>
            {detected.id === "generic" && " (generic extractor)"}
          </span>
        )}
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
        <Field label="Unit price hint" htmlFor="priceHintMajor" hint="Per-unit retail price the operator targets. Used by the publisher to derive offer tiers.">
          <input
            id="priceHintMajor"
            name="priceHintMajor"
            type="number"
            min="1"
            step="1"
            required
            placeholder="199"
          />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select id="currency" name="currency" defaultValue={defaultCurrency}>
            {currencyOptions.map(({ meta }) => (
              <option key={meta.code} value={meta.code}>
                {meta.code} — {meta.displayName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Product images"
        htmlFor="uploadedImages"
        hint="Drag and drop up to 10 supplier images. PNG/JPEG/WebP/GIF/AVIF, ≤ 50 MB each. The first image becomes the primary product photo."
      >
        <ImageUploader
          storeId={props.defaultStoreId}
          onChange={setUploadedImages}
        />
      </Field>

      <Field
        label="Audience & creative targeting"
        htmlFor="targeting-block"
        hint="Structured picks below are serialised into the strategy stage's prompt — every field is optional."
      >
        <div
          id="targeting-block"
          style={{
            background: "color-mix(in srgb, var(--surface) 60%, transparent)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md, 8px)",
            padding: 14,
          }}
        >
          <TargetingControls value={targeting} onChange={setTargeting} />
        </div>
      </Field>

      <Field
        label="Freeform notes"
        htmlFor="operatorNotes"
        hint="Optional. Append free-text positioning context to the structured picks above."
      >
        <textarea
          id="operatorNotes"
          name="operatorNotes"
          rows={3}
          placeholder="e.g. lean into hydration-claim differentiation; competitors over-promise glow."
        />
      </Field>

      <Field label="Margin notes" htmlFor="marginNotes" hint="Operator-internal cost breakdown. Never customer-facing.">
        <input id="marginNotes" name="marginNotes" type="text" placeholder="supplier $4.20 + ship $1.80" />
      </Field>

      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: "var(--text-dim)" }}>
        <input id="skipResearch" name="skipResearch" type="checkbox" style={{ width: "auto" }} />
        Skip supplier-page scrape (research stage)
      </label>

      {issues.length > 0 && (
        <div className="empty-card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          <strong>Validation failed</strong>
          <ul style={{ textAlign: "left", margin: "8px 0 0 0", paddingLeft: 16 }}>
            {issues.map((iss, i) => (
              <li key={i} style={{ fontSize: 12 }}>
                <code className="code">{iss.path}</code> — {iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && !issues.length && (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>Error: {error}</div>
      )}

      <button type="submit" className="btn btn-accent" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Dispatching…" : "Dispatch run"}
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={props.htmlFor} style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
        {props.label}
      </label>
      {props.children}
      {props.hint && (
        <span className="text-faint" style={{ fontSize: 11 }}>
          {props.hint}
        </span>
      )}
    </div>
  );
}

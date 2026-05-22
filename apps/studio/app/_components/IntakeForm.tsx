"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
 *   - supplierUrl        (required)
 *   - priceHintMajor     (required, number)
 *   - currency           (select; default SAR)
 *   - operatorNotes      (textarea)
 *   - skipResearch       (checkbox)
 *
 * Uploaded images are intentionally minimal in M9 — operators paste
 * URLs / R2 keys (one per line). The R2 presigned-upload flow lands
 * with the M10 asset browser.
 */
export function IntakeForm(props: { defaultStoreId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);

    const form = new FormData(e.currentTarget);
    const uploadedImages = String(form.get("uploadedImages") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((src) => ({ src }));

    const payload = {
      storeId: String(form.get("storeId") ?? ""),
      supplierUrl: String(form.get("supplierUrl") ?? ""),
      priceHintMajor: Number(form.get("priceHintMajor") ?? 0),
      currency: String(form.get("currency") ?? "SAR"),
      operatorNotes: String(form.get("operatorNotes") ?? "") || undefined,
      marginNotes: String(form.get("marginNotes") ?? "") || undefined,
      skipResearch: form.get("skipResearch") === "on",
      uploadedImages,
    };

    try {
      const res = await fetch("/api/studio/intake", {
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

      <Field label="Supplier URL" htmlFor="supplierUrl" hint="Alibaba / AliExpress / Taobao product page (https only).">
        <input
          id="supplierUrl"
          name="supplierUrl"
          type="url"
          required
          placeholder="https://www.alibaba.com/product-detail/…"
        />
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
          <select id="currency" name="currency" defaultValue="SAR">
            <option value="SAR">SAR</option>
            <option value="AED">AED</option>
            <option value="USD">USD</option>
          </select>
        </Field>
      </div>

      <Field
        label="Uploaded images"
        htmlFor="uploadedImages"
        hint="Optional. One URL or R2 key per line. M10 wires direct browser upload."
      >
        <textarea id="uploadedImages" name="uploadedImages" rows={3} placeholder="https://…/photo1.jpg" />
      </Field>

      <Field label="Operator notes" htmlFor="operatorNotes" hint="Positioning hints (passed to the strategy stage).">
        <textarea id="operatorNotes" name="operatorNotes" rows={3} placeholder="Targeting hydration-conscious women aged 25–40 in GCC." />
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

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studioPath } from "@/lib/base-path";
import { detectProvider } from "@/lib/studio/intake/provider-detect";
import { marketPresets } from "@/lib/studio/intake/currencies";
import type { CostBreakdown, OfferTier, Targeting } from "@platform/ingest";
import {
  ImageUploader,
  type IntakeImageItem,
} from "./intake/ImageUploader";
import { TargetingControls } from "./intake/TargetingControls";
import { CostBreakdownCard } from "./intake/CostBreakdownCard";
import { OfferBuilder } from "./intake/OfferBuilder";
import { renderTargetingAsNotes } from "@/lib/studio/intake/serialize-targeting";
import {
  computeLandedCost,
  renderCostBreakdownAsNotes,
} from "@/lib/studio/intake/serialize-cost-breakdown";

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
 * # Section flow (Phase B5)
 *
 * Operators move through six logical sections in the order an
 * e-commerce merchandiser actually thinks:
 *
 *   1. Source         — store + supplier URL (+ provider detection)
 *   2. Audience       — structured targeting + freeform notes
 *   3. Assets         — drag-drop image uploader
 *   4. Pricing        — unit-price hint + offer ladder
 *   5. Internal cost  — cost breakdown + margin notes
 *   6. Pipeline       — skip-scrape toggle (advanced, collapsed)
 *
 * A sticky dispatch footer summarises readiness at the bottom and
 * stays visible while the form scrolls.
 *
 * # Phase B1-B4 inputs
 *
 *   • <ImageUploader>      — drag-drop multi-image to R2.
 *   • <TargetingControls>  — 8 structured audience dropdowns.
 *   • <CostBreakdownCard>  — 5 cost components + live margin.
 *   • <OfferBuilder>       — explicit pricing ladder + AOV preview.
 *
 * All four sub-components are mirror-controlled: parent owns state,
 * children call `onChange`. Structured values serialise INTO the
 * legacy `operatorNotes` / `marginNotes` strings at submit time so
 * downstream stages stay untouched per the Phase B non-regression
 * constraint. Raw structured objects ALSO flow through via
 * `intakeMetadata` for future stage consumption.
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

  // CostBreakdown (Phase B3) — same mirror pattern. The live
  // realised-margin preview on <CostBreakdownCard> needs the
  // current price hint + currency, so those two inputs become
  // controlled state here too.
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown>({});
  const [priceHintMajor, setPriceHintMajor] = useState<string>("");
  const [currency, setCurrency] = useState<string>(defaultCurrency);

  // Offers (Phase B4). Empty by default — the publisher's
  // existing default-ladder synthesis from priceHint stays the
  // load-bearing path when offers is empty.
  const [offers, setOffers] = useState<OfferTier[]>([]);

  // Derive the numeric price hint + landed cost for the offer
  // builder's live preview. Both nullable; the builder gracefully
  // shows "—" when either is missing.
  const priceHintNumeric =
    priceHintMajor === "" || !Number.isFinite(Number(priceHintMajor))
      ? null
      : Number(priceHintMajor);
  const landedCostPerUnit = computeLandedCost(costBreakdown);

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

    // Serialise structured cost breakdown INTO marginNotes for the
    // SAME reason — assemble stage stores marginNotes verbatim, no
    // downstream code changes needed.
    const submittedCurrency =
      String(form.get("currency") ?? "") || defaultCurrency;
    const freeformMargin = String(form.get("marginNotes") ?? "");
    const serialisedMargin = renderCostBreakdownAsNotes(
      costBreakdown,
      submittedCurrency,
      freeformMargin,
    );

    // Only attach intakeMetadata sub-fields when the operator
    // actually made picks. Empty objects are semantically "no
    // preferences" — omit them from the on-disk run record to
    // keep things lean.
    const hasTargetingPicks = Object.keys(targeting).length > 0;
    const hasCostPicks = Object.keys(costBreakdown).length > 0;
    const hasOfferTiers = offers.length > 0;
    const intakeMetadata: Record<string, unknown> = {};
    if (hasTargetingPicks) intakeMetadata.targeting = targeting;
    if (hasCostPicks) intakeMetadata.costBreakdown = costBreakdown;
    if (hasOfferTiers) intakeMetadata.offers = offers;

    const payload = {
      storeId: String(form.get("storeId") ?? ""),
      supplierUrl: String(form.get("supplierUrl") ?? ""),
      priceHintMajor: Number(form.get("priceHintMajor") ?? 0),
      currency: submittedCurrency,
      operatorNotes: serialisedNotes || undefined,
      marginNotes: serialisedMargin || undefined,
      skipResearch: form.get("skipResearch") === "on",
      uploadedImages,
      ...(Object.keys(intakeMetadata).length > 0
        ? { intakeMetadata }
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

  // ── Readiness checks for the sticky dispatch footer ──
  // The required-fields are: supplierUrl (non-empty + valid-ish)
  // and priceHintMajor (positive number). All other fields are
  // optional. The footer surfaces this so operators see at a
  // glance whether dispatch will go through.
  const supplierReady = supplierUrl.trim().length > 0;
  const priceReady = priceHintNumeric !== null && priceHintNumeric > 0;
  const canDispatch = supplierReady && priceReady && !busy;

  // Optional-but-noteworthy state counters for the footer pills.
  const tierCount = offers.length;
  const targetingCount = Object.keys(targeting).length;
  const imageCount = uploadedImages.length;

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        // Bottom padding leaves room for the sticky footer so the
        // last section never sits directly under it.
        paddingBottom: 88,
      }}
    >
      {/* ─── 1. SOURCE ─────────────────────────────────────────── */}
      <Section
        eyebrow="01 · Source"
        title="Where does this product come from?"
        hint="The dispatcher mints a runId, runs the 11-stage AI pipeline, enforces the per-store cost ceiling, and writes the published bundle."
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
      </Section>

      {/* ─── 2. AUDIENCE & CREATIVE ───────────────────────────── */}
      <Section
        eyebrow="02 · Audience"
        title="Who is this product for?"
        hint="Structured picks feed the strategy stage's positioning prompt. Every field is optional — pick what you know."
        accentCount={targetingCount}
      >
        <TargetingControls value={targeting} onChange={setTargeting} />

        <Field
          label="Freeform positioning notes"
          htmlFor="operatorNotes"
          hint="Optional. Free-text addendum appended after the structured picks above."
        >
          <textarea
            id="operatorNotes"
            name="operatorNotes"
            rows={3}
            placeholder="e.g. lean into hydration-claim differentiation; competitors over-promise glow."
          />
        </Field>
      </Section>

      {/* ─── 3. ASSETS ────────────────────────────────────────── */}
      <Section
        eyebrow="03 · Assets"
        title="Product photography"
        hint="Drag and drop supplier images. The first image becomes the primary product photo; reorder with ↑/↓ or set primary with ★."
        accentCount={imageCount}
      >
        <ImageUploader
          storeId={props.defaultStoreId}
          onChange={setUploadedImages}
        />
      </Section>

      {/* ─── 4. PRICING & OFFERS ──────────────────────────────── */}
      <Section
        eyebrow="04 · Pricing"
        title="Customer-facing offer"
        hint="The unit price hint anchors the publisher's default ladder. Define explicit tiers below to override it."
        accentCount={tierCount}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
          <Field label="Unit price hint" htmlFor="priceHintMajor" hint="Single-unit retail price you target. Required.">
            <input
              id="priceHintMajor"
              name="priceHintMajor"
              type="number"
              min="1"
              step="1"
              required
              placeholder="199"
              value={priceHintMajor}
              onChange={(e) => setPriceHintMajor(e.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencyOptions.map(({ meta }) => (
                <option key={meta.code} value={meta.code}>
                  {meta.code} — {meta.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Offer ladder (optional)"
          htmlFor="offer-builder-block"
          hint="Define explicit pack tiers — leave empty to fall back to the publisher's default ladder."
        >
          <div id="offer-builder-block">
            <OfferBuilder
              value={offers}
              onChange={setOffers}
              currency={currency}
              landedCostPerUnit={landedCostPerUnit}
              priceHintMajor={priceHintNumeric}
            />
          </div>
        </Field>
      </Section>

      {/* ─── 5. INTERNAL ECONOMICS ────────────────────────────── */}
      <Section
        eyebrow="05 · Internal economics"
        title="Cost breakdown (operator-only)"
        hint="Never customer-facing. Powers the live landed-cost + realised-margin preview AND feeds the per-tier margin column above."
        accentCount={Object.keys(costBreakdown).length}
      >
        <CostBreakdownCard
          value={costBreakdown}
          onChange={setCostBreakdown}
          currency={currency}
          priceHintMajor={priceHintNumeric}
        />

        <Field
          label="Internal margin notes"
          htmlFor="marginNotes"
          hint="Optional. Free-text addendum to the cost breakdown above."
        >
          <input
            id="marginNotes"
            name="marginNotes"
            type="text"
            placeholder="e.g. supplier quoted in CNY at 30.5; assumed FX 0.38."
          />
        </Field>
      </Section>

      {/* ─── 6. PIPELINE CONTROLS (collapsed) ─────────────────── */}
      <Section
        eyebrow="06 · Pipeline"
        title="Advanced controls"
        hint="Power-user toggles. Defaults are safe — only flip these if you know what you're doing."
        collapsible
        defaultCollapsed
      >
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 13,
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <input
            id="skipResearch"
            name="skipResearch"
            type="checkbox"
            style={{ width: "auto", marginTop: 3 }}
          />
          <span>
            <strong>Skip supplier-page scrape</strong>
            <span className="text-faint" style={{ display: "block", fontSize: 11 }}>
              Bypasses the research stage. Use only when the AI's research output is unhelpful for this URL or when you have full assets already.
            </span>
          </span>
        </label>
      </Section>

      {/* ─── Validation errors (above the sticky footer) ─────── */}
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

      {/* ─── Sticky dispatch footer ──────────────────────────── */}
      <DispatchFooter
        busy={busy}
        canDispatch={canDispatch}
        supplierReady={supplierReady}
        priceReady={priceReady}
        tierCount={tierCount}
        targetingCount={targetingCount}
        imageCount={imageCount}
      />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section primitive
// ─────────────────────────────────────────────────────────────────────────

function Section(props: {
  eyebrow: string;
  title: string;
  hint?: string;
  accentCount?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(
    props.collapsible ? !!props.defaultCollapsed : false,
  );

  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          cursor: props.collapsible ? "pointer" : "default",
        }}
        onClick={
          props.collapsible ? () => setCollapsed((c) => !c) : undefined
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="section-eyebrow">{props.eyebrow}</span>
            {typeof props.accentCount === "number" && props.accentCount > 0 && (
              <span
                style={{
                  background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                  color: "var(--accent)",
                  fontSize: 10,
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                {props.accentCount}
              </span>
            )}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: -0.2,
              color: "var(--text)",
            }}
          >
            {props.title}
          </h2>
          {props.hint && (
            <p
              className="text-dim"
              style={{ margin: 0, fontSize: 12.5, maxWidth: 720, lineHeight: 1.55 }}
            >
              {props.hint}
            </p>
          )}
        </div>
        {props.collapsible && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 10px" }}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        )}
      </header>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {props.children}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sticky dispatch footer
// ─────────────────────────────────────────────────────────────────────────

function DispatchFooter(props: {
  busy: boolean;
  canDispatch: boolean;
  supplierReady: boolean;
  priceReady: boolean;
  tierCount: number;
  targetingCount: number;
  imageCount: number;
}) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 12,
        zIndex: 10,
        marginTop: 4,
        background: "var(--surface)",
        border: `1px solid ${props.canDispatch ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        boxShadow:
          "0 8px 28px -10px color-mix(in srgb, var(--text) 18%, transparent), 0 1px 0 var(--border) inset",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <ReadinessPill
          label="Supplier URL"
          ok={props.supplierReady}
          required
        />
        <ReadinessPill label="Price hint" ok={props.priceReady} required />
        <CounterPill label="Images" count={props.imageCount} />
        <CounterPill label="Targeting picks" count={props.targetingCount} />
        <CounterPill label="Offer tiers" count={props.tierCount} />
      </div>
      <button
        type="submit"
        className="btn btn-accent"
        disabled={!props.canDispatch}
        style={{
          minWidth: 160,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {props.busy ? "Dispatching…" : "Dispatch run →"}
      </button>
    </div>
  );
}

function ReadinessPill(props: {
  label: string;
  ok: boolean;
  required?: boolean;
}) {
  const color = props.ok
    ? "var(--accent)"
    : props.required
      ? "var(--danger)"
      : "var(--text-dim)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${color} 30%, var(--border))`,
      }}
    >
      <span aria-hidden>{props.ok ? "●" : "○"}</span>
      {props.label}
    </span>
  );
}

function CounterPill(props: { label: string; count: number }) {
  if (props.count === 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: "var(--text-dim)",
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid var(--border)",
      }}
    >
      <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {props.count}
      </strong>
      {props.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field primitive
// ─────────────────────────────────────────────────────────────────────────

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

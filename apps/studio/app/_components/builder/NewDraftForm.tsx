"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { studioPath } from "@/lib/base-path";
import { friendlyError } from "@/lib/studio/error-messages";

/**
 * NewDraftForm — small client component that POSTs to the create
 * draft endpoint and routes the operator to the builder on success.
 *
 * # Validation strategy
 *
 * The server is the source of truth — Zod runs there. Locally we
 * only enforce the minimum (non-empty) so error UX feels snappy.
 *
 * # Slug auto-suggest
 *
 * As the operator types the title we derive a slug suggestion on
 * the fly. They can override it before submitting.
 */

export function NewDraftForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugDirty ? slug : derive(title);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!effectiveSlug.trim()) {
      setError("Slug is required.");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(studioPath("/api/studio/drafts"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), slug: effectiveSlug }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        if (json?.code === "conflict") {
          setError("That slug already exists for this store. Pick a different one.");
        } else if (json?.code === "mode_unavailable") {
          setError("Dual-write persistence is disabled — enable it before creating drafts.");
        } else if (json?.code === "invalid_input") {
          setError(
            json.issues?.[0]?.message
              ? `Validation: ${json.issues[0].message}`
              : "Invalid input.",
          );
        } else {
          setError(`Could not create draft (${resp.status}).`);
        }
        return;
      }
      const id = json.value?.id;
      if (!id) {
        setError("Server returned no draft id.");
        return;
      }
      router.push(`/drafts/${encodeURIComponent(id)}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "unknown_error";
      // eslint-disable-next-line no-console
      console.error("[NewDraftForm] create failed", raw);
      setError(friendlyError(raw));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 540 }}
    >
      <div className="field">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={200}
        />
      </div>
      <div className="field">
        <label>Slug</label>
        <input
          type="text"
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugDirty(true);
          }}
          maxLength={80}
          placeholder="lowercase-letters-and-numbers"
        />
        <small className="text-faint">
          Used in the storefront URL: <code className="code">/p/{effectiveSlug || "your-slug"}</code>
        </small>
      </div>
      {error ? (
        <p className="banner danger" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          className="btn btn-accent"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create draft"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => router.push("/drafts")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function derive(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

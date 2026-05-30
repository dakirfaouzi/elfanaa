import { NextResponse } from "next/server";
import { fanaaStore } from "@platform/stores";
import { getStudioPersistence, runIdToSlug } from "@/lib/studio/persistence";
import { listRuns, readRun } from "@/lib/studio/run-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/diag/run?runId=<id>&slug=<slug> — TEMPORARY end-to-end image trace.
 *
 * Reads the ACTUAL persisted values for one pipeline run so we can see
 * exactly where a generated image stops propagating:
 *
 *   image_gen.results[].url      (did fal return URLs?)
 *   image_post.hero.src          (did post-processing receive them?)
 *   assemble finalProduct.images (what became images[0]?)
 *   draft.payload hero/ogImage   (after persist-generated-images rehost)
 *   published.document hero      (what publish snapshotted)
 *   storefront_catalog hero_image_url (what fanaa reads)
 *
 * No params → newest run. `?runId=` pins a run. `?slug=` overrides the
 * slug used for the draft/published/catalog lookups (defaults to the
 * run's final product slug / runId-derived slug).
 *
 * Returns only image URLs/keys + non-sensitive metadata. Whitelisted
 * public for triage; REMOVED once the propagation break is fixed.
 */
const STORE_ID = fanaaStore.id;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const runIdParam = url.searchParams.get("runId")?.trim() || null;
  const slugOverride = url.searchParams.get("slug")?.trim() || null;

  const out: Record<string, unknown> = {
    ok: true,
    note: "temporary run trace — remove after diagnosis",
  };

  // ── Resolve which run to trace ────────────────────────────────────
  let runId = runIdParam;
  if (!runId) {
    try {
      const runs = await listRuns();
      out.recentRuns = runs.slice(0, 8).map((r) => ({
        runId: r.runId,
        status: r.status,
        createdAt: r.createdAt,
        finalProductId: r.finalProductId,
      }));
      runId = runs[0]?.runId ?? null;
    } catch (err) {
      out.listRunsError = message(err);
    }
  }
  if (!runId) {
    out.ok = false;
    out.error = "no runs found (pass ?runId=)";
    return NextResponse.json(out, { headers: noStore() });
  }
  out.runId = runId;

  // ── Run record: image_gen / image_post / assemble ─────────────────
  let slug = slugOverride;
  try {
    const result = await readRun(runId);
    if (result.status !== "ok") {
      out.runLoad = { status: result.status };
    } else {
      const run = result.run;
      out.runStatus = run.status;
      const stepByStage = new Map(run.steps.map((s) => [s.stage, s]));

      const imageGen = stepByStage.get("image_gen");
      out.image_gen = imageGen
        ? {
            status: imageGen.status,
            errorMessage: imageGen.errorMessage,
            ...summariseImageGen(imageGen.output),
          }
        : "no_step";

      const imagePost = stepByStage.get("image_post");
      out.image_post = imagePost
        ? {
            status: imagePost.status,
            errorMessage: imagePost.errorMessage,
            ...summariseImagePost(imagePost.output),
          }
        : "no_step";

      const assemble = stepByStage.get("assemble");
      out.assemble = assemble
        ? { status: assemble.status, errorMessage: assemble.errorMessage }
        : "no_step";

      // finalProduct.images — the assembled hero ordering.
      const fp = run.finalProduct as
        | { slug?: string; images?: Array<{ src?: unknown }> }
        | undefined;
      if (fp) {
        out.finalProduct = {
          slug: fp.slug ?? null,
          images: (fp.images ?? []).map((i) => ({
            src: typeof i.src === "string" ? i.src : null,
            srcType: classifyUrl(i.src),
          })),
        };
        if (!slug && typeof fp.slug === "string") slug = fp.slug;
      }
    }
  } catch (err) {
    out.runError = message(err);
  }

  if (!slug) slug = runIdToSlug(runId);
  out.slug = slug;

  // ── Draft / Published / Catalog ───────────────────────────────────
  let repos;
  try {
    repos = getStudioPersistence().repositories;
  } catch (err) {
    out.persistenceError = message(err);
  }

  if (repos) {
    try {
      const draft = await repos.draft.findBySlug({ storeId: STORE_ID, slug });
      out.draft = draft
        ? {
            id: draft.id,
            status: draft.status,
            payloadVersion: draft.payloadVersion,
            ...summariseDocument(draft.payload),
          }
        : null;
    } catch (err) {
      out.draftError = message(err);
    }

    try {
      const published = await repos.published.findCurrent({ storeId: STORE_ID, slug });
      out.published = published
        ? { version: published.version, ...summariseDocument(published.document) }
        : null;
    } catch (err) {
      out.publishedError = message(err);
    }

    try {
      const row = await repos.storefrontCatalog.findBySlug({ storeId: STORE_ID, slug });
      out.catalogRow = row
        ? {
            source: row.source,
            isLive: row.isLive,
            heroImageUrl: row.heroImageUrl,
            heroImageUrlType: classifyUrl(row.heroImageUrl),
          }
        : null;
    } catch (err) {
      out.catalogRowError = message(err);
    }
  }

  out.verdict = buildVerdict(out);
  return NextResponse.json(out, { headers: noStore() });
}

/* -------------------------------------------------------------------------- */

function summariseImageGen(output: unknown): {
  results: Array<{ role: unknown; urlType: string; url: string | null; attempts: unknown }>;
  failed: Array<{ role: unknown; errorMessage: unknown }>;
  totalCostUsd: unknown;
} {
  const o = output as
    | { results?: unknown[]; failed?: unknown[]; totalCostUsd?: unknown }
    | undefined;
  const results = Array.isArray(o?.results) ? o!.results : [];
  const failed = Array.isArray(o?.failed) ? o!.failed : [];
  return {
    results: results.map((r) => {
      const rr = r as { role?: unknown; url?: unknown; attempts?: unknown };
      return {
        role: rr.role,
        url: typeof rr.url === "string" ? rr.url : null,
        urlType: classifyUrl(rr.url),
        attempts: rr.attempts,
      };
    }),
    failed: failed.map((f) => {
      const ff = f as { role?: unknown; errorMessage?: unknown };
      return { role: ff.role, errorMessage: ff.errorMessage };
    }),
    totalCostUsd: o?.totalCostUsd,
  };
}

function summariseImagePost(output: unknown): {
  heroSrc: string | null;
  heroSrcType: string;
  lifestyleCount: number;
  galleryCount: number;
  postProcessed: unknown;
} {
  const o = output as
    | { hero?: { src?: unknown }; lifestyle?: unknown[]; gallery?: unknown[]; postProcessed?: unknown }
    | undefined;
  const heroSrc = typeof o?.hero?.src === "string" ? o!.hero!.src! : null;
  return {
    heroSrc,
    heroSrcType: classifyUrl(heroSrc),
    lifestyleCount: Array.isArray(o?.lifestyle) ? o!.lifestyle!.length : 0,
    galleryCount: Array.isArray(o?.gallery) ? o!.gallery!.length : 0,
    postProcessed: o?.postProcessed,
  };
}

function summariseDocument(document: unknown): {
  heroDesktopSrc: string | null;
  heroDesktopSrcType: string;
  ogImage: string | null;
  ogImageType: string;
} {
  const doc = document as
    | { sections?: unknown; meta?: { ogImage?: unknown } }
    | null
    | undefined;
  const sections = Array.isArray(doc?.sections) ? doc!.sections : [];
  let heroDesktopSrc: string | null = null;
  for (const section of sections) {
    if ((section as { kind?: unknown })?.kind !== "hero") continue;
    const media = (section as { media?: { kind?: unknown; desktopSrc?: unknown } })?.media;
    if (media && media.kind === "image" && typeof media.desktopSrc === "string") {
      heroDesktopSrc = media.desktopSrc;
      break;
    }
  }
  const ogRaw = doc?.meta?.ogImage;
  const ogImage = typeof ogRaw === "string" ? ogRaw : null;
  return {
    heroDesktopSrc,
    heroDesktopSrcType: classifyUrl(heroDesktopSrc),
    ogImage,
    ogImageType: classifyUrl(ogImage),
  };
}

function classifyUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "none";
  const v = value.trim();
  if (v.startsWith("data:")) return "data-url (placeholder)";
  if (v.startsWith("r2://")) return "r2-sentinel (no public base)";
  if (/^https?:\/\//i.test(v)) {
    try {
      return `absolute-url (${new URL(v).hostname})`;
    } catch {
      return "absolute-url (unparseable)";
    }
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    const prefix = v.split("/")[0];
    return `r2-key (${prefix}/…)`;
  }
  return "other-scheme";
}

/** Pinpoint the first stage where the generated URL disappears. */
function buildVerdict(out: Record<string, unknown>): string {
  const ig = out.image_gen as { results?: unknown[] } | string | undefined;
  const igResults = typeof ig === "object" && Array.isArray(ig?.results) ? ig.results : [];
  const heroGen = igResults.find((r) => (r as { role?: unknown }).role === "hero") as
    | { url?: string | null }
    | undefined;
  const ip = out.image_post as { heroSrc?: string | null } | string | undefined;
  const post = typeof ip === "object" ? ip?.heroSrc ?? null : null;
  const draft = out.draft as { heroDesktopSrc?: string | null } | null | undefined;
  const catalog = out.catalogRow as { heroImageUrl?: string | null } | null | undefined;

  if (!heroGen || !heroGen.url) {
    return "image_gen produced NO hero URL → check image_gen.failed[].errorMessage (hero prompt failed).";
  }
  if (!post) {
    return "image_gen returned a hero URL but image_post.hero is empty → role mismatch / image_post bug.";
  }
  const draftHero = draft?.heroDesktopSrc ?? null;
  if (!draftHero) {
    return "image_post had a hero but draft.heroDesktopSrc is empty → persist-generated-images or product-to-draft dropped it.";
  }
  if (draftHero.startsWith("http") && /fal|vendor/i.test(draftHero)) {
    return "draft hero is still the RAW vendor (fal) URL → persist-generated-images did NOT rehost to R2 (upload failed / R2 misconfig). fanaa remotePatterns blocks fal → placeholder.";
  }
  const cat = catalog?.heroImageUrl ?? null;
  if (!cat) {
    return "draft hero is set but catalog hero_image_url is empty → publish/extractHeroImageUrl didn't capture it (re-publish needed).";
  }
  return "values present end-to-end — if storefront still shows placeholder, the resolved CDN URL likely 404s (verify the object exists at cdn.elfanaa.com/<key>).";
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function noStore(): Record<string, string> {
  return { "cache-control": "no-store, max-age=0" };
}

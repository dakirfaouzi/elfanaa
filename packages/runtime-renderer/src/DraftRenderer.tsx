import type { DraftDocument } from "@platform/builder-schema";
import { renderSection } from "./sections";
import { cls } from "./helpers";

/**
 * DraftRenderer — the top-level component the storefront and the
 * Studio preview route mount.
 *
 * # Layout contract
 *
 *   • One outer `<article class="pfp-page">` per draft.
 *   • Each section renders into a `<section>` with `data-section-kind`.
 *   • The sticky CTA (when present) renders AFTER the main flow so
 *     it stacks correctly with `position: sticky`.
 *
 * # Hydration
 *
 * No `useState`, no `useEffect`, no client-only APIs. The rendered
 * tree is identical on server and client — Next.js will not need to
 * hydrate any client component when this is mounted as-is.
 *
 * Callers that need interactivity (e.g. a carousel) should wrap
 * specific sections in their own client component, NOT replace this
 * renderer.
 */

export interface DraftRendererProps {
  document: DraftDocument;
  /** Primary locale — drives RTL direction + locale fallback. */
  primary?: "ar" | "en";
  /** Optional className appended to the root `<article>`. */
  className?: string;
}

export function DraftRenderer(props: DraftRendererProps): React.ReactElement {
  const { document, primary = "ar", className } = props;

  const mainSections = document.sections.filter(
    (s) => s.kind !== "sticky_cta" && s.enabled !== false,
  );
  const stickySections = document.sections.filter(
    (s) => s.kind === "sticky_cta" && s.enabled !== false,
  );

  return (
    <article
      className={[cls.page, className].filter(Boolean).join(" ")}
      dir={primary === "ar" ? "rtl" : "ltr"}
      lang={primary}
    >
      {mainSections.map((section) => renderSection(section, primary))}
      {stickySections.map((section) => renderSection(section, primary))}
    </article>
  );
}

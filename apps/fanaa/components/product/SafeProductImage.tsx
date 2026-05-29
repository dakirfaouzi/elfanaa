"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";

/**
 * Branch selector — exported separately so the (non-React) unit
 * tests can pin which rendering path the component takes for any
 * given `src`. The component delegates to this and switches its
 * JSX accordingly.
 *
 *   • `"img-fill"`  → plain `<img>` positioned to fill its parent
 *                     (mirrors next/image's `fill` mode).
 *   • `"img-fixed"` → plain `<img>` with caller-provided width/
 *                     height (mirrors next/image's non-fill mode).
 *   • `"next-image"` → standard next/image pass-through.
 */
export function pickImageStrategy(
  src: unknown,
  fill: boolean | undefined,
  hasError: boolean,
): "img-fill" | "img-fixed" | "next-image" {
  const srcString = typeof src === "string" ? src : null;
  const isDataUrl = hasError || (srcString?.startsWith("data:") ?? false);
  if (!isDataUrl) return "next-image";
  return fill ? "img-fill" : "img-fixed";
}

/**
 * SafeProductImage — the single component every product surface
 * uses to render imagery.
 *
 * # Why this exists (M12 / Step 2 / Phase 2.5.1)
 *
 * Three separate failure modes had been chipping at the storefront
 * since the hybrid catalog landed; each one was being patched
 * locally and the fixes kept drifting:
 *
 *   1. **AI-generated products' placeholder didn't render in the
 *      PDP gallery.** The shop card, cart drawer, and cross-sell
 *      card rendered it fine — only the gallery showed a blank
 *      cream tile. Every other surface uses `<Image fill />`
 *      WITHOUT `priority`; the gallery is the only one that sets
 *      `priority` (because it's the LCP element on the PDP).
 *      Next.js 15.5 + `priority` + a `data:` URL src don't compose
 *      — the optimizer-bypass path is partially broken in that
 *      combination. The fix: when the src is a data URL, render a
 *      plain `<img>` and skip next/image entirely.
 *
 *   2. **External image 404s leave broken tiles forever.** The
 *      runtime logs show recurring `upstream image response failed
 *      … 404` errors for Unsplash photo IDs that no longer exist
 *      in the codebase OR git history — they're either DB-side
 *      drift or stale CDN cache from a previous deploy. We can't
 *      patch the URL list out of the binary at this layer. The
 *      fix: every `<Image>` in product surfaces auto-swaps to the
 *      placeholder when `onError` fires.
 *
 *   3. **Inconsistent surface coverage.** Phase 2.4.3 hardened
 *      access to `images[N]` via helpers, but the actual
 *      `<Image>` call sites still varied surface-by-surface
 *      (priority, sizes, placeholder configuration). The next
 *      regression in this area would have to re-audit 7+ files
 *      to confirm coverage.
 *
 * # The contract
 *
 *   • Accepts the same props as `next/image` (the call sites are
 *     drop-in compatible — replace `<Image>` with
 *     `<SafeProductImage>`).
 *   • For `src` starting with `data:`, renders a plain `<img>`
 *     with the same `fill` / `sizes` / `className` behaviour. No
 *     optimizer hop, no preload link, no `unoptimized` prop
 *     plumbing, no Next.js 15 quirks.
 *   • For everything else, renders `next/image` with all the
 *     optimization paths intact (LCP priority hint, responsive
 *     sizes, format negotiation).
 *   • On error (404, CSP block, CORS, decode failure), swaps the
 *     src to `PLACEHOLDER_PRODUCT_IMAGE` and re-renders. The
 *     swap is one-shot per mount — if the placeholder itself
 *     fails (shouldn't, it's an inline data URL), we don't loop.
 *
 * # Why a wrapper instead of patching call sites
 *
 *   • Single source of truth for the "what do we render when a
 *     product image is unavailable" question. Future regressions
 *     land in ONE file.
 *   • Removes the need for every consumer to remember
 *     `unoptimized={isDataUrl}` / `priority={!isDataUrl}` /
 *     `onError={() => setSrc(PLACEHOLDER)}` boilerplate.
 *   • Lets us evolve the strategy (e.g. switch to `<picture>`
 *     with `<source>` fallback, add Cloudflare-Polish, etc.)
 *     without touching every product surface.
 *
 * # What this is NOT
 *
 *   • A general-purpose `<Image>` replacement. Editorial photos
 *     (HomeHero, AboutHero, ProductLifestyle band) can use it
 *     too, but the `getPrimaryImage` / `getLifestyleImage`
 *     helpers ensure those callers always pass a non-null
 *     `image.src`, so the data-URL branch and the onError swap
 *     are still the relevant safety nets.
 */
export function SafeProductImage(props: ImageProps) {
  const { src, onError: callerOnError, priority, ...rest } = props;

  /*
   * Error state: one-shot fallback to the placeholder. Stored as a
   * boolean rather than swapping `src` directly so the caller's
   * original src stays inspectable in React DevTools (helpful for
   * triaging why a particular image is falling back).
   */
  const [hasError, setHasError] = useState(false);
  const effectiveSrc = hasError ? PLACEHOLDER_PRODUCT_IMAGE.src : src;
  const strategy = pickImageStrategy(src, rest.fill, hasError);

  /*
   * Data-URL branch.
   *
   * `next/image` claims to auto-detect data URLs and skip the
   * optimizer, but Next.js 15.5 + `priority` produces a blank
   * tile in the PDP gallery context (verified visually on
   * production). A plain `<img>` with the equivalent positioning
   * sidesteps that entirely. The `fill` mode is replicated via
   * the same `position: absolute; inset: 0; width: 100%;
   * height: 100%` CSS next/image applies internally.
   */
  if (strategy === "img-fill") {
    const altValue = typeof rest.alt === "string" ? rest.alt : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={effectiveSrc as string}
        alt={altValue}
        className={rest.className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          ...(rest.style ?? {}),
        }}
        onError={() => {
          if (!hasError) setHasError(true);
          callerOnError?.(undefined as never);
        }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  /*
   * Non-fill data URL — rare (cart-drawer thumbnails etc. all use
   * `fill`), but provide parity so the wrapper is unconditionally
   * safe. `width` and `height` MUST be set in this branch (next/
   * image enforces it for non-fill modes); we forward whatever the
   * caller passed without re-deriving.
   */
  if (strategy === "img-fixed") {
    const altValue = typeof rest.alt === "string" ? rest.alt : "";
    const widthAttr = typeof rest.width === "number" ? rest.width : undefined;
    const heightAttr =
      typeof rest.height === "number" ? rest.height : undefined;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={effectiveSrc as string}
        alt={altValue}
        width={widthAttr}
        height={heightAttr}
        className={rest.className}
        style={rest.style}
        onError={() => {
          if (!hasError) setHasError(true);
          callerOnError?.(undefined as never);
        }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  /*
   * Standard path — pass through to next/image with onError
   * intercepted so 404s / decode failures swap to the placeholder
   * one-shot. We forward `priority` only on the first render; if
   * we've already fallen back to the placeholder data URL, we'll
   * hit the data-URL branch above on the next render and the
   * priority hint is moot.
   */
  return (
    <Image
      {...rest}
      src={src}
      priority={priority}
      onError={(event) => {
        if (!hasError) setHasError(true);
        callerOnError?.(event);
      }}
    />
  );
}

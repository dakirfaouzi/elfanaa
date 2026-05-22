import type { MediaRef } from "@platform/builder-schema";

/**
 * <Media> — the single renderer primitive for images, GIFs, and
 * videos. Used by every section that takes a media ref.
 *
 * # Why one component for all three
 *
 * The runtime gives each kind the right HTML element:
 *
 *   • image / gif → `<picture><source><img>` (with mobile/desktop variants)
 *   • video       → `<video>` with optional poster + autoplay flags
 *
 * Centralising this means:
 *
 *   1. The lazy-loading rule (`loading="lazy"`, `decoding="async"`)
 *      lives in one place.
 *   2. The mobile variant rule lives in one place.
 *   3. The CLS-safe width/height attributes live in one place.
 *
 * # Server-safe
 *
 * No `useEffect`, no `useState`, no client-only APIs. The `controls`
 * attribute on `<video>` is rendered server-side; the browser owns
 * the actual playback UI.
 *
 * # Empty media
 *
 * When `media` is `null`/`undefined`, we render `null` — the caller
 * is responsible for any placeholder UI.
 */

export interface MediaProps {
  media: MediaRef | null | undefined;
  /** When the media is a video, these flags propagate to <video>. */
  video?: {
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
  };
  /** Inline style override for the wrapping element. */
  style?: React.CSSProperties;
  className?: string;
  /** Width/height fallbacks when the media ref carries none. */
  fallbackAspect?: number;
}

export function Media(props: MediaProps): React.ReactElement | null {
  const { media, video, style, className, fallbackAspect = 4 / 5 } = props;
  if (!media) return null;

  const w = media.width;
  const h = media.height;
  const aspectStyle: React.CSSProperties =
    w && h
      ? { aspectRatio: `${w} / ${h}` }
      : { aspectRatio: `${fallbackAspect}` };

  if (media.kind === "video") {
    return (
      <video
        className={className}
        style={{ width: "100%", display: "block", ...aspectStyle, ...style }}
        src={media.desktopSrc}
        poster={media.poster}
        autoPlay={video?.autoplay ?? false}
        loop={video?.loop ?? false}
        muted={video?.muted ?? true}
        controls={video?.controls ?? true}
        playsInline
        preload="metadata"
      />
    );
  }

  // image / gif
  const hasMobile = Boolean(media.mobileSrc && media.mobileSrc.length > 0);
  return (
    <picture>
      {hasMobile ? (
        <source media="(max-width: 640px)" srcSet={media.mobileSrc} />
      ) : null}
      <img
        className={className}
        style={{ width: "100%", display: "block", ...aspectStyle, ...style }}
        src={media.desktopSrc}
        alt={media.alt ?? ""}
        width={w ?? undefined}
        height={h ?? undefined}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

/**
 * ELFANAA — Brand surface entry point.
 *
 * Anything that *renders* the brand (mark, wordmark, lockup, ornament)
 * exports through this barrel. Keeping it tight forces consumers to
 * use the system instead of building their own one-offs.
 */
export { Logo } from "./Logo";
export { BrandMark } from "./BrandMark";
export { Wordmark } from "./Wordmark";
export { Flourish } from "./Flourish";
export {
  DEFAULT_TAGLINE_MODE,
  LOGO_MIN_SIZE_PX,
  LOGO_SCALE,
  type LogoSize,
  type LogoTone,
  type LogoVariant,
  type TaglineMode,
} from "./brand.config";

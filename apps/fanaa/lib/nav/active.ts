/**
 * Pure active-route helpers for the header + mobile nav.
 *
 * Kept framework-free (just takes a pathname string) so the matching
 * rule is consistent across surfaces and unit-testable.
 */

/** Exact path match, or a nested child of it (`/about` ⊃ `/about/team`). */
export function isPathActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when the viewer is anywhere in a shop/discovery context. */
export function isShopContextActive(pathname: string): boolean {
  return (
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/concerns") ||
    pathname.startsWith("/for/")
  );
}

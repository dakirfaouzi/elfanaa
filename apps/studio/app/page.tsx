import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Studio root — M8 redirects authenticated operators straight to the
 * products browser, which is the most common first action.
 *
 * Unauthenticated visitors are redirected to /login by the middleware
 * before this handler runs, so this route is guaranteed to be post-auth.
 *
 * The pre-M8 milestone-tracker dashboard has been retired — every
 * milestone metadata it tracked is now reflected in
 * docs/architecture/PLATFORM.md, which is the single source of truth.
 */
export default function StudioHome() {
  redirect("/products");
}

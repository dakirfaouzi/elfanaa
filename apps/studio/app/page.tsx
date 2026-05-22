import { redirect } from "next/navigation";
import { studioPath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

/**
 * Studio root — M11 redirects authenticated operators to /drafts,
 * which is the primary work surface (the builder canvas). Operators
 * who want the file-backed M7 products browser navigate there via
 * the NavBar tab.
 *
 * Unauthenticated visitors are redirected to /login by the middleware
 * before this handler runs, so this route is guaranteed to be post-auth.
 *
 * # basePath note
 *
 * `redirect()` does not auto-prefix the configured Next.js basePath
 * (unlike `<Link>` or `router.push`). When Studio is mounted at
 * `/studio`, we must include the prefix manually or the browser will
 * navigate to `elfanaa.com/drafts` (storefront 404) instead of
 * `elfanaa.com/studio/drafts`.
 */
export default function StudioHome() {
  redirect(studioPath("/drafts"));
}

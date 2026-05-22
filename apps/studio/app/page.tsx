import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Studio root — M11 redirects authenticated operators to /drafts,
 * which is the primary work surface (the builder canvas). Operators
 * who want the file-backed M7 products browser navigate there via
 * the NavBar tab.
 *
 * Unauthenticated visitors are redirected to /login by the middleware
 * before this handler runs, so this route is guaranteed to be post-auth.
 */
export default function StudioHome() {
  redirect("/drafts");
}

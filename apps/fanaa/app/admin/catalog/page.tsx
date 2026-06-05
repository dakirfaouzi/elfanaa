import { Suspense } from "react";
import { CatalogClient } from "./CatalogClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading…</div>}>
      <CatalogClient />
    </Suspense>
  );
}

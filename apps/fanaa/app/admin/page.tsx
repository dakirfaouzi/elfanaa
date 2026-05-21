import { Suspense } from "react";
import { OverviewClient } from "./OverviewClient";

export const dynamic = "force-dynamic";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading overview…</div>}>
      <OverviewClient />
    </Suspense>
  );
}

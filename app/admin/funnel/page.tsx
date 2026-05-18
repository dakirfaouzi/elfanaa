import { Suspense } from "react";
import { FunnelClient } from "./FunnelClient";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading…</div>}>
      <FunnelClient />
    </Suspense>
  );
}

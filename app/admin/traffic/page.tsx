import { Suspense } from "react";
import { TrafficClient } from "./TrafficClient";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading…</div>}>
      <TrafficClient />
    </Suspense>
  );
}

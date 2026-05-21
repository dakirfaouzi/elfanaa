import { Suspense } from "react";
import { GeoClient } from "./GeoClient";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading…</div>}>
      <GeoClient />
    </Suspense>
  );
}

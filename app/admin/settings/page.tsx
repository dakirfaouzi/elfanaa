import { Suspense } from "react";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="fa-skel" style={{ height: 200 }} />}>
      <SettingsClient />
    </Suspense>
  );
}

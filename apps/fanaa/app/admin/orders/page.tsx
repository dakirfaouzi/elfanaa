import { Suspense } from "react";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="fa-empty">Loading orders…</div>}>
      <OrdersClient />
    </Suspense>
  );
}

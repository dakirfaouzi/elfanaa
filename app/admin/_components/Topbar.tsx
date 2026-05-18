"use client";

import { usePathname } from "next/navigation";
import { DateRangePicker } from "./DateRangePicker";

const TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/orders": "Orders",
  "/admin/funnel": "Funnel",
  "/admin/products": "Products",
  "/admin/geo": "Geo intelligence",
  "/admin/traffic": "Traffic quality",
  "/admin/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname() ?? "/admin";
  const title = TITLES[pathname] ?? "Admin";
  return (
    <header className="fa-topbar">
      <h1>{title}</h1>
      <div className="fa-topbar-right">
        <DateRangePicker />
      </div>
    </header>
  );
}

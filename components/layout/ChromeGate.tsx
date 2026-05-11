"use client";

import { usePathname } from "next/navigation";

const STANDALONE_PREFIXES = ["/sugarbear", "/thank-you"];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isStandalone = STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));
  if (isStandalone) return null;
  return <>{children}</>;
}

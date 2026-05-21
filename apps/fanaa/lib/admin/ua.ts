import { UAParser } from "ua-parser-js";

export type ParsedUA = {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
};

/**
 * Wraps ua-parser-js with a forgiving, dashboard-friendly schema.
 *
 * Anything we can't classify becomes the literal "Unknown" so charts don't
 * sprout blank legends. Device is bucketed to three values so the dashboard
 * can pivot cleanly without long-tail noise.
 */
export function parseUA(uaString: string | null | undefined): ParsedUA {
  if (!uaString) return { device: "desktop", browser: "Unknown", os: "Unknown" };

  const parsed = new UAParser(uaString).getResult();
  const deviceType = parsed.device?.type;
  const device: ParsedUA["device"] =
    deviceType === "mobile" ? "mobile" : deviceType === "tablet" ? "tablet" : "desktop";

  return {
    device,
    browser: parsed.browser?.name ?? "Unknown",
    os: parsed.os?.name ?? "Unknown",
  };
}

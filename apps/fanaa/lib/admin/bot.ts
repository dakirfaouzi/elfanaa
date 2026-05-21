/**
 * Heuristic UA-based bot detection.
 *
 * This is a *cheap first line* of defence. MaxMind GeoIP2 Insights and the
 * downstream traffic-quality scorer provide the deeper signals (datacenter,
 * VPN, anonymizer). We never want to ship a 100-pattern bloat list — these
 * cover the noisy classes that hit DTC stores:
 *   • search engine crawlers
 *   • headless / scripted browsers
 *   • marketing / SEO scanners
 *   • Facebook / TikTok / X link previewers
 *   • generic "bot" or "crawler" tokens
 */
const BOT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /headless/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /lighthouse/i,
  /pagespeed/i,
  /chrome-lighthouse/i,
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /sogou/i,
  /facebookexternalhit/i,
  /meta-externalagent/i,
  /twitterbot/i,
  /linkedinbot/i,
  /tiktokspider/i,
  /snapchat/i,
  /pinterestbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /slackbot/i,
  /discordbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /screaming.?frog/i,
  /python-requests/i,
  /node-fetch/i,
  /axios/i,
  /curl\//i,
  /wget/i,
  /go-http-client/i,
  /httpclient/i,
  /scrapy/i,
  /apachebench/i,
  /^$/,
];

export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.some((re) => re.test(ua));
}

/** True when the UA looks like a real browser used by a real human. */
export function looksLikeHuman(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (isBotUA(ua)) return false;
  // A bare minimum: real browsers always carry "Mozilla/".
  return /Mozilla\//.test(ua);
}

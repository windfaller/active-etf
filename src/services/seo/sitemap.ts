import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";

export interface SitemapEntry {
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  lastmod?: string;
}

export type SitemapLastModifiedByPath = Record<string, string | undefined>;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function sitemapEntries(lastModifiedByPath: SitemapLastModifiedByPath = {}): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/market", changefreq: "daily", priority: "0.9" },
    { path: "/active-etfs/", changefreq: "weekly", priority: "0.8" },
    { path: "/data-usage/", changefreq: "weekly", priority: "0.5" }
  ];
  entries.push(
    { path: "/stocks", changefreq: "daily", priority: "0.8" },
    { path: "/stocks/tw/2330", changefreq: "daily", priority: "0.75" },
    { path: "/stocks/us/MU", changefreq: "daily", priority: "0.7" },
    { path: "/compare/etfs", changefreq: "weekly", priority: "0.7" },
    { path: "/performance", changefreq: "daily", priority: "0.85" },
    { path: "/signals", changefreq: "daily", priority: "0.8" },
    { path: "/signals/consecutive", changefreq: "daily", priority: "0.7" },
    { path: "/signals/reversals", changefreq: "daily", priority: "0.7" },
    { path: "/signals/divergence", changefreq: "daily", priority: "0.7" },
    { path: "/methodology", changefreq: "monthly", priority: "0.6" }
  );

  configuredEtfs
    .filter((etf) => etf.enabled)
    .forEach((etf) => {
      entries.push(
        { path: `/etf/${etf.etfCode}`, changefreq: "daily", priority: "0.8" },
        { path: `/etf/${etf.etfCode}/changes`, changefreq: "daily", priority: "0.75" },
        { path: `/etf/${etf.etfCode}/premium-history`, changefreq: "daily", priority: "0.65" },
        { path: `/etf/${etf.etfCode}/style`, changefreq: "daily", priority: "0.65" }
      );
    });

  entries.push({ path: "/global-etfs", changefreq: "daily", priority: "0.8" });
  enabledGlobalEtfs
    .filter((etf) => etf.strategyType !== "13f")
    .forEach((etf) => entries.push({ path: `/global-etfs/${etf.etfCode}`, changefreq: "daily", priority: "0.7" }));

  entries.push({ path: "/institutions", changefreq: "weekly", priority: "0.7" });
  enabledGlobalEtfs
    .filter((etf) => etf.strategyType === "13f")
    .forEach((etf) => entries.push({ path: `/institutions/${etf.etfCode}`, changefreq: "weekly", priority: "0.6" }));

  return entries.map((entry) => {
    const lastmod = lastModifiedByPath[entry.path];
    return lastmod && isoDatePattern.test(lastmod) ? { ...entry, lastmod } : entry;
  });
}

export function buildSitemapXml(baseUrl: string, lastModifiedByPath: SitemapLastModifiedByPath = {}): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  const urls = sitemapEntries(lastModifiedByPath)
    .map((entry) => {
      const loc = `${normalizedBaseUrl}${entry.path}`;
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', urls, "</urlset>", ""].join(
    "\n"
  );
}

export function buildRobotsTxt(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  return ["User-agent: *", "Allow: /", `Sitemap: ${normalizedBaseUrl}/sitemap.xml`, ""].join("\n");
}

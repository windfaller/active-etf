import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";

interface SitemapEntry {
  path: string;
  changefreq: "daily" | "weekly";
  priority: string;
}

const lastmod = "2026-07-04";

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function sitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/market", changefreq: "daily", priority: "0.9" },
    { path: "/active-etfs/", changefreq: "weekly", priority: "0.8" }
  ];

  configuredEtfs
    .filter((etf) => etf.enabled)
    .forEach((etf) => {
      entries.push(
        { path: `/etf/${etf.etfCode}`, changefreq: "daily", priority: "0.8" },
        { path: `/etf/${etf.etfCode}/changes`, changefreq: "daily", priority: "0.75" },
        { path: `/etf/${etf.etfCode}/premium-history`, changefreq: "daily", priority: "0.65" }
      );
    });

  entries.push({ path: "/global-etfs", changefreq: "daily", priority: "0.8" });
  enabledGlobalEtfs.forEach((etf) => {
    entries.push({ path: `/global-etfs/${etf.etfCode}`, changefreq: "daily", priority: "0.7" });
  });

  return entries;
}

export function buildSitemapXml(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  const urls = sitemapEntries()
    .map((entry) => {
      const loc = `${normalizedBaseUrl}${entry.path}`;
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
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

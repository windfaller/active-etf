import { describe, expect, it } from "vitest";
import type { HttpRequest } from "@azure/functions";
import { getRobotsTxt, getSitemapXml, sitemapLastModifiedPaths } from "../../src/api/getSeoFiles.js";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { siteBaseUrlFromHost, siteBaseUrlFromHostCandidates } from "../../src/services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml, sitemapEntries } from "../../src/services/seo/sitemap.js";

describe("SEO sitemap files", () => {
  const emptyRequest = {} as HttpRequest;
  const emptyContext = {} as never;

  it("publishes one canonical inthewins sitemap", async () => {
    const response = await getSitemapXml(emptyRequest, emptyContext);
    expect(response.body).toContain("<loc>https://active-etf.inthewins.com/</loc>");
    expect(response.body).toContain("<loc>https://active-etf.inthewins.com/etf/00981A</loc>");
    expect(response.body).not.toContain("active-etf.chicoo.co");
  });

  it("keeps robots.txt on the canonical sitemap", async () => {
    const response = await getRobotsTxt(emptyRequest, emptyContext);
    expect(response.body).toContain("Sitemap: https://active-etf.inthewins.com/sitemap.xml");
  });

  it("normalizes legacy and apex hosts to the production subdomain", () => {
    expect(siteBaseUrlFromHost("inthewins.com")).toBe("https://active-etf.inthewins.com");
    expect(siteBaseUrlFromHost("www.inthewins.com")).toBe("https://active-etf.inthewins.com");
    expect(siteBaseUrlFromHost("chicoo.co")).toBe("https://active-etf.inthewins.com");
    expect(siteBaseUrlFromHost("active-etf.chicoo.co")).toBe("https://active-etf.inthewins.com");
  });

  it("normalizes an explicitly stale PUBLIC_BASE_URL", () => {
    const original = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://active-etf.chicoo.co";
    try { expect(siteBaseUrlFromHost("attacker.example")).toBe("https://active-etf.inthewins.com"); }
    finally { if (original === undefined) delete process.env.PUBLIC_BASE_URL; else process.env.PUBLIC_BASE_URL = original; }
  });

  it("uses the first allowed host candidate while preserving canonical origin", () => {
    expect(siteBaseUrlFromHostCandidates(["https://active-etf.chicoo.co/api/sitemap.xml", "active-etf.inthewins.com"])).toBe(
      "https://active-etf.inthewins.com"
    );
  });

  it("keeps sitemap coverage in sync and separates ETF from 13F routes", () => {
    const taiwanCount = configuredEtfs.filter((etf) => etf.enabled).length;
    const globalCount = enabledGlobalEtfs.filter((etf) => etf.strategyType !== "13f").length;
    const institutionCount = enabledGlobalEtfs.filter((etf) => etf.strategyType === "13f").length;
    expect(sitemapEntries()).toHaveLength(15 + taiwanCount * 4 + globalCount + institutionCount);
    expect(sitemapEntries()).toContainEqual(expect.objectContaining({ path: "/institutions/ARK13F" }));
    expect(sitemapEntries()).not.toContainEqual(expect.objectContaining({ path: "/global-etfs/ARK13F" }));
    expect(sitemapEntries()).toContainEqual(expect.objectContaining({ path: "/stocks/tw/2330" }));
    expect(sitemapEntries()).toContainEqual(expect.objectContaining({ path: "/compare/etfs" }));
    expect(sitemapEntries()).toContainEqual(expect.objectContaining({ path: "/signals/reversals" }));
    expect(sitemapEntries()).toContainEqual(expect.objectContaining({ path: "/etf/00981A/style" }));
  });

  it("builds robots and sitemap with the canonical origin", () => {
    const sitemap = buildSitemapXml("https://active-etf.inthewins.com");
    expect(sitemap).not.toContain("chicoo.co");
    expect(sitemap).not.toContain("<lastmod>");
    expect(buildRobotsTxt("https://active-etf.inthewins.com")).toContain("Sitemap: https://active-etf.inthewins.com/sitemap.xml");
  });

  it("uses real per-source dates and ignores invalid lastmod values", () => {
    const paths = sitemapLastModifiedPaths(
      new Map([["00981A", "2026-07-20"]]),
      new Map([["DRAM", "2026-07-23"], ["ARK13F", "2026-03-31"]]),
      { recommendedTaiwanDate: "2026-07-20", usMuDate: "2026-07-23" }
    );
    const sitemap = buildSitemapXml("https://active-etf.inthewins.com", {
      ...paths,
      "/methodology": "not-a-date"
    });
    expect(paths["/etf/00981A"]).toBe("2026-07-20");
    expect(paths["/global-etfs/DRAM"]).toBe("2026-07-23");
    expect(paths["/institutions/ARK13F"]).toBe("2026-03-31");
    expect(paths["/signals"]).toBe("2026-07-20");
    expect(paths["/stocks/us/MU"]).toBe("2026-07-23");
    expect(sitemap).toContain("<lastmod>2026-07-20</lastmod>");
    expect(sitemap).toContain("<lastmod>2026-07-23</lastmod>");
    expect(sitemap).not.toContain("<lastmod>not-a-date</lastmod>");
  });
});

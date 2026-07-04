import { describe, expect, it } from "vitest";
import type { HttpRequest } from "@azure/functions";
import { getInthewinsSitemapXml, getRobotsTxt, getSitemapXml } from "../../src/api/getSeoFiles.js";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { siteBaseUrlFromHost, siteBaseUrlFromHostCandidates } from "../../src/services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml, sitemapEntries } from "../../src/services/seo/sitemap.js";

describe("SEO sitemap files", () => {
  const emptyRequest = {} as HttpRequest;
  const emptyContext = {} as never;

  it("keeps the default sitemap fixed to the chicoo host", async () => {
    const response = await getSitemapXml(emptyRequest, emptyContext);
    expect(response.body).toContain("<loc>https://active-etf.chicoo.co/</loc>");
    expect(response.body).not.toContain("active-etf.inthewins.com");
  });

  it("builds an independent inthewins sitemap", async () => {
    const response = await getInthewinsSitemapXml(emptyRequest, emptyContext);
    expect(response.body).toContain("<loc>https://active-etf.inthewins.com/</loc>");
    expect(response.body).toContain("<loc>https://active-etf.inthewins.com/etf/00981A</loc>");
    expect(response.body).not.toContain("active-etf.chicoo.co");
  });

  it("keeps robots.txt on the default sitemap", async () => {
    const response = await getRobotsTxt(emptyRequest, emptyContext);
    expect(response.body).toContain("Sitemap: https://active-etf.chicoo.co/sitemap.xml");
  });

  it("builds sitemap URLs from the request host", () => {
    const xml = buildSitemapXml(siteBaseUrlFromHost("active-etf.inthewins.com"));

    expect(xml).toContain("<loc>https://active-etf.inthewins.com/</loc>");
    expect(xml).toContain("<loc>https://active-etf.inthewins.com/etf/00981A</loc>");
    expect(xml).not.toContain("active-etf.chicoo.co");
  });

  it("normalizes apex and www hosts to active-etf subdomain sitemap URLs", () => {
    expect(siteBaseUrlFromHost("inthewins.com")).toBe("https://active-etf.inthewins.com");
    expect(siteBaseUrlFromHost("www.inthewins.com")).toBe("https://active-etf.inthewins.com");
    expect(siteBaseUrlFromHost("chicoo.co")).toBe("https://active-etf.chicoo.co");
    expect(siteBaseUrlFromHost("www.chicoo.co")).toBe("https://active-etf.chicoo.co");
  });

  it("keeps built-in sitemap hosts available when PUBLIC_SITE_HOSTS is set", () => {
    const originalValue = process.env.PUBLIC_SITE_HOSTS;
    process.env.PUBLIC_SITE_HOSTS = "active-etf.chicoo.co";
    try {
      expect(siteBaseUrlFromHost("active-etf.inthewins.com")).toBe("https://active-etf.inthewins.com");
    } finally {
      if (originalValue === undefined) delete process.env.PUBLIC_SITE_HOSTS;
      else process.env.PUBLIC_SITE_HOSTS = originalValue;
    }
  });

  it("uses the first allowed request host candidate before forwarded fallback hosts", () => {
    expect(siteBaseUrlFromHostCandidates(["https://active-etf.inthewins.com/api/sitemap.xml", "active-etf.chicoo.co"])).toBe(
      "https://active-etf.inthewins.com"
    );
  });

  it("falls back to the canonical production host for untrusted hosts", () => {
    expect(siteBaseUrlFromHost("attacker.example")).toBe("https://active-etf.chicoo.co");
  });

  it("keeps sitemap coverage in sync with enabled ETF configs", () => {
    const expectedCount = 3 + configuredEtfs.filter((etf) => etf.enabled).length * 3 + 1 + enabledGlobalEtfs.length;
    expect(sitemapEntries()).toHaveLength(expectedCount);
  });

  it("builds a host-aware robots.txt sitemap pointer", () => {
    expect(buildRobotsTxt("https://active-etf.inthewins.com")).toContain("Sitemap: https://active-etf.inthewins.com/sitemap.xml");
  });
});

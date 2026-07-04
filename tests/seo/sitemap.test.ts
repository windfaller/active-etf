import { describe, expect, it } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { siteBaseUrlFromHost } from "../../src/services/seo/siteUrls.js";
import { buildRobotsTxt, buildSitemapXml, sitemapEntries } from "../../src/services/seo/sitemap.js";

describe("SEO sitemap files", () => {
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

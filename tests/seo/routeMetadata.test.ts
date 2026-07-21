import { describe, expect, it } from "vitest";
import { allStaticSeoPaths, routeMetadataForPath, routeStructuredData, SITE_ORIGIN } from "../../src/web/seo/routeMetadata.js";

describe("build-time route metadata", () => {
  it("gives market and ETF routes distinct metadata", () => {
    const market = routeMetadataForPath("/market");
    const overview = routeMetadataForPath("/etf/00981A");
    const changes = routeMetadataForPath("/etf/00981A/changes");
    expect(market?.title).toContain("市場總覽");
    expect(overview?.h1).toContain("00981A 主動統一台股增長");
    expect(overview?.intro).toContain("統一投信");
    expect(changes?.title).not.toBe(overview?.title);
    expect(changes?.path).toBe("/etf/00981A/changes");
  });

  it("keeps DRAM and 13F on different route families", () => {
    expect(routeMetadataForPath("/global-etfs/DRAM")?.title).toContain("DRAM Roundhill Memory ETF");
    expect(routeMetadataForPath("/global-etfs/ARK13F")).toBeNull();
    expect(routeMetadataForPath("/institutions/ARK13F")?.description).toContain("13F");
  });

  it("does not canonicalize unknown ETF codes to a default ETF", () => {
    expect(routeMetadataForPath("/etf/UNKNOWN")).toBeNull();
    expect(allStaticSeoPaths()).not.toContain("/etf/UNKNOWN");
  });

  it("publishes P1 stock, compare, signal, style, and methodology metadata", () => {
    expect(routeMetadataForPath("/stocks/tw/2330")?.title).toContain("台積電 2330");
    expect(routeMetadataForPath("/stocks/us/MU")?.description).toContain("資料日期");
    expect(routeMetadataForPath("/compare/etfs")?.robots).toBe("index, follow");
    expect(routeMetadataForPath("/compare/etfs?type=tw&codes=00981A,00982A")?.robots).toBe("noindex, nofollow");
    expect(routeMetadataForPath("/search?q=台積電")?.robots).toBe("noindex, nofollow");
    expect(routeMetadataForPath("/signals/reversals")?.h1).toContain("反轉");
    expect(routeMetadataForPath("/etf/00981A/style")?.title).toContain("經理人風格");
    expect(routeMetadataForPath("/methodology")?.description).toContain("13F");
  });

  it("never canonicalizes an unknown stock to a different stock", () => {
    expect(routeMetadataForPath("/stocks/tw/9999")?.path).toBe("/stocks/tw/9999");
    expect(routeMetadataForPath("/stocks/us/ZZZZ")?.path).toBe("/stocks/us/ZZZZ");
  });

  it("uses an Organization creator and no false homepage license", () => {
    const metadata = routeMetadataForPath("/market");
    expect(metadata).not.toBeNull();
    const structured = routeStructuredData(metadata!, "2026-07-21T00:00:00.000Z") as Array<Record<string, unknown>>;
    const dataset = structured.find((item) => item["@type"] === "Dataset") as Record<string, unknown>;
    expect(dataset.creator).toMatchObject({ "@type": "Organization", url: SITE_ORIGIN });
    expect(dataset.dateModified).toBe("2026-07-21T00:00:00.000Z");
    expect(dataset).not.toHaveProperty("license");
    expect(dataset).not.toHaveProperty("temporalCoverage");
    expect(dataset.isBasedOn).toBeTruthy();
  });
});

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

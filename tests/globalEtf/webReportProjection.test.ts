import { describe, expect, it } from "vitest";
import type { GlobalEtfDailyReport } from "../../src/models/GlobalEtf.js";
import { projectGlobalEtfWebReport } from "../../src/services/globalEtf/webReportProjection.js";

describe("global ETF web report projection", () => {
  it("preserves rendered holdings and weight changes while removing report-only payload", () => {
    const report: GlobalEtfDailyReport = {
      productGroup: "global_etf",
      reportDate: "2026-07-21",
      coveredEtfs: ["DRAM"],
      successCount: 1,
      totalCount: 1,
      highlights: [],
      statusRows: [{ etfCode: "DRAM", sourceAsOf: "2026-07-20", rowCount: 1, sourceStatus: "ok" }],
      commonHoldings: [],
      globalMovers: [],
      sections: [{
        etfCode: "DRAM",
        fundName: "Roundhill Memory ETF",
        issuer: "Roundhill Investments",
        strategyType: "index",
        sourceAsOf: "2026-07-20",
        sourceUrl: "https://example.com/dram",
        sourceStatus: "ok",
        rowCount: 1,
        topHoldings: [{
          etfCode: "DRAM",
          fundName: "Roundhill Memory ETF",
          issuer: "Roundhill Investments",
          sourceAsOf: "2026-07-20",
          fetchedAt: new Date("2026-07-21T00:00:00Z"),
          sourceUrl: "https://example.com/dram",
          sourceStatus: "ok",
          productGroup: "global_etf",
          market: "US",
          positionKey: "ticker:MU",
          ticker: "MU",
          name: "Micron Technology",
          weightPercent: 18.4,
          shares: 12_345,
          marketValue: 1_000_000,
          assetType: "Equity",
          exposureComponents: [{ ticker: "MU", name: "Micron", weightPercent: 18.4, assetType: "Equity" }],
          raw: { oversized: "source-only" }
        }],
        newPositions: [],
        exitedPositions: [],
        weightChanges: [{
          etfCode: "DRAM",
          sourceAsOf: "2026-07-20",
          prevSourceAsOf: "2026-07-19",
          positionKey: "ticker:MU",
          ticker: "MU",
          name: "Micron Technology",
          currentWeightPercent: 18.4,
          prevWeightPercent: 17.2,
          deltaPp: 1.2,
          deltaShares: 500,
          status: "increase"
        }],
        shareChanges: Array.from({ length: 100 }, (_, index) => ({
          etfCode: "DRAM", sourceAsOf: "2026-07-20", prevSourceAsOf: "2026-07-19", positionKey: `row:${index}`, name: `Row ${index}`, deltaShares: index + 1, status: "increase" as const
        })),
        marketValueChanges: [],
        sectorChanges: [],
        countryChanges: [],
        takeaway: "Memory exposure"
      }],
      adContext: { tags: ["memory"] },
      html: "<html>email-only report</html>"
    };

    const projected = projectGlobalEtfWebReport(report);
    const holding = projected.sections[0]?.topHoldings[0] as Record<string, unknown>;
    const change = projected.sections[0]?.weightChanges[0] as Record<string, unknown>;

    expect(projected.sections[0]?.topHoldings[0]).toMatchObject({ ticker: "MU", weightPercent: 18.4, marketValue: 1_000_000 });
    expect(projected.sections[0]?.weightChanges[0]).toMatchObject({ ticker: "MU", currentWeightPercent: 18.4, deltaPp: 1.2 });
    expect(holding).not.toHaveProperty("raw");
    expect(holding).not.toHaveProperty("shares");
    expect(change).not.toHaveProperty("deltaShares");
    expect(projected.sections[0]).not.toHaveProperty("shareChanges");
    expect(projected).not.toHaveProperty("html");
    expect(JSON.stringify(projected).length).toBeLessThan(JSON.stringify(report).length / 2);
  });
});

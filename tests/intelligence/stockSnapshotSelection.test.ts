import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";
import type { GlobalEtfSnapshot } from "../../src/models/GlobalEtf.js";
import { globalSnapshotsForStock, latestSnapshotsForStockPipeline, latestStockSearchPipeline } from "../../src/services/intelligence/stockIntelligenceService.js";

function snapshot(etfCode: string, sourceAsOf: string, tickers: string[], strategyType: "index" | "active" | "13f" = "index"): GlobalEtfSnapshot {
  const fetchedAt = new Date(`${sourceAsOf}T12:00:00.000Z`);
  return {
    snapshotId: `${etfCode}-${sourceAsOf}`,
    etfCode,
    fundName: etfCode,
    issuer: "fixture",
    sourceAsOf,
    fetchedAt,
    sourceUrl: "https://example.com",
    sourceStatus: "ok",
    productGroup: "global_etf",
    market: "US",
    strategyType,
    rowCount: tickers.length,
    rawRowCount: tickers.length,
    signature: `${etfCode}-${sourceAsOf}`,
    holdings: tickers.map((ticker) => ({
      etfCode, fundName: etfCode, issuer: "fixture", sourceAsOf, fetchedAt,
      sourceUrl: "https://example.com", sourceStatus: "ok", productGroup: "global_etf", market: "US",
      strategyType, positionKey: `ticker:${ticker}`, ticker, name: ticker
    }))
  };
}

function fakeDb(fixtures: GlobalEtfSnapshot[]): Db {
  return {
    collection: () => ({
      aggregate: (pipeline: Array<Record<string, any>>) => ({
        toArray: async () => {
          let rows: any[] = [...fixtures];
          for (const stage of pipeline) {
            if (stage.$match) {
              const match = stage.$match;
              rows = rows.filter((row) => {
                if (match.etfCode?.$in && !match.etfCode.$in.includes(row.etfCode)) return false;
                if (match.sourceStatus && row.sourceStatus !== match.sourceStatus) return false;
                if (match.strategyType === "13f" && row.strategyType !== "13f") return false;
                if (match.strategyType?.$ne === "13f" && row.strategyType === "13f") return false;
                if (match.sourceAsOf?.$regex && !new RegExp(match.sourceAsOf.$regex).test(row.sourceAsOf)) return false;
                const ticker = match.holdings?.$elemMatch?.ticker;
                return !ticker || row.holdings.some((holding: { ticker?: string }) => holding.ticker === ticker);
              });
            } else if (stage.$sort) {
              rows.sort((left, right) => {
                for (const [key, order] of Object.entries(stage.$sort as Record<string, number>)) {
                  const comparison = String(left[key]).localeCompare(String(right[key]));
                  if (comparison) return comparison * order;
                }
                return 0;
              });
            } else if (stage.$group) {
              const firstByEtf = new Map<string, GlobalEtfSnapshot>();
              for (const row of rows) if (!firstByEtf.has(row.etfCode)) firstByEtf.set(row.etfCode, row);
              rows = [...firstByEtf.entries()].map(([key, value]) => ({ _id: key, snapshot: value }));
            } else if (stage.$replaceRoot) {
              rows = rows.map((row) => row.snapshot);
            }
          }
          return rows;
        }
      })
    })
  } as unknown as Db;
}

describe("latest global stock snapshot selection", () => {
  it("groups the latest valid snapshot before filtering ticker", () => {
    const pipeline = latestSnapshotsForStockPipeline("MU", false);
    expect(pipeline.findIndex((stage) => "$group" in stage)).toBeLessThan(
      pipeline.findIndex((stage) => stage.$match && "holdings" in stage.$match)
    );
  });

  it("groups latest ETF snapshots before search unwinds and filters holdings", () => {
    const pipeline = latestStockSearchPipeline("MU", 8);
    const groupIndex = pipeline.findIndex((stage) => "$group" in stage);
    const unwindIndex = pipeline.findIndex((stage) => "$unwind" in stage);
    const holdingMatchIndex = pipeline.findIndex((stage) => stage.$match && "$or" in stage.$match);
    expect(groupIndex).toBeLessThan(unwindIndex);
    expect(groupIndex).toBeLessThan(holdingMatchIndex);
  });

  it("does not fall back to an older ETF snapshot after MU exited", async () => {
    const rows = await globalSnapshotsForStock(fakeDb([
      snapshot("DRAM", "2026-07-20", ["MU"]),
      snapshot("DRAM", "2026-07-21", ["NVDA"]),
      snapshot("HBMX", "2026-07-19", ["MU"], "active")
    ]), "MU", false);
    expect(rows.map((row) => row.etfCode)).toEqual(["HBMX"]);
  });

  it("excludes ok snapshots whose source date is not an ISO date", async () => {
    const rows = await globalSnapshotsForStock(fakeDb([
      snapshot("BAI", "Jun 23, 20", ["MU"], "active"),
      snapshot("HBMX", "2026-07-19", ["MU"], "active")
    ]), "MU", false);
    expect(rows.map((row) => row.etfCode)).toEqual(["HBMX"]);
  });

  it("applies the same no-fallback rule to 13F institutions", async () => {
    const rows = await globalSnapshotsForStock(fakeDb([
      snapshot("ARK13F", "2026-03-31", ["MU"], "13f"),
      snapshot("ARK13F", "2026-06-30", ["TSLA"], "13f"),
      snapshot("BRK13F", "2026-06-30", ["MU"], "13f")
    ]), "MU", true);
    expect(rows.map((row) => row.etfCode)).toEqual(["BRK13F"]);
  });
});

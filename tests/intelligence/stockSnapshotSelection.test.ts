import { ObjectId, type Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import type { GlobalEtfSnapshot } from "../../src/models/GlobalEtf.js";
import { latestGlobalSourceDate } from "../../src/services/intelligence/dataAccess.js";
import {
  globalSnapshotsForStock,
  globalStockHistoryPipeline,
  globalStockHistoryPoints,
  globalStockHistorySnapshots,
  latestSnapshotsForStockPipeline,
  latestStockSearchPipeline
} from "../../src/services/intelligence/stockIntelligenceService.js";

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

function weightedSnapshot(
  etfCode: string,
  sourceAsOf: string,
  weightPercent: number | null,
  fetchedAt = `${sourceAsOf}T12:00:00.000Z`
): GlobalEtfSnapshot {
  const result = snapshot(etfCode, sourceAsOf, weightPercent === null ? [] : ["MU"], "active");
  result.fetchedAt = new Date(fetchedAt);
  result.snapshotId = `${etfCode}-${sourceAsOf}-${fetchedAt}`;
  result.signature = result.snapshotId;
  if (weightPercent !== null && result.holdings[0]) result.holdings[0].weightPercent = weightPercent;
  return result;
}

function fakeDb(fixtures: GlobalEtfSnapshot[]): Db {
  const documents = fixtures.map(row => ({ ...row, _id: new ObjectId() }));
  return {
    collection: () => ({
      find: (filter: { _id: { $in: ObjectId[] }; rowCount: { $gt: number } }) => ({
        toArray: async () => documents.filter(row => filter._id.$in.some(id => id.equals(row._id)) && row.rowCount > filter.rowCount.$gt)
      }),
      aggregate: (pipeline: Array<Record<string, any>>) => ({
        toArray: async () => {
          let rows: any[] = [...documents];
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
  it("selects covered metadata before fetching and filtering ticker holdings", () => {
    const pipeline = latestSnapshotsForStockPipeline("MU", false);
    expect(pipeline[0]?.$match).not.toHaveProperty("holdings");
    expect(pipeline[0]?.$match).not.toHaveProperty("rowCount");
    expect(pipeline[0]?.$match).not.toHaveProperty("unusableReason");
    expect(pipeline.at(-1)?.$project).toHaveProperty("_id", 1);
    expect(pipeline.at(-1)?.$project).not.toHaveProperty("holdings");
  });

  it("groups latest ETF snapshots before search unwinds and filters holdings", () => {
    const pipeline = latestStockSearchPipeline("MU", 8);
    const groupIndex = pipeline.findIndex((stage) => "$group" in stage);
    const unwindIndex = pipeline.findIndex((stage) => "$unwind" in stage);
    const holdingMatchIndex = pipeline.findIndex((stage) => stage.$match && "$or" in stage.$match);
    expect(groupIndex).toBeLessThan(unwindIndex);
    expect(groupIndex).toBeLessThan(holdingMatchIndex);
    expect(pipeline[groupIndex]?.$group).toEqual({ _id: "$etfCode", snapshotId: { $first: "$_id" } });
    expect(pipeline.findIndex(stage => "$lookup" in stage)).toBeGreaterThan(groupIndex);
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

  it("skips unusable and empty captures before choosing a valid snapshot", async () => {
    const unusable = { ...snapshot("DRAM", "2026-07-23", ["NVDA"]), unusableReason: "bad source" };
    const rows = await globalSnapshotsForStock(fakeDb([
      snapshot("DRAM", "2026-07-20", ["MU"]),
      snapshot("DRAM", "2026-07-22", []),
      unusable
    ]), "MU", false);
    expect(rows.map(row => row.sourceAsOf)).toEqual(["2026-07-20"]);
  });

  it("builds US history from ISO-dated, latest-per-day ETF snapshots", () => {
    const pipeline = globalStockHistoryPipeline("MU", 20);
    const initialMatch = pipeline[0]?.$match as Record<string, any>;
    const group = pipeline.find((stage) => "$group" in stage)?.$group as Record<string, any>;
    expect(initialMatch.sourceAsOf.$regex).toBe("^\\d{4}-\\d{2}-\\d{2}$");
    expect(group._id).toEqual({ etfCode: "$etfCode", sourceAsOf: "$sourceAsOf" });
    // Historical holdings must never enter group/sort memory or disk spills.
    expect(group.snapshot.$first).toEqual({ snapshotId: "$_id", etfCode: "$etfCode", sourceAsOf: "$sourceAsOf", fetchedAt: "$fetchedAt" });
    expect(pipeline.at(-1)).toHaveProperty("$limit");
  });

  it("keeps zero holdings observations after indexed ticker hydration, so exits and unchanged zeros are preserved", async () => {
    const entry = weightedSnapshot("DRAM", "2026-07-20", 8);
    const exit = weightedSnapshot("DRAM", "2026-07-21", null);
    const unrelated = weightedSnapshot("HBMX", "2026-07-21", null);
    const fixtures = [entry, exit, unrelated].map(row => ({ ...row, _id: new ObjectId() }));
    const selected = fixtures.map(row => ({ etfCode: row.etfCode, sourceAsOf: row.sourceAsOf, fetchedAt: row.fetchedAt, snapshotId: row._id }));
    const find = vi.fn((_filter: unknown, _options: { projection: unknown }) => ({ toArray: async () => [fixtures[0]] }));
    const db = { collection: () => ({ aggregate: () => ({ toArray: async () => selected }), find }) } as unknown as Db;
    const observations = await globalStockHistorySnapshots(db, "MU", 20);
    expect(observations.map(row => row.holdings.length)).toEqual([1, 0, 0]);
    expect(globalStockHistoryPoints("MU", observations, 20)).toEqual([{
      date: "2026-07-21", weightChangePercentPoints: -8, direction: "decrease", updatedEtfCount: 1, increaseEtfCount: 0, decreaseEtfCount: 1, neutralEtfCount: 0
    }]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ _id: { $in: fixtures.map(row => row._id) }, "holdings.ticker": { $regex: "^MU$", $options: "i" } }), expect.objectContaining({ hint: "_id_" }));
    expect(find.mock.calls[0]?.[1]?.projection).toEqual({
      _id: 1,
      holdings: { $map: {
        input: { $filter: { input: "$holdings", as: "holding", cond: { $eq: [{ $toUpper: { $ifNull: ["$$holding.ticker", ""] } }, "MU"] } } },
        as: "holding", in: { ticker: "$$holding.ticker", weightPercent: "$$holding.weightPercent" }
      } }
    });
  });

  it("computes the same changes from compact mixed-case holdings and metadata-only dates", async () => {
    const first = new ObjectId(), second = new ObjectId();
    const selected = [
      { snapshotId: first, etfCode: "DRAM", sourceAsOf: "2026-07-20", fetchedAt: new Date("2026-07-20T12:00:00Z") },
      { snapshotId: second, etfCode: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: new Date("2026-07-21T12:00:00Z") }
    ];
    // Hydration no longer returns date, fund name, raw source rows or other
    // holding attributes. It still retains every matching asset's weight.
    const rows = [
      { _id: first, holdings: [{ ticker: "mU", weightPercent: 0.5 }, { ticker: "MU", weightPercent: 1.5 }] },
      { _id: second, holdings: [{ ticker: "Mu", weightPercent: 3 }] }
    ];
    const db = { collection: () => ({
      aggregate: () => ({ toArray: async () => selected }),
      find: () => ({ toArray: async () => rows })
    }) } as unknown as Db;
    const observations = await globalStockHistorySnapshots(db, "MU", 20);
    expect(observations.map(row => row.sourceAsOf)).toEqual(["2026-07-20", "2026-07-21"]);
    expect(globalStockHistoryPoints("MU", observations, 20)).toEqual([{
      date: "2026-07-21", weightChangePercentPoints: 1, direction: "increase", updatedEtfCount: 1, increaseEtfCount: 1, decreaseEtfCount: 0, neutralEtfCount: 0
    }]);
  });

  it("skips hydration when metadata selection contains no eligible history", async () => {
    const find = vi.fn();
    const db = { collection: () => ({ aggregate: () => ({ toArray: async () => [] }), find }) } as unknown as Db;
    expect(await globalStockHistorySnapshots(db, "MU", 20, "2000-01-01")).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it("deduplicates captures and reports weight change points including exits", () => {
    const points = globalStockHistoryPoints("MU", [
      weightedSnapshot("DRAM", "2026-07-20", 7.5, "2026-07-20T08:00:00.000Z"),
      weightedSnapshot("DRAM", "2026-07-20", 8, "2026-07-20T12:00:00.000Z"),
      weightedSnapshot("DRAM", "2026-07-21", 8.4),
      weightedSnapshot("HBMX", "2026-07-19", 2),
      weightedSnapshot("HBMX", "2026-07-21", null),
      weightedSnapshot("BAI", "Jun 23, 20", 4, "2026-07-21T12:00:00.000Z")
    ], 20);

    expect(points).toEqual([
      {
        date: "2026-07-21",
        weightChangePercentPoints: -1.6,
        direction: "decrease",
        updatedEtfCount: 2,
        increaseEtfCount: 1,
        decreaseEtfCount: 1,
        neutralEtfCount: 0
      }
    ]);
  });

  it("does not invent a direction without a prior comparable snapshot", () => {
    expect(globalStockHistoryPoints("MU", [
      weightedSnapshot("DRAM", "2026-07-21", 8.4)
    ], 20)).toEqual([]);
  });

  it("never selects a malformed date as the latest global source date", async () => {
    const findOne = vi.fn(async () => ({ sourceAsOf: "2026-07-21" }));
    const db = { collection: () => ({ findOne }) } as unknown as Db;

    await latestGlobalSourceDate(db);

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } }),
      expect.any(Object)
    );
  });
});

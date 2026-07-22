import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";
import type { GlobalEtfSnapshot } from "../../src/models/GlobalEtf.js";
import {
  GLOBAL_WEIGHT_CHANGE_THRESHOLD_PP,
  buildGlobalWeightHistory,
  globalStockHistoryPipeline,
  stockHistory
} from "../../src/services/intelligence/stockIntelligenceService.js";

function snapshot(etfCode: string, sourceAsOf: string, fetchedAt: string, holdings: Array<{ ticker: string; weightPercent?: number }>): GlobalEtfSnapshot {
  const fetched = new Date(fetchedAt);
  return {
    snapshotId: `${etfCode}-${sourceAsOf}-${fetchedAt}`,
    etfCode,
    fundName: etfCode,
    issuer: "fixture",
    sourceAsOf,
    fetchedAt: fetched,
    sourceUrl: "https://example.com",
    sourceStatus: "ok",
    productGroup: "global_etf",
    market: "US",
    strategyType: etfCode === "HBMX" ? "active" : "index",
    rowCount: holdings.length,
    rawRowCount: holdings.length,
    signature: `${etfCode}-${sourceAsOf}-${fetchedAt}`,
    holdings: holdings.map((holding) => ({
      etfCode,
      fundName: etfCode,
      issuer: "fixture",
      sourceAsOf,
      fetchedAt: fetched,
      sourceUrl: "https://example.com",
      sourceStatus: "ok",
      productGroup: "global_etf",
      market: "US",
      strategyType: etfCode === "HBMX" ? "active" : "index",
      positionKey: `ticker:${holding.ticker}`,
      ticker: holding.ticker,
      name: holding.ticker,
      weightPercent: holding.weightPercent
    }))
  };
}

function aggregateHistory(fixtures: GlobalEtfSnapshot[], pipeline: Array<Record<string, any>>) {
  const match = pipeline[0]?.$match;
  const limit = pipeline.find((stage) => stage.$limit)?.$limit ?? 20;
  const symbol = pipeline
    .find((stage) => stage.$project?.matchingHoldings)
    ?.$project.matchingHoldings.$filter.cond.$eq[1];
  const sourceDateLimit = match.sourceAsOf.$lte as string | undefined;
  const eligible = fixtures
    .filter((row) => match.etfCode.$in.includes(row.etfCode))
    .filter((row) => row.strategyType !== "13f" && row.sourceStatus === "ok")
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/u.test(row.sourceAsOf))
    .filter((row) => !sourceDateLimit || row.sourceAsOf <= sourceDateLimit)
    .sort((left, right) => right.sourceAsOf.localeCompare(left.sourceAsOf) || right.fetchedAt.getTime() - left.fetchedAt.getTime());

  const latestByEtfDate = new Map<string, GlobalEtfSnapshot>();
  for (const row of eligible) {
    const key = `${row.etfCode}|${row.sourceAsOf}`;
    if (!latestByEtfDate.has(key)) latestByEtfDate.set(key, row);
  }

  const byDate = new Map<string, { weights: number[]; etfCodes: Set<string> }>();
  for (const row of latestByEtfDate.values()) {
    const matching = row.holdings.filter((holding) => holding.ticker?.toUpperCase() === symbol);
    if (!matching.length) continue;
    const aggregate = byDate.get(row.sourceAsOf) ?? { weights: [], etfCodes: new Set<string>() };
    aggregate.weights.push(...matching.map((holding) => holding.weightPercent).filter((value): value is number => typeof value === "number"));
    aggregate.etfCodes.add(row.etfCode);
    byDate.set(row.sourceAsOf, aggregate);
  }

  return [...byDate.entries()]
    .map(([date, aggregate]) => ({
      date,
      totalWeightPercent: aggregate.weights.length ? aggregate.weights.reduce((sum, value) => sum + value, 0) : null,
      etfCount: aggregate.etfCodes.size
    }))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);
}

function fakeDb(fixtures: GlobalEtfSnapshot[]): Db {
  return {
    collection: () => ({
      aggregate: (pipeline: Array<Record<string, any>>) => ({ toArray: async () => aggregateHistory(fixtures, pipeline) }),
      distinct: async (_field: string, filter: Record<string, any>) => [...new Set(fixtures
        .filter((row) => !filter.sourceAsOf || row.sourceAsOf === filter.sourceAsOf)
        .map((row) => row.etfCode))]
    })
  } as unknown as Db;
}

describe("global stock history", () => {
  it("deduplicates each ETF and ISO source date before ticker filtering and daily grouping", () => {
    const pipeline = globalStockHistoryPipeline("MU", 20, "2026-07-20") as Array<Record<string, any>>;
    expect(pipeline[0]?.$match.sourceAsOf).toEqual({ $regex: "^\\d{4}-\\d{2}-\\d{2}$", $lte: "2026-07-20" });
    expect(pipeline[2]?.$group).toMatchObject({
      _id: { etfCode: "$etfCode", sourceAsOf: "$sourceAsOf" },
      snapshot: { $first: "$$ROOT" }
    });
    expect(pipeline.findIndex((stage) => stage.$group?._id?.etfCode)).toBeLessThan(
      pipeline.findIndex((stage) => stage.$project?.matchingHoldings)
    );
    expect(pipeline.find((stage) => stage.$group?.etfCodes)?.$group.etfCodes).toEqual({ $addToSet: "$etfCode" });
  });

  it("uses only the newest same-day fetch, excludes non-ISO dates, and counts unique ETFs", async () => {
    const result = await stockHistory(fakeDb([
      snapshot("DRAM", "2026-07-20", "2026-07-20T10:00:00.000Z", [{ ticker: "MU", weightPercent: 15 }]),
      snapshot("DRAM", "2026-07-20", "2026-07-20T12:00:00.000Z", [{ ticker: "MU", weightPercent: 14 }]),
      snapshot("HBMX", "2026-07-20", "2026-07-20T11:00:00.000Z", [{ ticker: "MU", weightPercent: 6 }]),
      snapshot("DRAM", "2026-07-19", "2026-07-19T12:00:00.000Z", [{ ticker: "MU", weightPercent: 13 }]),
      snapshot("HBMX", "Jun 23, 20", "2026-07-20T11:00:00.000Z", [{ ticker: "MU", weightPercent: 99 }])
    ]), "us", "mu", 20);

    expect(result.points).toEqual([
      { date: "2026-07-20", totalWeightPercent: 20, etfCount: 2, weightChangePoint: 7, direction: "increase" },
      { date: "2026-07-19", totalWeightPercent: 13, etfCount: 1, weightChangePoint: null, direction: "unknown" }
    ]);
    expect(result.summary).toEqual({
      latestTotalWeightPercent: 20,
      periodWeightChangePoint: 7,
      increaseObservationDays: 1,
      decreaseObservationDays: 0,
      neutralObservationDays: 0,
      actualObservationCount: 2
    });
  });

  it("does not invent direction from floating-point noise", () => {
    const result = buildGlobalWeightHistory([
      { date: "2026-07-21", totalWeightPercent: 12 + GLOBAL_WEIGHT_CHANGE_THRESHOLD_PP / 2, etfCount: 1 },
      { date: "2026-07-20", totalWeightPercent: 12, etfCount: 1 }
    ]);
    expect(result.points[0]).toMatchObject({ direction: "neutral" });
    expect(result.summary.neutralObservationDays).toBe(1);
  });
});

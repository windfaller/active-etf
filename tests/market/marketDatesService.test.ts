import { describe, expect, it, vi } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { effectiveTaiwanDates } from "../../src/services/intelligence/dataAccess.js";
import {
  availableMarketDates,
  marketDateOverview,
  safeMarketDateLimit,
  selectRecommendedMarketDate
} from "../../src/services/market/marketDatesService.js";

describe("market date service", () => {
  it("clamps date limits", () => {
    expect(safeMarketDateLimit(0)).toBe(180);
    expect(safeMarketDateLimit(500)).toBe(365);
    expect(safeMarketDateLimit(12.8)).toBe(12);
  });

  it("queries cross-ETF holding changes instead of a fixed ETF", async () => {
    const distinct = vi.fn().mockResolvedValue(["2026-07-21", "2026-07-20"]);
    const collection = vi.fn().mockReturnValue({ distinct });
    const dates = await availableMarketDates({ collection } as never, 180);

    expect(dates).toEqual(["2026-07-21", "2026-07-20"]);
    expect(collection).toHaveBeenCalledWith("etf_holding_changes");
    expect(distinct).toHaveBeenCalledWith("tradeDate", {
      etfCode: { $in: configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode) }
    }, { maxTimeMS: 10_000 });
  });

  it("recommends the newest date that reaches 70% same-date coverage", async () => {
    const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
    const dateRows = [{ _id: "2026-07-21" }, { _id: "2026-07-20" }, { _id: "2026-07-17" }];
    const summaryRows = [
      ...enabledCodes.slice(0, 4).map((etfCode) => ({ etfCode, tradeDate: "2026-07-21" })),
      ...enabledCodes.slice(0, 22).map((etfCode) => ({ etfCode, tradeDate: "2026-07-20" })),
      ...enabledCodes.map((etfCode) => ({ etfCode, tradeDate: "2026-07-17" }))
    ];
    const collection = vi.fn((name: string) => name === "etf_holding_changes"
      ? { distinct: vi.fn().mockResolvedValue(dateRows.map((row) => row._id)) }
      : { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(summaryRows) }) });

    const overview = await marketDateOverview({ collection } as never, 180);

    expect(overview.recommendedDate).toBe("2026-07-20");
    expect(overview.coverage.map((row) => [row.date, row.availableCount])).toEqual([
      ["2026-07-21", 4],
      ["2026-07-20", 22],
      ["2026-07-17", enabledCodes.length]
    ]);
  });

  it("falls back to the highest-coverage recent date when none reaches the threshold", () => {
    expect(selectRecommendedMarketDate([
      { date: "2026-07-21", availableCount: 18, trackedCount: 28, coverageRate: 18 / 28 },
      { date: "2026-07-20", availableCount: 19, trackedCount: 28, coverageRate: 19 / 28 }
    ])).toBe("2026-07-20");
  });

  it("accepts exactly 70% coverage", () => {
    expect(selectRecommendedMarketDate([
      { date: "2026-07-21", availableCount: 7, trackedCount: 10, coverageRate: 0.7 },
      { date: "2026-07-20", availableCount: 10, trackedCount: 10, coverageRate: 1 }
    ])).toBe("2026-07-21");
  });

  it("anchors intelligence windows to the newest sufficiently covered date", async () => {
    const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
    const dateRows = [{ _id: "2026-07-22" }, { _id: "2026-07-21" }, { _id: "2026-07-20" }, { _id: "2026-07-17" }];
    const summaryRows = [
      ...enabledCodes.slice(0, 1).map((etfCode) => ({ etfCode, tradeDate: "2026-07-22" })),
      ...enabledCodes.slice(0, 14).map((etfCode) => ({ etfCode, tradeDate: "2026-07-21" })),
      ...enabledCodes.slice(0, 25).map((etfCode) => ({ etfCode, tradeDate: "2026-07-20" }))
    ];
    const collection = vi.fn((name: string) => name === "etf_holding_changes"
      ? { distinct: vi.fn().mockResolvedValue(dateRows.map((row) => row._id)) }
      : { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(summaryRows) }) });

    const dates = await effectiveTaiwanDates({ collection } as never, undefined, 3);

    expect(dates).toEqual(["2026-07-20", "2026-07-17"]);
  });

  it("preserves the date shape, descending order and limit after the indexed distinct read", async () => {
    const distinct = vi.fn().mockResolvedValue(["2026-07-17", null, "junk", "2026-07-21", "2026-07-20", "2026-7-1"]);
    expect(await availableMarketDates({ collection: () => ({ distinct }) } as never, 2)).toEqual(["2026-07-21", "2026-07-20"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
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
    const toArray = vi.fn().mockResolvedValue([{ _id: "2026-07-21" }, { _id: "2026-07-20" }]);
    const aggregate = vi.fn().mockReturnValue({ toArray });
    const collection = vi.fn().mockReturnValue({ aggregate });
    const dates = await availableMarketDates({ collection } as never, 180);

    expect(dates).toEqual(["2026-07-21", "2026-07-20"]);
    expect(collection).toHaveBeenCalledWith("etf_holding_changes");
    const pipeline = aggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(JSON.stringify(pipeline)).toContain("tradeDate");
    expect(JSON.stringify(pipeline)).not.toContain('"etfCode":"00981A"');
  });

  it("recommends the newest date that reaches 90% same-date coverage", async () => {
    const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
    const dateRows = [{ _id: "2026-07-21" }, { _id: "2026-07-20" }, { _id: "2026-07-17" }];
    const summaryRows = [
      ...enabledCodes.slice(0, 4).map((etfCode) => ({ etfCode, tradeDate: "2026-07-21" })),
      ...enabledCodes.slice(0, 22).map((etfCode) => ({ etfCode, tradeDate: "2026-07-20" })),
      ...enabledCodes.map((etfCode) => ({ etfCode, tradeDate: "2026-07-17" }))
    ];
    const collection = vi.fn((name: string) => name === "etf_holding_changes"
      ? { aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(dateRows) }) }
      : { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(summaryRows) }) });

    const overview = await marketDateOverview({ collection } as never, 180);

    expect(overview.recommendedDate).toBe("2026-07-17");
    expect(overview.coverage.map((row) => [row.date, row.availableCount])).toEqual([
      ["2026-07-21", 4],
      ["2026-07-20", 22],
      ["2026-07-17", 28]
    ]);
  });

  it("falls back to the highest-coverage recent date when none reaches the threshold", () => {
    expect(selectRecommendedMarketDate([
      { date: "2026-07-21", availableCount: 4, trackedCount: 28, coverageRate: 4 / 28 },
      { date: "2026-07-20", availableCount: 22, trackedCount: 28, coverageRate: 22 / 28 }
    ])).toBe("2026-07-20");
  });
});

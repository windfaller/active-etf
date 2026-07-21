import { describe, expect, it, vi } from "vitest";
import { availableMarketDates, safeMarketDateLimit } from "../../src/services/market/marketDatesService.js";

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
});

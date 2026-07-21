import type { HttpRequest, InvocationContext } from "@azure/functions";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dateToArray = vi.fn().mockResolvedValue([{ _id: "2026-07-21" }, { _id: "2026-07-20" }]);
  const summaryToArray = vi.fn().mockResolvedValue([
    ...Array.from({ length: 4 }, (_, index) => ({ etfCode: `ETF${index}`, tradeDate: "2026-07-21" })),
    ...Array.from({ length: 22 }, (_, index) => ({ etfCode: `ETF${index}`, tradeDate: "2026-07-20" }))
  ]);
  const aggregate = vi.fn().mockReturnValue({ toArray: dateToArray });
  const find = vi.fn().mockReturnValue({ toArray: summaryToArray });
  const collection = vi.fn((name: string) => name === "etf_holding_changes" ? { aggregate } : { find });
  return { dateToArray, summaryToArray, aggregate, find, collection, getDb: vi.fn(async () => ({ collection })) };
});

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/cache/dailyDataCache.js", () => ({
  getOrSetDailyCache: vi.fn(async (_key: unknown, loader: () => Promise<unknown>) => loader())
}));

import { getMarketDates } from "../../src/api/getMarketDates.js";

function request(query: string): HttpRequest {
  return { query: new URLSearchParams(query) } as unknown as HttpRequest;
}

describe("GET /api/market/dates", () => {
  it("returns newest cross-ETF dates", async () => {
    const response = await getMarketDates(request("limit=2"), {} as InvocationContext);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      dates: ["2026-07-21", "2026-07-20"],
      recommendedDate: "2026-07-20",
      coverage: [
        { date: "2026-07-21", availableCount: 4 },
        { date: "2026-07-20", availableCount: 22 }
      ]
    });
    expect(mocks.collection).toHaveBeenCalledWith("etf_holding_changes");
    expect(mocks.collection).toHaveBeenCalledWith("etf_daily_summary");
  });

  it("rejects a non-numeric limit", async () => {
    const response = await getMarketDates(request("limit=abc"), {} as InvocationContext);
    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual({ error: "numeric limit is required" });
  });
});

import type { HttpRequest, InvocationContext } from "@azure/functions";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const toArray = vi.fn().mockResolvedValue([{ _id: "2026-07-21" }, { _id: "2026-07-20" }]);
  const aggregate = vi.fn().mockReturnValue({ toArray });
  const collection = vi.fn().mockReturnValue({ aggregate });
  return { toArray, aggregate, collection, getDb: vi.fn(async () => ({ collection })) };
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
    expect(response.jsonBody).toEqual({ dates: ["2026-07-21", "2026-07-20"] });
    expect(mocks.collection).toHaveBeenCalledWith("etf_holding_changes");
  });

  it("rejects a non-numeric limit", async () => {
    const response = await getMarketDates(request("limit=abc"), {} as InvocationContext);
    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual({ error: "numeric limit is required" });
  });
});

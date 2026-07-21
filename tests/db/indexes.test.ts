import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { ensureP1IntelligenceIndexes } from "../../src/db/indexes.js";

describe("P1 intelligence indexes", () => {
  it("creates exactly the three bounded query indexes", async () => {
    const holdingsCreateIndex = vi.fn(async () => "holdings_stock_history");
    const globalCreateIndex = vi.fn(async () => "global_index");
    const db = {
      collection: vi.fn((name: string) => ({
        createIndex: name === "etf_daily_holdings" ? holdingsCreateIndex : globalCreateIndex
      }))
    } as unknown as Db;

    const names = await ensureP1IntelligenceIndexes(db);

    expect(db.collection).toHaveBeenCalledTimes(3);
    expect(holdingsCreateIndex).toHaveBeenCalledWith({ stockId: 1, tradeDate: -1, etfCode: 1 });
    expect(globalCreateIndex).toHaveBeenNthCalledWith(1, { etfCode: 1, sourceAsOf: -1, fetchedAt: -1 });
    expect(globalCreateIndex).toHaveBeenNthCalledWith(2, { "holdings.ticker": 1, sourceAsOf: -1, etfCode: 1 });
    expect(names).toHaveLength(3);
  });
});

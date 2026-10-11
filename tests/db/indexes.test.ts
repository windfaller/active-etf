import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { ensureP1IntelligenceIndexes, ensureReadCacheIndexes } from "../../src/db/indexes.js";

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

describe("read/cache index migration", () => {
  it("builds the read indexes sequentially without unique or drop operations", async () => {
    let activeBuilds = 0;
    let maximumBuilds = 0;
    const builds: Array<{ collection: string; keys: unknown; options: unknown }> = [];
    const db = { collection: (collection: string) => ({
      createIndex: async (keys: unknown, options?: unknown) => {
        activeBuilds++;
        maximumBuilds = Math.max(maximumBuilds, activeBuilds);
        await Promise.resolve();
        builds.push({ collection, keys, options });
        activeBuilds--;
        return collection;
      }
    }) } as unknown as Db;

    await ensureReadCacheIndexes(db);
    expect(maximumBuilds).toBe(1);
    expect(builds).toEqual([
      { collection: "global_etf_holding_changes", keys: { etfCode: 1, sourceAsOf: 1 }, options: undefined },
      { collection: "global_etf_raw_snapshots", keys: { snapshotId: 1 }, options: undefined },
      { collection: "etf_daily_holdings", keys: { tradeDate: -1, stockId: 1 }, options: undefined },
      { collection: "global_etf_snapshots", keys: { etfCode: 1, sourceAsOf: -1, fetchedAt: -1, strategyType: 1, filedAt: 1, unusableReason: 1, sourceStatus: 1, _id: 1 }, options: { name: "global_snapshot_read_metadata" } }
    ]);
  });
});

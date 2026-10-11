import type { Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { globalSearch } from "../../src/services/intelligence/searchService.js";
import { searchStocks } from "../../src/services/intelligence/stockIntelligenceService.js";

function mixedProfileDb() {
  const profiles = [
    { stockId: "MU", stockName: "Micron Technology", sector: "Semiconductors" },
    { stockId: "6666", stockName: "Micron Taiwan fixture", sector: "Semiconductors" }
  ];
  const find = vi.fn((filter, options) => ({
    toArray: async () => profiles.filter(profile => {
      if (filter.stockId && !new RegExp(filter.stockId.$regex).test(profile.stockId)) return false;
      return filter.$or.some((clause: Record<string, { $regex: string; $options: string }>) =>
        Object.entries(clause).some(([field, pattern]) =>
          new RegExp(pattern.$regex, pattern.$options).test(profile[field as "stockId" | "stockName"])));
    }).slice(0, options.limit)
  }));
  const aggregate = vi.fn(() => ({ toArray: async () => [{ ticker: "MU", name: "Micron Technology Inc", sourceAsOf: "2026-10-09" }] }));
  const db = { collection: (name: string) => {
    if (name === "stock_sector_profiles") return { find };
    if (name === "global_etf_snapshots") return { aggregate };
    throw new Error(`Unexpected collection ${name}`);
  } } as unknown as Db;
  return { db, find, aggregate };
}

describe("stock search market boundaries", () => {
  it("excludes overseas identifiers from Taiwan results before applying the limit", async () => {
    const { db, aggregate } = mixedProfileDb();
    const result = await searchStocks(db, "Micron", "tw", 1);
    expect(result.results).toEqual([expect.objectContaining({ market: "tw", symbol: "6666", path: "/stocks/tw/6666" })]);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("keeps valid Taiwan and US stocks in their own routes when both markets are requested", async () => {
    const { db } = mixedProfileDb();
    const result = await searchStocks(db, "Micron", undefined, 2);
    expect(result.results.map(row => row.path)).toEqual(["/stocks/tw/6666", "/stocks/us/MU"]);
  });

  it("does not let Taiwan hits consume the limit of a US-only global search", async () => {
    const { db, find } = mixedProfileDb();
    const result = await globalSearch(db, "Micron", ["us_stock"], 1);
    expect(result.results).toEqual([expect.objectContaining({ type: "us_stock", code: "MU", path: "/stocks/us/MU" })]);
    expect(find).not.toHaveBeenCalled();
  });
});

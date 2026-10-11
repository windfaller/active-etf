import { describe, expect, it, vi } from "vitest";
import { advanceDataCacheGeneration, dataCacheScopes, getDataCacheGeneration } from "../../src/services/cache/dataCacheVersion.js";

describe("authoritative cache generations", () => {
  it("isolates Taiwan and global data while tracking both dependencies for performance", () => {
    expect(dataCacheScopes(["global-etfs", "daily-report"])).toEqual(["global"]);
    expect(dataCacheScopes(["api", "compare", "v1", "global"])).toEqual(["global"]);
    expect(dataCacheScopes(["api", "fund-performance"])).toEqual(["tw", "global"]);
    expect(dataCacheScopes(["api", "stocks", "v1", "us", "history"])).toEqual(["global"]);
    expect(dataCacheScopes(["api", "stocks", "v1", "tw", "history"])).toEqual(["tw"]);
    expect(dataCacheScopes(["api", "stocks", "v1", "all", "search"])).toEqual(["tw", "global"]);
    expect(dataCacheScopes(["mcp", "research"])).toEqual(["tw", "global"]);
    expect(dataCacheScopes(["dashboard", "v2", "00981A"])).toEqual(["tw"]);
  });

  it("reads a primary pointer and persists invalidations even when Redis is unavailable", async () => {
    const rows = new Map<string, { _id: string; version: string }>();
    const updateOne = vi.fn(async (filter, update) => { rows.set(filter._id, { _id: filter._id, version: update.$set.version }); });
    const findOne = vi.fn(async (filter) => rows.get(filter._id) ?? null);
    const db = { collection: vi.fn(() => ({ updateOne, findOne })) } as never;
    expect(await getDataCacheGeneration(["dashboard"], db)).toBe("tw.initial");
    await advanceDataCacheGeneration("tw", db);
    const first = await getDataCacheGeneration(["dashboard"], db);
    await advanceDataCacheGeneration("tw", db);
    expect(await getDataCacheGeneration(["dashboard"], db)).not.toBe(first);
    expect(updateOne).toHaveBeenCalledWith({ _id: "tw" }, expect.anything(), { upsert: true, writeConcern: { w: "majority" } });
    expect(findOne).toHaveBeenCalledWith({ _id: "tw" }, expect.objectContaining({ readPreference: "primary", readConcern: { level: "majority" } }));
  });

  it("changes a combined cache key when either source changes", async () => {
    let version = "global.first";
    const db = { collection: () => ({ find: () => ({ toArray: async () => [{ _id: "tw", version: "tw.first" }, { _id: "global", version }] }) }) } as never;
    const first = await getDataCacheGeneration(["api", "fund-performance"], db);
    version = "global.second";
    expect(await getDataCacheGeneration(["api", "fund-performance"], db)).not.toBe(first);
    expect(await getDataCacheGeneration(["mcp", "research"], db)).not.toBe(first);
    expect(await getDataCacheGeneration(["api", "stocks", "v1", "all", "search"], db)).not.toBe(first);
  });

  it("does not hide a failed committed invalidation", async () => {
    const db = { collection: () => ({ updateOne: async () => { throw new Error("write failed"); } }) } as never;
    await expect(advanceDataCacheGeneration("global", db)).rejects.toThrow("write failed");
  });
});

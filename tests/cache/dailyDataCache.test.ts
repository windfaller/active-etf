import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRedisConfigured: vi.fn(() => true),
  redisGet: vi.fn(),
  redisSetEx: vi.fn(),
  redisDel: vi.fn(),
  getDataCacheGeneration: vi.fn(async () => "tw.first"),
  advanceDataCacheGeneration: vi.fn(async (_scope: string) => {})
}));

vi.mock("../../src/services/cache/redisClient.js", () => mocks);

vi.mock("../../src/services/cache/dataCacheVersion.js", () => ({ getDataCacheGeneration: mocks.getDataCacheGeneration, advanceDataCacheGeneration: mocks.advanceDataCacheGeneration }));

import { dailyCacheKey, getOrSetDailyCache, invalidateDailyCache, invalidateGlobalEtfCache } from "../../src/services/cache/dailyDataCache.js";

describe("dailyDataCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRedisConfigured.mockReturnValue(true);
    mocks.getDataCacheGeneration.mockResolvedValue("tw.first");
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSetEx.mockResolvedValue(undefined);
  });

  it("reports and returns a shared Redis hit", async () => {
    mocks.redisGet.mockResolvedValueOnce(JSON.stringify({ cached: true }));
    const loader = vi.fn();
    const statuses: string[] = [];

    const result = await getOrSetDailyCache(
      ["api", "signals", "v1", 20, "latest"],
      loader,
      600,
      (status) => statuses.push(status)
    );

    expect(result).toEqual({ cached: true });
    expect(loader).not.toHaveBeenCalled();
    expect(statuses).toEqual(["hit"]);
  });

  it("stores a shared Redis miss with the requested TTL", async () => {
    mocks.redisGet.mockResolvedValueOnce(null);
    const statuses: string[] = [];

    const result = await getOrSetDailyCache(
      ["api", "compare", "v1", "tw", "00981A,00982A", "latest"],
      async () => ({ cards: [] }),
      600,
      (status) => statuses.push(status)
    );

    expect(result).toEqual({ cards: [] });
    expect(mocks.redisSetEx).toHaveBeenCalledWith(
      dailyCacheKey(["api", "compare", "v1", "tw", "00981A,00982A", "latest", "generation", "tw.first"]),
      600,
      JSON.stringify({ cards: [] })
    );
    expect(statuses).toEqual(["miss"]);
  });

  it("bypasses Redis cleanly when it is not configured", async () => {
    mocks.isRedisConfigured.mockReturnValueOnce(false);
    const statuses: string[] = [];

    const result = await getOrSetDailyCache(
      ["api", "signals", "v1", 20, "latest"],
      async () => ({ direct: true }),
      600,
      (status) => statuses.push(status)
    );

    expect(result).toEqual({ direct: true });
    expect(mocks.redisGet).not.toHaveBeenCalled();
    expect(statuses).toEqual(["bypass"]);
  });

  it("falls back to the loader and repairs the entry after a Redis read error", async () => {
    mocks.redisGet.mockRejectedValueOnce(new Error("temporary read failure"));
    const statuses: string[] = [];

    const result = await getOrSetDailyCache(
      ["api", "style", "v1", "00981A", 20, "latest"],
      async () => ({ repaired: true }),
      600,
      (status) => statuses.push(status)
    );

    expect(result).toEqual({ repaired: true });
    expect(mocks.redisSetEx).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["error"]);
  });

  it("coalesces five simultaneous same-key misses into one loader and one Redis read", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const loader = vi.fn(async () => { await gate; return { value: 1 }; });
    const requests = Array.from({ length: 5 }, () => getOrSetDailyCache(["concurrent"], loader));
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    release();
    expect(await Promise.all(requests)).toEqual(Array.from({ length: 5 }, () => ({ value: 1 })));
    expect(mocks.redisGet).toHaveBeenCalledTimes(1);
    expect(mocks.redisSetEx).toHaveBeenCalledTimes(1);
  });

  it("does not let an old in-flight loader overwrite the generation read after invalidation", async () => {
    const values = new Map<string, string>();
    mocks.redisGet.mockImplementation(async (key: string) => values.get(key) ?? null);
    mocks.redisSetEx.mockImplementation(async (key: string, _ttl: number, value: string) => { values.set(key, value); });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const oldLoader = vi.fn(async () => { await gate; return "old"; });
    const parts = ["etf", "00981A", "holdings", "2026-10-08"];
    const oldRequest = getOrSetDailyCache(parts, oldLoader);
    await vi.waitFor(() => expect(oldLoader).toHaveBeenCalledTimes(1));
    await invalidateDailyCache("00981A", "2026-10-08");
    mocks.getDataCacheGeneration.mockResolvedValue("tw.second");
    expect(await getOrSetDailyCache(parts, async () => "new")).toBe("new");
    release();
    expect(await oldRequest).toBe("old");
    expect(await getOrSetDailyCache(parts, async () => "wrong")).toBe("new");
  });

  it("invalidates during Redis cooldown and preserves the global version separately", async () => {
    mocks.isRedisConfigured.mockReturnValue(false);
    await invalidateDailyCache("00981A", "2026-10-08");
    await invalidateGlobalEtfCache();
    expect(mocks.advanceDataCacheGeneration.mock.calls.map((call) => call[0])).toEqual(["tw", "global"]);
  });

  it("invalidates latest coverage, custom limits and other funds' dashboards together", async () => {
    const values = new Map<string, string>();
    mocks.redisGet.mockImplementation(async (key: string) => values.get(key) ?? null);
    mocks.redisSetEx.mockImplementation(async (key: string, _ttl: number, value: string) => { values.set(key, value); });
    const keys = [
      ["etfs", "coverage", "latest"],
      ["market", "dates", "v3", 15],
      ["dashboard", "v2", "00981A", "2026-10-08"],
      ["etf", "00981A", "summary-history", 15]
    ];
    for (const key of keys) await getOrSetDailyCache(key, async () => "old");
    await invalidateDailyCache("00982A", "2026-10-08");
    mocks.getDataCacheGeneration.mockResolvedValue("tw.second");
    for (const key of keys) expect(await getOrSetDailyCache(key, async () => "new")).toBe("new");
    expect(mocks.advanceDataCacheGeneration).toHaveBeenCalledTimes(1);
  });

  it("keeps remote generations separate during Redis cooldown", async () => {
    mocks.isRedisConfigured.mockReturnValue(false);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const oldLoader = vi.fn(async () => { await gate; return "old"; });
    const oldRequest = getOrSetDailyCache(["cooldown-race"], oldLoader, 600, undefined, "tw.first");
    await vi.waitFor(() => expect(oldLoader).toHaveBeenCalledTimes(1));
    const newLoader = vi.fn(async () => "new");
    expect(await getOrSetDailyCache(["cooldown-race"], newLoader, 600, undefined, "tw.second")).toBe("new");
    expect(newLoader).toHaveBeenCalledWith("tw.second");
    release();
    expect(await oldRequest).toBe("old");
  });

  it("does not read or populate Redis when the authoritative version is unavailable", async () => {
    mocks.getDataCacheGeneration.mockRejectedValueOnce(new Error("version unavailable"));
    expect(await getOrSetDailyCache(["version-failure"], async () => "direct")).toBe("direct");
    expect(mocks.redisGet).not.toHaveBeenCalled();
    expect(mocks.redisSetEx).not.toHaveBeenCalled();
  });

  it("removes failed pending loads so the next request can retry", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce("recovered");
    await expect(getOrSetDailyCache(["retry"], loader)).rejects.toThrow("failed");
    expect(await getOrSetDailyCache(["retry"], loader)).toBe("recovered");
  });

  it("keeps punctuation-distinct request keys separate", () => {
    expect(dailyCacheKey(["compare", "A,B"])).not.toBe(dailyCacheKey(["compare", "A_B"]));
  });
});

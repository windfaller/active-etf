import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoundedRequestCache } from "../../src/services/cache/boundedRequestCache.js";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  getOrSetDailyCache: vi.fn(),
  getDataCacheGeneration: vi.fn(async () => "tw.first")
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/cache/dailyDataCache.js", () => ({
  getOrSetDailyCache: mocks.getOrSetDailyCache
}));

vi.mock("../../src/services/cache/dataCacheVersion.js", () => ({ getDataCacheGeneration: mocks.getDataCacheGeneration }));

import { getTimedCached } from "../../src/api/timedRequestCache.js";

describe("getTimedCached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDataCacheGeneration.mockResolvedValue("tw.first");
  });

  it("serves a shared Redis hit without loading report data", async () => {
    mocks.getOrSetDailyCache.mockImplementationOnce(async (
      _parts: unknown,
      _loader: unknown,
      _ttl: unknown,
      onStatus: (status: string) => void
    ) => {
      onStatus("hit");
      return { sourceAsOf: "2026-07-23" };
    });
    const loader = vi.fn();

    const result = await getTimedCached(
      new BoundedRequestCache(),
      "signals",
      180_000,
      loader,
      {
        sharedCacheKey: ["api", "signals", "v1", 20, "latest"],
        sharedCacheTtlSeconds: 600
      }
    );

    expect(result.value).toEqual({ sourceAsOf: "2026-07-23" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
    expect(result.metrics).toContainEqual({ name: "shared-cache", description: "hit" });
  });

  it("loads from MongoDB when no shared cache is requested", async () => {
    const loader = vi.fn(async () => ({ ok: true }));

    const result = await getTimedCached(
      new BoundedRequestCache(),
      "uncached",
      60_000,
      loader
    );

    expect(result.value).toEqual({ ok: true });
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith({ name: "db" });
    expect(result.metrics.some((metric) => metric.name === "shared-cache")).toBe(false);
  });

  it("rechecks the committed generation before a local cache hit", async () => {
    const cache = new BoundedRequestCache();
    const options = { sharedCacheKey: ["api", "signals", "latest"], sharedCacheTtlSeconds: 600 };
    mocks.getOrSetDailyCache.mockResolvedValueOnce("old").mockResolvedValueOnce("new");
    expect((await getTimedCached(cache, "same-key", 60_000, vi.fn(), options)).value).toBe("old");
    mocks.getDataCacheGeneration.mockResolvedValue("tw.second");
    expect((await getTimedCached(cache, "same-key", 60_000, vi.fn(), options)).value).toBe("new");
    expect(mocks.getOrSetDailyCache).toHaveBeenCalledTimes(2);
  });

  it("bypasses an existing L1 value when generation lookup fails", async () => {
    const cache = new BoundedRequestCache();
    const options = { sharedCacheKey: ["api", "signals", "latest"], sharedCacheTtlSeconds: 600 };
    mocks.getOrSetDailyCache.mockResolvedValueOnce("old");
    await getTimedCached(cache, "same-key", 60_000, vi.fn(), options);
    mocks.getDataCacheGeneration.mockRejectedValueOnce(new Error("offline"));
    const result = await getTimedCached(cache, "same-key", 60_000, async () => "direct", options);
    expect(result.value).toBe("direct");
    expect(result.metrics).toContainEqual({ name: "app-cache", description: "bypass" });
    expect(mocks.getOrSetDailyCache).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoundedRequestCache } from "../../src/services/cache/boundedRequestCache.js";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  getOrSetDailyCache: vi.fn()
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/cache/dailyDataCache.js", () => ({
  getOrSetDailyCache: mocks.getOrSetDailyCache
}));

import { getTimedCached } from "../../src/api/timedRequestCache.js";

describe("getTimedCached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves a shared Redis hit without opening MongoDB", async () => {
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
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRedisConfigured: vi.fn(() => true),
  redisGet: vi.fn(),
  redisSetEx: vi.fn(),
  redisDel: vi.fn()
}));

vi.mock("../../src/services/cache/redisClient.js", () => mocks);

import { getOrSetDailyCache } from "../../src/services/cache/dailyDataCache.js";

describe("dailyDataCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRedisConfigured.mockReturnValue(true);
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
      "active-etf:v3:api:compare:v1:tw:00981A_00982A:latest",
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
});

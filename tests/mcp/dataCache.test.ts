import type { Db } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generation: vi.fn(async () => "tw.first"),
  configured: vi.fn(() => true),
  values: new Map<string, string>(),
  set: vi.fn(async (key: string, _ttl: number, value: string) => { mocks.values.set(key, value); }),
  get: vi.fn(async (key: string) => mocks.values.get(key) ?? null)
}));
vi.mock("../../src/services/cache/dataCacheVersion.js", () => ({ getDataCacheGeneration: mocks.generation }));
vi.mock("../../src/services/cache/redisClient.js", () => ({ isRedisConfigured: mocks.configured, redisGet: mocks.get, redisSetEx: mocks.set }));
import { createResearchProvider } from "../../src/mcp/data.js";
import { cachedResearchProvider } from "../../src/mcp/cachedProvider.js";

describe("MCP research data/cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.clear();
    mocks.generation.mockResolvedValue("tw.first");
    mocks.configured.mockReturnValue(true);
  });

  it("reads the collection used by the fund summary writers", async () => {
    const summary = { etfCode: "00981A", tradeDate: "2026-10-08", nav: 12.34 };
    const collection = vi.fn((name: string) => {
      if (name === "etf_daily_holdings") return {
        findOne: async () => ({ tradeDate: summary.tradeDate }),
        find: () => ({ sort: () => ({ maxTimeMS: () => ({ toArray: async () => [{ stockId: "2330" }] }) }) })
      };
      if (name === "etf_daily_summary") return { findOne: async () => summary };
      throw new Error(`Unexpected collection: ${name}`);
    });
    const provider = createResearchProvider(async () => ({ collection }) as unknown as Db);
    expect((await provider("get_etf_snapshot", { code: "00981A" })).data.summary).toEqual(summary);
  });

  it("reuses public research, then reloads immediately after a committed source version changes", async () => {
    const provider = vi.fn(async () => ({ data: { sourceAsOf: "2026-10-08" }, hasData: true }));
    const cached = cachedResearchProvider(provider);
    await cached("get_etf_snapshot", { code: "00981A" });
    await cached("get_etf_snapshot", { code: "00981A" });
    expect(provider).toHaveBeenCalledTimes(1);
    mocks.generation.mockResolvedValue("tw.second");
    await cached("get_etf_snapshot", { code: "00981A" });
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("bypasses cached data if the committed version cannot be read", async () => {
    mocks.generation.mockRejectedValueOnce(new Error("version unavailable"));
    const provider = vi.fn(async () => ({ data: {}, hasData: true }));
    await cachedResearchProvider(provider)("get_etf_snapshot", { code: "00981A" });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("keeps empty and oversized research responses out of Redis", async () => {
    await cachedResearchProvider(async () => ({ data: {}, hasData: false }))("get_etf_snapshot", { code: "00981A" });
    await cachedResearchProvider(async () => ({ data: { text: "x".repeat(300_000) }, hasData: true }))("get_etf_snapshot", { code: "00981A" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

import type { HttpRequest, InvocationContext } from "@azure/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  getDb: vi.fn(async () => ({ collection: vi.fn(() => { throw new Error("Unexpected historical version query"); }) })),
  getDataCacheGeneration: vi.fn(async () => "global.first"),
  getGlobalEtfDailyReport: vi.fn(async () => ({ reportDate: "2026-10-10", sections: [] })),
  projectGlobalEtfWebReport: vi.fn(() => ({ sections: [], commonHoldings: [], commonWeightChanges: [] }))
}));
vi.mock("@azure/functions", () => ({ app: { http: vi.fn() } }));
vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/cache/dataCacheVersion.js", () => ({ getDataCacheGeneration: mocks.getDataCacheGeneration }));
vi.mock("../../src/services/cache/redisClient.js", () => ({
  isRedisConfigured: () => true,
  redisGet: async (key: string) => mocks.values.get(key) ?? null,
  redisSetEx: async (key: string, _ttl: number, value: string) => { mocks.values.set(key, value); }
}));
vi.mock("../../src/services/globalEtf/globalEtfService.js", () => ({
  getGlobalEtfDailyReport: mocks.getGlobalEtfDailyReport,
  availableGlobalEtfSourceDates: vi.fn()
}));
vi.mock("../../src/services/globalEtf/webReportProjection.js", () => ({ projectGlobalEtfWebReport: mocks.projectGlobalEtfWebReport }));
vi.mock("../../src/api/memberResponse.js", () => ({
  memberRequestAccess: async () => ({ authenticated: true }),
  memberJsonResponse: (jsonBody: unknown) => ({ status: 200, jsonBody })
}));
import { getGlobalEtfDailyReportApi } from "../../src/api/getGlobalEtfs.js";

const request = (query = "") => ({ query: new URLSearchParams(query) }) as HttpRequest;
const context = {} as InvocationContext;

describe("global report cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.clear();
    mocks.getDataCacheGeneration.mockResolvedValue("global.first");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("loads only the committed pointer on a report hit and shares it across web/raw cache misses", async () => {
    await getGlobalEtfDailyReportApi(request("format=web"), context);
    expect(mocks.getDataCacheGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(mocks.getGlobalEtfDailyReport).toHaveBeenCalledTimes(1);
    await getGlobalEtfDailyReportApi(request("format=web"), context);
    await getGlobalEtfDailyReportApi(request(), context);
    expect(mocks.getDataCacheGeneration).toHaveBeenCalledTimes(3);
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(mocks.getGlobalEtfDailyReport).toHaveBeenCalledTimes(1);
  });

  it("reloads after source invalidation and after the report date rolls over", async () => {
    await getGlobalEtfDailyReportApi(request(), context);
    mocks.getDataCacheGeneration.mockResolvedValue("global.second");
    await getGlobalEtfDailyReportApi(request(), context);
    expect(mocks.getGlobalEtfDailyReport).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-10-11T00:00:01Z"));
    await getGlobalEtfDailyReportApi(request(), context);
    expect(mocks.getGlobalEtfDailyReport).toHaveBeenCalledTimes(3);
  });
});

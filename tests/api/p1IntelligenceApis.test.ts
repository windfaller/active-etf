import type { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(async () => ({ name: "db" })),
  searchStocks: vi.fn(async () => ({ generatedAt: "2026-07-21T00:00:00Z", results: [{ market: "tw", symbol: "2330" }] })),
  stockOverview: vi.fn(async () => ({ found: true, generatedAt: "2026-07-21T00:00:00Z", sourceAsOf: "2026-07-21", coverage: { tracked: 28, available: 24, delayed: 4 }, confidence: { level: "medium", reason: "4 檔延遲" } })),
  stockHistory: vi.fn(async () => ({ points: [] })),
  stockEtfs: vi.fn(async () => ({ rows: [] })),
  stockInstitutions: vi.fn(async () => ({ row: null })),
  compareEtfs: vi.fn(async () => ({ type: "tw", cards: [] })),
  intelligenceSignals: vi.fn(async () => ({ consecutive: [], reversals: [], divergences: [] })),
  etfStyleProfile: vi.fn(async () => ({ etf: { code: "00981A" } })),
  globalSearch: vi.fn(async () => ({ results: [] }))
}));

vi.mock("../../src/db/mongo.js", () => ({ getDb: mocks.getDb }));
vi.mock("../../src/services/intelligence/stockIntelligenceService.js", () => ({
  searchStocks: mocks.searchStocks,
  stockOverview: mocks.stockOverview,
  stockHistory: mocks.stockHistory,
  stockEtfs: mocks.stockEtfs,
  stockInstitutions: mocks.stockInstitutions
}));
vi.mock("../../src/services/intelligence/etfComparisonService.js", () => ({ compareEtfs: mocks.compareEtfs }));
vi.mock("../../src/services/intelligence/signalIntelligenceService.js", () => ({ intelligenceSignals: mocks.intelligenceSignals }));
vi.mock("../../src/services/intelligence/styleProfileService.js", () => ({ etfStyleProfile: mocks.etfStyleProfile }));
vi.mock("../../src/services/intelligence/searchService.js", () => ({ globalSearch: mocks.globalSearch }));

import { getEtfComparison } from "../../src/api/getEtfComparison.js";
import { getSearch } from "../../src/api/getSearch.js";
import { getSignals } from "../../src/api/getSignals.js";
import { getStockEtfs, getStockHistory, getStockInstitutions, getStockOverview, getStocksSearch } from "../../src/api/getStocks.js";
import { getStyleProfile } from "../../src/api/getStyleProfile.js";

function request(query = "", params: Record<string, string> = {}): HttpRequest {
  return { query: new URLSearchParams(query), params } as unknown as HttpRequest;
}

const context = { error: vi.fn() } as unknown as InvocationContext;

describe("P1 intelligence APIs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches stocks with bounded validated inputs", async () => {
    const response = await getStocksSearch(request("q=台積電&market=tw&limit=8"), context);
    expect(response.status).toBe(200);
    expect(mocks.searchStocks).toHaveBeenCalledWith(expect.anything(), "台積電", "tw", 8);
    expect(new Headers(response.headers).get("Cache-Control")).toContain("stale-while-revalidate");
  });

  it("returns stock overview metadata without replacing delayed coverage with zero", async () => {
    const response = await getStockOverview(request("date=2026-07-21", { market: "tw", symbol: "2330" }), context);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ coverage: { tracked: 28, available: 24, delayed: 4 }, confidence: { level: "medium" } });
  });

  it("serves bounded stock history, ETF details, and missing institution data", async () => {
    const historyResponse = await getStockHistory(request("window=20&date=2026-07-21", { market: "tw", symbol: "2330" }), context);
    const etfResponse = await getStockEtfs(request("date=2026-07-21", { market: "tw", symbol: "2330" }), context);
    const institutionResponse = await getStockInstitutions(request("date=2026-07-21", { market: "tw", symbol: "2330" }), context);

    expect(historyResponse).toMatchObject({ status: 200, jsonBody: { points: [] } });
    expect(etfResponse).toMatchObject({ status: 200, jsonBody: { rows: [] } });
    expect(institutionResponse).toMatchObject({ status: 200, jsonBody: { row: null } });
    expect(mocks.stockHistory).toHaveBeenCalledWith(expect.anything(), "tw", "2330", 20, "2026-07-21");
    expect(mocks.stockEtfs).toHaveBeenCalledWith(expect.anything(), "tw", "2330", "2026-07-21");
    expect(mocks.stockInstitutions).toHaveBeenCalledWith(expect.anything(), "tw", "2330", "2026-07-21");
  });

  it("rejects invalid market, symbol, and history windows before database access", async () => {
    expect((await getStockOverview(request("", { market: "hk", symbol: "2330" }), context)).status).toBe(400);
    expect((await getStockOverview(request("", { market: "tw", symbol: "23.*" }), context)).status).toBe(400);
    expect((await getStockHistory(request("window=365", { market: "us", symbol: "MU" }), context)).status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns 404 for a syntactically valid stock absent from the tracked universe", async () => {
    mocks.stockOverview.mockResolvedValueOnce({ found: false } as never);
    const response = await getStockOverview(request("", { market: "us", symbol: "ZZZZ" }), context);
    expect(response.status).toBe(404);
  });

  it("handles Mongo/service errors without leaking implementation details", async () => {
    mocks.stockOverview.mockRejectedValueOnce(new Error("mongodb secret connection text"));
    const response = await getStockOverview(request("", { market: "tw", symbol: "2330" }), context);
    expect(response.status).toBe(500);
    expect(response.jsonBody).toEqual({ error: "stock overview is temporarily unavailable" });
  });

  it("compares 2 to 4 ETFs and excludes 13F portfolios", async () => {
    expect((await getEtfComparison(request("type=tw&codes=00981A,00982A"), context)).status).toBe(200);
    expect((await getEtfComparison(request("type=tw&codes=00981A,00982A,00980A,00985A,00988A"), context)).status).toBe(400);
    expect((await getEtfComparison(request("type=global&codes=DRAM,ARK13F"), context)).status).toBe(400);
    expect((await getEtfComparison(request("type=global&codes=DRAM,NOTREAL"), context)).status).toBe(404);
  });

  it("validates and returns signals, style profiles, and global search", async () => {
    expect((await getSignals(request("kind=reversals&window=5&limit=20"), context)).status).toBe(200);
    expect((await getSignals(request("kind=reversals&window=90"), context)).status).toBe(400);
    expect((await getStyleProfile(request("window=20", { etfCode: "00981A" }), context)).status).toBe(200);
    expect((await getStyleProfile(request("window=20", { etfCode: "99999X" }), context)).status).toBe(404);
    expect((await getSearch(request("q=台積電&types=tw_stock,tw_etf&limit=12"), context)).status).toBe(200);
    expect((await getSearch(request("q=a&limit=12"), context)).status).toBe(400);
  });
});

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

  it("serves only current US ETF and 13F reverse-lookup rows", async () => {
    mocks.stockOverview.mockResolvedValueOnce({
      found: true,
      overseasEtfExposure: { rows: [{ etfCode: "HBMX", sourceAsOf: "2026-07-19" }] },
      sec13f: { rows: [{ institutionCode: "BRK13F", periodOfReport: "2026-06-30" }] }
    } as never);
    mocks.stockEtfs.mockResolvedValueOnce({ rows: [{ etfCode: "HBMX", dataDate: "2026-07-19" }] } as never);
    mocks.stockInstitutions.mockResolvedValueOnce({ rows: [{ institutionCode: "BRK13F", periodOfReport: "2026-06-30" }] } as never);

    const overview = await getStockOverview(request("", { market: "us", symbol: "MU" }), context);
    const etfs = await getStockEtfs(request("", { market: "us", symbol: "MU" }), context);
    const institutions = await getStockInstitutions(request("", { market: "us", symbol: "MU" }), context);
    expect(JSON.stringify([overview.jsonBody, etfs.jsonBody, institutions.jsonBody])).not.toContain("DRAM");
    expect(overview.jsonBody).toMatchObject({ overseasEtfExposure: { rows: [{ etfCode: "HBMX" }] }, sec13f: { rows: [{ institutionCode: "BRK13F" }] } });
    expect(etfs.jsonBody).toMatchObject({ rows: [{ etfCode: "HBMX" }] });
    expect(institutions.jsonBody).toMatchObject({ rows: [{ institutionCode: "BRK13F" }] });
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

  it("returns unambiguous adjustment keys and per-ETF global dates", async () => {
    mocks.compareEtfs.mockResolvedValueOnce({
      type: "tw",
      cards: [{ activeAdjustments: [{ increaseHoldingChangeCount: 5, decreaseHoldingChangeCount: 2 }] }]
    } as never);
    const taiwan = await getEtfComparison(request("type=tw&codes=00981A,00982A"), context);
    expect(taiwan.jsonBody).toMatchObject({ cards: [{ activeAdjustments: [{ increaseHoldingChangeCount: 5, decreaseHoldingChangeCount: 2 }] }] });
    expect(JSON.stringify(taiwan.jsonBody)).not.toContain('"increaseCount"');
    expect(JSON.stringify(taiwan.jsonBody)).not.toContain('"decreaseCount"');

    mocks.compareEtfs.mockResolvedValueOnce({
      type: "global",
      cards: [
        { etfCode: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z" },
        { etfCode: "HBMX", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z" }
      ],
      dateAlignment: {
        commonDateOnly: false,
        commonDate: null,
        rows: [
          { etfCode: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z" },
          { etfCode: "HBMX", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z" }
        ]
      }
    } as never);
    const global = await getEtfComparison(request("type=global&codes=DRAM,HBMX"), context);
    expect(global.jsonBody).toMatchObject({ dateAlignment: { commonDateOnly: false, commonDate: null, rows: [{ etfCode: "DRAM", sourceAsOf: "2026-07-21" }, { etfCode: "HBMX", sourceAsOf: "2026-07-19" }] } });
  });

  it("validates and returns signals, style profiles, and global search", async () => {
    expect((await getSignals(request("kind=reversals&window=5&limit=20"), context)).status).toBe(200);
    expect((await getSignals(request("kind=reversals&window=90"), context)).status).toBe(400);
    expect((await getStyleProfile(request("window=20", { etfCode: "00981A" }), context)).status).toBe(200);
    expect((await getStyleProfile(request("window=20", { etfCode: "99999X" }), context)).status).toBe(404);
    expect((await getSearch(request("q=台積電&types=tw_stock,tw_etf&limit=12"), context)).status).toBe(200);
    expect((await getSearch(request("q=a&limit=12"), context)).status).toBe(400);
  });

  it("deduplicates concurrent identical signals requests", async () => {
    mocks.intelligenceSignals.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { consecutive: [], reversals: [], divergences: [] };
    });
    const query = "kind=consecutive&window=3&limit=1&date=2026-07-20";

    const [first, second] = await Promise.all([getSignals(request(query), context), getSignals(request(query), context)]);

    expect(first.status).toBe(200);
    expect(second.jsonBody).toEqual(first.jsonBody);
    expect(mocks.intelligenceSignals).toHaveBeenCalledTimes(1);
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent identical style profile requests", async () => {
    mocks.etfStyleProfile.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { etf: { code: "00981A" }, period: { window: 60 } };
    });
    const query = "window=60&date=2026-07-19";
    const params = { etfCode: "00981A" };

    const [first, second] = await Promise.all([
      getStyleProfile(request(query, params), context),
      getStyleProfile(request(query, params), context)
    ]);

    expect(first.status).toBe(200);
    expect(second.jsonBody).toEqual(first.jsonBody);
    expect(mocks.etfStyleProfile).toHaveBeenCalledTimes(1);
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
  });
});

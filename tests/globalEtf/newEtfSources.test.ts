import { afterEach, describe, expect, it, vi } from "vitest";
import { findGlobalEtfConfig } from "../../src/config/globalEtfs.js";
import { parseHarborFullHoldingsJson, parseRoundhillHoldingsCsv } from "../../src/providers/globalEtf/parser.js";
import { buildGlobalSnapshot } from "../../src/providers/globalEtf/normalizer.js";
import { fetchGlobalEtfSnapshot } from "../../src/providers/globalEtf/provider.js";
import { fetchSource, type SourceFetchResult } from "../../src/services/source/httpClient.js";

vi.mock("../../src/services/source/httpClient.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/services/source/httpClient.js")>(),
  fetchSource: vi.fn()
}));

const roundhillHeader = "Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings,NetAssets,SharesOutstanding,CreationUnits,MoneyMarketFlag";

function harborBody(ticker: string, overrides = {}) {
  return JSON.stringify({
    result: { data: { contentstackProductV2: { product_tabs: [{ data_section: { section: [{ api_reference: [{ data: {
      fundClasses: [{ ticker }],
      fullHoldings: [
        { calendar: { date: "2026-09-28T00:00:00.000Z" }, ticker: "9984", cusip: "677062903", securityName: "SOFTBANK GROUP CORP", shares: 20800, marketValue: 824270.605, weight: 0.1480962483, countryName: "JAPAN", assetGroup: "EQUITY" },
        { calendar: { date: "2026-09-28T00:00:00.000Z" }, ticker: "TSM", cusip: "874039100", securityName: "TAIWAN SEMICONDUCTOR-SP ADR", weight: 0.043, countryName: "TAIWAN", assetGroup: "EQUITY" },
        { calendar: { date: "2026-09-28T00:00:00.000Z" }, ticker: "2330", cusip: "688910603", securityName: "TAIWAN SEMICONDUCTOR", weight: 0.02, countryName: "TAIWAN", assetGroup: "EQUITY" },
        { calendar: { date: "2026-09-28T00:00:00.000Z" }, ticker: null, cusip: null, securityName: "TWD999999", weight: -0.0000077123, marketValue: -101811.12, assetGroup: "FX" },
        { calendar: { date: "2026-09-28T00:00:00.000Z" }, ticker: "MSFT", securityName: "MICROSOFT CORP", weight: null, assetGroup: "EQUITY" }
      ],
      fullHoldingsCashWeight: 1.01752129,
      ...overrides
    } }] }] } }] } } }
  });
}

function sourceResult(rawBody: string): SourceFetchResult {
  return { url: "https://example.com/holdings", method: "GET", requestHeaders: {}, responseStatus: 200, responseHeaders: {}, rawContentType: "text/plain", rawBody };
}

describe("new global ETF official holdings sources", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("filters each Roundhill fund and keeps ADRs, local shares and swaps separate", () => {
    const etf = findGlobalEtfConfig("CHAT")!;
    const parsed = parseRoundhillHoldingsCsv([
      roundhillHeader,
      "09/30/2026,DRAM,MU,595112103,Micron Technology Inc,100,100,10000,5%,200000,1000,1,",
      "09/30/2026,CHAT,000660 KS,6450267,SK hynix Inc,100,100,10000,4.15%,200000,1000,1,",
      "09/30/2026,CHAT,SKHY,78392B206,SK hynix Inc ADR,100,100,10000,1%,200000,1000,1,",
      "09/30/2026,CHAT,6450267 TRS 090931 GS,6450267 TRS 090931 GS,SK HYNIX INC SWAP GS,100,100,10000,2%,200000,1000,1,",
      "09/30/2026,CHAT,CNY,CASHCNY,CHINESE YUAN,100,1,100,0.01%,200000,1000,1,",
      "09/30/2026,CHAT,FGXXX,31846V336,First American Government Obligations Fund,100,1,100,0.01%,200000,1000,1,Y"
    ].join("\n"), etf, etf.sourceUrl);
    const snapshot = buildGlobalSnapshot(etf, { ...parsed, sourceUrl: etf.sourceUrl });

    expect(parsed.sourceAsOf).toBe("2026-09-30");
    expect(snapshot.holdings).toHaveLength(5);
    expect(snapshot.holdings.map((row) => row.ticker)).not.toContain("MU");
    expect(snapshot.holdings.find((row) => row.ticker === "000660.KS")?.weightPercent).toBe(4.15);
    expect(snapshot.holdings.find((row) => row.ticker === "SKHY")?.weightPercent).toBe(1);
    expect(snapshot.holdings.find((row) => row.name.includes("SWAP"))?.assetType).toBe("Equity Swap");
    expect(snapshot.holdings.filter((row) => row.assetType === "Cash")).toHaveLength(2);
  });

  it("reads Harbor full holdings with fraction weights, residual cash and distinct listings", () => {
    const etf = findGlobalEtfConfig("OAIW")!;
    const parsed = parseHarborFullHoldingsJson(harborBody("OAIW"), etf, etf.holdingsUrl!);
    const snapshot = buildGlobalSnapshot(etf, { ...parsed, sourceUrl: etf.holdingsUrl! });

    expect(snapshot.sourceAsOf).toBe("2026-09-28");
    expect(snapshot.holdings).toHaveLength(6);
    expect(snapshot.holdings.find((row) => row.ticker === "9984.JP")).toEqual(expect.objectContaining({ sourceTicker: "9984", weightPercent: 14.80962483, shares: 20800, marketValue: 824270.605 }));
    expect(snapshot.holdings.find((row) => row.ticker === "TSM")?.positionKey).not.toBe(snapshot.holdings.find((row) => row.ticker === "2330.TW")?.positionKey);
    expect(snapshot.holdings.find((row) => row.ticker === "CASH&OTHER")?.weightPercent).toBe(1.01752129);
    expect(snapshot.holdings.find((row) => row.assetType === "Foreign Exchange")?.weightPercent).toBeCloseTo(-0.00077123);
    expect(snapshot.holdings.find((row) => row.ticker === "MSFT")?.weightPercent).toBeUndefined();
  });

  it("rejects missing full holdings, mismatched funds and mixed source dates", () => {
    const etf = findGlobalEtfConfig("ANTW")!;
    for (const raw of [
      harborBody("OAIW"),
      harborBody("ANTW", { fullHoldings: [] }),
      harborBody("ANTW", { fullHoldings: [{ calendar: { date: "2026-09-28" } }, { calendar: { date: "2026-09-29" } }] })
    ]) expect(() => parseHarborFullHoldingsJson(raw, etf, etf.holdingsUrl!)).toThrow(/full holdings or source date/);
  });

  it.each(["LYTE", "NCLD", "CHAT", "CCML"])("fetches %s and skips a successful CSV without that fund", async (ticker) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T03:00:00.000Z"));
    vi.mocked(fetchSource)
      .mockResolvedValueOnce(sourceResult(`${roundhillHeader}\n09/30/2026,DRAM,MU,595112103,Micron,100,100,10000,5%,200000,1000,1,`))
      .mockResolvedValueOnce(sourceResult(`${roundhillHeader}\n09/30/2026,${ticker},LITE,55024U109,Lumentum Holdings Inc,100,100,10000,5%,200000,1000,1,`));

    const result = await fetchGlobalEtfSnapshot(ticker);

    expect(result.snapshot.etfCode).toBe(ticker);
    expect(result.snapshot.rowCount).toBe(1);
    expect(fetchSource).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchSource).mock.calls[1]?.[0].url).toContain("09292026.csv");
  });

  it.each(["OAIW", "ANTW"])("routes %s through the official Harbor full-holdings source", async (ticker) => {
    vi.mocked(fetchSource).mockResolvedValue(sourceResult(harborBody(ticker)));

    const result = await fetchGlobalEtfSnapshot(ticker);

    expect(result.snapshot.etfCode).toBe(ticker);
    expect(result.snapshot.sourceAsOf).toBe("2026-09-28");
    expect(vi.mocked(fetchSource).mock.calls[0]?.[0].url).toBe(findGlobalEtfConfig(ticker)?.holdingsUrl);
  });
});

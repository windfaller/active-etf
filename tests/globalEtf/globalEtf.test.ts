import { describe, expect, it } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { enabledGlobalEtfs } from "../../src/config/globalEtfs.js";
import { parseCorgiEuvRows, parseTemaNasaCsv } from "../../src/providers/globalEtf/parser.js";
import { buildGlobalSnapshot } from "../../src/providers/globalEtf/normalizer.js";
import { calculateGlobalEtfChanges } from "../../src/services/globalEtf/changeCalculator.js";
import { demoGlobalEtfSnapshots, getGlobalEtfDailyReport } from "../../src/services/globalEtf/globalEtfService.js";

describe("global ETF product line", () => {
  it("keeps global ETF codes out of the Taiwan active ETF universe", () => {
    const taiwanCodes = new Set(configuredEtfs.map((etf) => etf.etfCode));
    expect(taiwanCodes.has("DRAM")).toBe(false);
    expect(taiwanCodes.has("NASA")).toBe(false);
    expect(taiwanCodes.has("BAI")).toBe(false);
    expect(taiwanCodes.has("EUV")).toBe(false);
    expect(enabledGlobalEtfs.map((etf) => etf.etfCode)).toEqual(["DRAM", "NASA", "BAI", "EUV"]);
  });

  it("parses NASA percent_of_nav as a fraction and preserves sector/country", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "NASA");
    expect(etf).toBeDefined();
    const parsed = parseTemaNasaCsv(
      "holdings_date,ticker,proper_name,cusip,percent_of_nav,shares,market_value,country,sector,is_cash\n2026-06-23,RKLB,Rocket Lab,123,0.096,100,9600,US,Aerospace,0",
      etf!,
      etf!.holdingsUrl!
    );

    expect(parsed.sourceAsOf).toBe("2026-06-23");
    expect(parsed.holdings[0]).toEqual(
      expect.objectContaining({
        ticker: "RKLB",
        weightPercent: 9.6,
        country: "US",
        sector: "Aerospace",
        assetType: "Equity"
      })
    );
  });

  it("filters EUV API rows to the newest holding_date before normalizing", () => {
    const etf = enabledGlobalEtfs.find((item) => item.etfCode === "EUV");
    expect(etf).toBeDefined();
    const parsed = parseCorgiEuvRows(
      [
        { holding_date: "2026-06-20T00:00:00Z", stock_ticker: "OLD", security_name: "Old Row", weightings: 99 },
        { holding_date: "2026-06-23T00:00:00Z", stock_ticker: "ASML", security_name: "ASML Holding", weightings: 14.2 },
        { holding_date: "2026-06-23T00:00:00Z", stock_ticker: "LRCX", security_name: "Lam Research", weightings: 8.4 }
      ],
      etf!,
      etf!.holdingsUrl!
    );
    const snapshot = buildGlobalSnapshot(etf!, { ...parsed, sourceUrl: etf!.holdingsUrl! });

    expect(parsed.sourceAsOf).toBe("2026-06-23");
    expect(snapshot.rowCount).toBe(2);
    expect(snapshot.holdings.map((holding) => holding.ticker)).toEqual(["ASML", "LRCX"]);
    expect(snapshot.unusableReason).toBeUndefined();
  });

  it("calculates weight changes and renders a dark-mode-safe Top 10 report", async () => {
    const current = demoGlobalEtfSnapshots()[0];
    const previous = {
      ...current,
      sourceAsOf: "2026-06-20",
      holdings: current.holdings.map((holding) => ({
        ...holding,
        weightPercent: (holding.weightPercent ?? 0) - 0.2
      }))
    };
    const changes = calculateGlobalEtfChanges(current, previous);
    const report = await getGlobalEtfDailyReport();

    expect(changes[0]?.deltaPp).toBeCloseTo(0.2);
    expect(report.sections[0]?.topHoldings).toHaveLength(10);
    expect(report.html).toContain("background-color:#111827");
    expect(report.html).toContain("Top 10 持股");
    expect(report.adContext.tags).toEqual(expect.arrayContaining(["global-etf", "us-market", "ai", "semiconductor", "macro", "active-etf"]));
  });
});

import { describe, expect, it } from "vitest";
import {
  detectCapitalBuybackTradeDate,
  parseCapitalHoldings,
  parseCapitalSummary
} from "../../src/providers/capital/parser.js";
import { normalizeCapitalHoldings, normalizeCapitalSummary } from "../../src/providers/capital/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  code: 200,
  data: {
    pcf: {
      fundName: "群益台灣精選強棒主動式ETF基金",
      date1: "2026-05-18",
      date2: "2026-05-15",
      nav: 50_109_267_046,
      totUnit: 2_228_936_000,
      disUnit: 90_000_000,
      pUnit: 22.48,
      totStock: "95.437300"
    },
    stocks: [
      {
        date1: "2026/5/18 上午 12:00:00",
        stocNo: "2330",
        stocName: "台積電",
        weight: 8.4074,
        weightRound: 8.41,
        share: 1_860_000,
        shareFormat: "1,860,000"
      },
      {
        date1: "2026/5/18 上午 12:00:00",
        stocNo: "2383",
        stocName: "台光電",
        weight: 5.047,
        weightRound: 5.05,
        share: 548_000,
        shareFormat: "548,000"
      }
    ],
    assets: [
      { asDesc: "應收付證券款", asMoney: "TWD -972,744,257.00" },
      { asDesc: "現金", asMoney: "TWD 2,909,032,737.00" }
    ]
  },
  message: null
});

const fetchResult = {
  url: "https://www.capitalfund.com.tw/CFWeb/api/etf/buyback",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: "{}",
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("capital provider parser", () => {
  it("detects the holdings snapshot trade date from pcf.date2", () => {
    expect(detectCapitalBuybackTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses stock holdings from official buyback JSON", () => {
    const holdings = parseCapitalHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 1_860_000,
      lots: 1860,
      weight: 8.4074
    });
    expect(holdings[0]?.marketValue).toBeCloseTo(4_212_886_517.63, 2);
  });

  it("parses summary from official buyback JSON", () => {
    const summary = parseCapitalSummary(rawBody);

    expect(summary).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 22.48,
      totalUnits: 2_228_936_000,
      fundSize: 50_109_267_046,
      netCreationUnits: 90_000_000,
      stockRatio: 95.4373
    });
    expect(summary.cashRatio).toBeCloseTo(5.8054, 4);
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "capital",
      etfCode: "00982A",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeCapitalHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00982A",
      tradeDate: "2026-05-15",
      stockId: "2330",
      sourceProvider: "capital"
    });
    expect(normalizeCapitalSummary(summaryRaw)).toMatchObject({
      etfCode: "00982A",
      tradeDate: "2026-05-15",
      nav: 22.48,
      sourceProvider: "capital"
    });
  });
});

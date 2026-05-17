import { describe, expect, it } from "vitest";
import {
  detectNomuraFundAssetsTradeDate,
  parseNomuraHoldings,
  parseNomuraSummary
} from "../../src/providers/nomura/parser.js";
import { normalizeNomuraHoldings, normalizeNomuraSummary } from "../../src/providers/nomura/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  TotalPages: -1,
  TotalItems: 0,
  Entries: {
    FundID: "00980A",
    Data: {
      FundAsset: {
        Aum: "17247266054",
        Units: "749730000",
        Nav: "23.00",
        NavDate: "2026/05/15"
      },
      Table: [
        {
          TableTitle: "股票",
          Rows: [
            ["2330", "台灣積體電路製造", "607000", "7.97"],
            ["2308", "台達電子工業", "459000", "5.52"]
          ],
          NavDate: "2026/05/15"
        },
        {
          TableTitle: "",
          Rows: [
            ["股票", "TWD$15,180,361,443", "TWD", "15180361443"],
            ["現金", "TWD$2,031,004,161", "TWD", "2031004161"]
          ],
          NavDate: "2026/05/15"
        }
      ]
    }
  },
  Message: "",
  StatusCode: 0
});

const fetchResult = {
  url: "https://www.nomurafunds.com.tw/API/ETFAPI/api/Fund/GetFundAssets",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: "{}",
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("nomura provider parser", () => {
  it("detects the NAV trade date", () => {
    expect(detectNomuraFundAssetsTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses stock holdings from Fund/GetFundAssets JSON", () => {
    const holdings = parseNomuraHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台灣積體電路製造",
      shares: 607_000,
      lots: 607,
      weight: 7.97
    });
    expect(holdings[0]?.marketValue).toBeCloseTo(1_374_607_104.5038, 4);
  });

  it("parses summary from Fund/GetFundAssets JSON", () => {
    const summary = parseNomuraSummary(rawBody);

    expect(summary).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 23,
      totalUnits: 749_730_000,
      fundSize: 17_247_266_054
    });
    expect(summary.stockRatio).toBeCloseTo(88.016, 3);
    expect(summary.cashRatio).toBeCloseTo(11.7758, 4);
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "nomura",
      etfCode: "00980A",
      tradeDate: "2026-05-15",
      dataType: "holdings",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeNomuraHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00980A",
      tradeDate: "2026-05-15",
      stockId: "2330",
      sourceProvider: "nomura"
    });
    expect(normalizeNomuraSummary(summaryRaw)).toMatchObject({
      etfCode: "00980A",
      tradeDate: "2026-05-15",
      nav: 23,
      sourceProvider: "nomura"
    });
  });
});

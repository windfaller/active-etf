import { describe, expect, it } from "vitest";
import { normalizeFhHoldings, normalizeFhSummary } from "../../src/providers/fh/normalizer.js";
import { detectFhTradeDate, parseFhHoldings, parseFhSummary } from "../../src/providers/fh/parser.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  assets: {
    result: [
      {
        fundID: "ETF23",
        twNameFull: "復華台灣未來50主動式ETF基金",
        etf002: "00991A",
        dDate: "2026/05/15",
        pcf_FundNav: "45,929,580,058",
        pcf_FundQissue: "2,610,416,000",
        pcf_Fundpnav: "17.59",
        result: [
          { ftype: "股票", itemName: "股票", tot_mvalue: "43,508,496,500" },
          { ftype: "其他資產", itemName: "扣除應付買入證券款後現金餘額(NTD)", tot_mvalue: "941,659,046" }
        ],
        detail: [
          {
            ftype: "股票",
            stockid: "2330",
            stockname: "台灣積體",
            qshare: "3,650,000",
            mvalue: "8,267,250,000",
            prate_addaccint: "18.000%"
          },
          {
            ftype: "股票",
            stockid: "8299",
            stockname: "群聯電子",
            qshare: "1,360,000",
            mvalue: "3,604,000,000",
            prate_addaccint: "7.847%"
          },
          {
            ftype: "其他資產",
            stockid: "",
            stockname: "扣除應付買入證券款後現金餘額(NTD)",
            qshare: "0",
            mvalue: "941,659,046",
            prate_addaccint: "2.050%"
          }
        ]
      }
    ]
  },
  pcf: {
    result: [
      {
        postDate: "2026/05/18",
        nav: "45929580058",
        qIssue: "2610416000.0",
        qDiff: "152000000.0",
        pnav: "17.5900"
      }
    ]
  }
});

const globalRawBody = JSON.stringify({
  assets: {
    result: [
      {
        fundID: "ETF26",
        twNameFull: "復華全球未來50主動式ETF基金",
        etf002: "00409A",
        dDate: "2026/09/02",
        pcf_FundNav: "17,536,640,814",
        pcf_FundQissue: "1,827,448,000",
        pcf_Fundpnav: "9.6",
        result: [
          { ftype: "股票", itemName: "股票", tot_mvalue: "15,775,027,015" },
          { ftype: "ETF", itemName: "ETF", tot_mvalue: "204,532,116" },
          { ftype: "其他資產", itemName: "扣除應付買入證券款後現金餘額(NTD)", tot_mvalue: "1,178,715,351" },
          { ftype: "其他資產", itemName: "扣除應付買入證券款後現金餘額(USD)", tot_mvalue: "-12,808,373" }
        ],
        detail: [
          {
            ftype: "股票",
            stockid: "PLTR US",
            stockname: "帕蘭提爾科技公司",
            qshare: "122,000",
            qshareCur: "USD",
            mvalue: "656,237,917",
            prate_addaccint: "3.742%"
          },
          {
            ftype: "股票",
            stockid: "2383",
            stockname: "台光電子",
            qshare: "99,000",
            qshareCur: "NTD",
            mvalue: "539,055,000",
            prate_addaccint: "3.074%"
          },
          {
            ftype: "ETF",
            stockid: "GDX US",
            stockname: "VanEck黃金礦業交易所交易基金",
            qshare: "66,000",
            qshareCur: "USD",
            mvalue: "204,532,116",
            prate_addaccint: "1.166%"
          },
          {
            ftype: "其他資產",
            stockid: "",
            stockname: "扣除應付買入證券款後現金餘額(NTD)",
            qshare: "0",
            qshareCur: "NTD",
            mvalue: "1,178,715,351",
            prate_addaccint: "6.720%"
          },
          {
            ftype: "其他資產",
            stockid: "",
            stockname: "扣除應付買入證券款後現金餘額(USD)",
            qshare: "0",
            qshareCur: "USD",
            mvalue: "-12,808,373",
            prate_addaccint: "-2.320%"
          }
        ]
      }
    ]
  },
  pcf: null
});

const fetchResult = {
  url: "https://www.fhtrust.com.tw/api/assets?fundID=ETF23&qDate=2026%2F05%2F15",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("Fuh Hwa provider parser", () => {
  it("detects the holdings trade date from the official assets API", () => {
    expect(detectFhTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses full stock holdings from assets detail", () => {
    expect(parseFhHoldings(rawBody)).toEqual([
      {
        stockId: "2330",
        stockName: "台灣積體",
        shares: 3650000,
        lots: 3650,
        weight: 18,
        marketValue: 8267250000
      },
      {
        stockId: "8299",
        stockName: "群聯電子",
        shares: 1360000,
        lots: 1360,
        weight: 7.847,
        marketValue: 3604000000
      }
    ]);
  });

  it("parses summary from assets and PCF JSON", () => {
    expect(parseFhSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 17.59,
      totalUnits: 2610416000,
      fundSize: 45929580058,
      netCreationUnits: 152000000,
      cashRatio: 2.0502,
      stockRatio: 94.7287
    });
  });

  it("keeps global equity and ETF tickers and sums multi-currency cash weights", () => {
    expect(parseFhHoldings(globalRawBody)).toEqual([
      expect.objectContaining({ stockId: "PLTR US", shares: 122_000, weight: 3.742 }),
      expect.objectContaining({ stockId: "2383", shares: 99_000, weight: 3.074 }),
      expect.objectContaining({ stockId: "GDX US", shares: 66_000, weight: 1.166 })
    ]);
    expect(parseFhSummary(globalRawBody)).toMatchObject({
      tradeDate: "2026-09-02",
      nav: 9.6,
      totalUnits: 1_827_448_000,
      fundSize: 17_536_640_814,
      cashRatio: 4.4
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "fh",
      etfCode: "00991A",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeFhHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00991A",
      tradeDate: "2026-05-15",
      sourceProvider: "fh"
    });
    expect(normalizeFhSummary(summaryRaw)).toMatchObject({
      etfCode: "00991A",
      tradeDate: "2026-05-15",
      sourceProvider: "fh"
    });
  });
});

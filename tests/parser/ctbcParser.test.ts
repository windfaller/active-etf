import { describe, expect, it } from "vitest";
import {
  detectCtbcBuybackTradeDate,
  parseCtbcAuthToken,
  parseCtbcHoldings,
  parseCtbcSummary
} from "../../src/providers/ctbc/parser.js";
import { normalizeCtbcHoldings, normalizeCtbcSummary } from "../../src/providers/ctbc/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const authRawBody = JSON.stringify({
  ResultCode: 0,
  ResultMsg: "",
  Data: { token: "public-token" }
});

const rawBody = JSON.stringify({
  ResultCode: 0,
  ResultMsg: "",
  Data: {
    Data: [
      {
        FundName: "主動中信ARK創新",
        ETF_ID: "00983A",
        FID: "E0034",
        公告日: "2026/05/18",
        基金淨資產價值: "2,634,111,020",
        已發行受益權單位總數: "222,686,000",
        與前日已發行單位差異數: "-3,500,000",
        每受益權單位淨資產價值: "11.83",
        淨值日期: "2026/05/14",
        NAV_DATE: "2026-05-14T00:00:00"
      }
    ],
    Detail: [
      {
        Code: "STOCK",
        Name: "股票",
        SumTitle: "股票合計",
        Sum: 97.5,
        Data: [
          {
            invtp_: "STOCK",
            code_: "TSLA US",
            name_: "特斯拉公司",
            ename_: "Tesla Inc",
            cur_: "USD",
            qty_: "16,730.00",
            weights_: "8.84",
            amount_: "7,416,409.00"
          },
          {
            invtp_: "STOCK",
            code_: "AMD US",
            name_: "超微半導體公司",
            ename_: "Advanced Micro Devices Inc",
            cur_: "USD",
            qty_: "13,174.00",
            weights_: "7.09",
            amount_: "5,924,347.80"
          }
        ]
      },
      {
        Code: "CASH",
        Name: "其他資產",
        Data: [
          {
            invtp_: "CASH",
            code_: "",
            name_: "現金",
            qty_: "0.00",
            weights_: "6.22",
            amount_: "163,846,570.00"
          }
        ]
      }
    ]
  }
});

const fetchResult = {
  url: "https://www.ctbcinvestments.com.tw/API/etf/Buyback",
  method: "POST" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("ctbc provider parser", () => {
  it("parses the public API auth token", () => {
    expect(parseCtbcAuthToken(authRawBody)).toBe("public-token");
  });

  it("detects the holdings trade date from NAV_DATE", () => {
    expect(detectCtbcBuybackTradeDate(rawBody)).toBe("2026-05-14");
  });

  it("parses stock holdings from the Buyback JSON response", () => {
    const holdings = parseCtbcHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "TSLA US",
      stockName: "特斯拉公司",
      shares: 16_730,
      lots: 16.73,
      weight: 8.84,
      marketValue: 7_416_409
    });
  });

  it("parses PCF summary from the Buyback JSON response", () => {
    expect(parseCtbcSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-14",
      nav: 11.83,
      totalUnits: 222_686_000,
      fundSize: 2_634_111_020,
      netCreationUnits: -3_500_000,
      stockRatio: 97.5
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "ctbc",
      etfCode: "00983A",
      tradeDate: "2026-05-14",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeCtbcHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00983A",
      tradeDate: "2026-05-14",
      sourceProvider: "ctbc"
    });
    expect(normalizeCtbcSummary(summaryRaw)).toMatchObject({
      etfCode: "00983A",
      tradeDate: "2026-05-14",
      sourceProvider: "ctbc"
    });
  });
});

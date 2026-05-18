import { describe, expect, it } from "vitest";
import {
  detectAllianzTradeDate,
  parseAllianzHoldings,
  parseAllianzSummary,
  parseAllianzTradeInfo
} from "../../src/providers/allianz/parser.js";
import { normalizeAllianzHoldings, normalizeAllianzSummary } from "../../src/providers/allianz/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  TotalPages: -1,
  TotalItems: 0,
  Entries: {
    CFundId: "E0002",
    CFullName: "安聯台灣主動式ETF證券投資信託基金",
    CFundShortName: "主動安聯台灣",
    CPcfdate: "2026-05-18T00:00:00",
    CNavDt: "2026-05-15T00:00:00",
    CAnceTotalAv: 11364970115,
    CAnceTotalIssues: 896091000,
    CAnceIssuesDiff: 5000000,
    CAnceNav: 12.68,
    CEtfindexCurrency: "TWD",
    DynamicTableData: [
      {
        TableTitle: "股票 (96.43%)",
        Columns: [
          { Name: "序號", TextAlign: "center" },
          { Name: "股票代號", TextAlign: "center" },
          { Name: "股票名稱", TextAlign: "center" },
          { Name: "股數", TextAlign: "center" },
          { Name: "權重(%)", TextAlign: "center" }
        ],
        Rows: [
          ["1", "2330", "台積電", "469,000", "9.33%"],
          ["2", "6223", "旺矽", "178,000", "9.23%"]
        ]
      },
      {
        TableTitle: "期貨",
        Columns: [
          { Name: "序號", TextAlign: "center" },
          { Name: "期貨代號", TextAlign: "center" },
          { Name: "期貨名稱", TextAlign: "center" },
          { Name: "口數", TextAlign: "center" },
          { Name: "權重(%)", TextAlign: "center" },
          { Name: "契約年月", TextAlign: "center" }
        ],
        Rows: [["1", "TX", "台指期貨", "19", "1.33%", "2026/06"]]
      }
    ],
    CSecuritiesCode: "00993A"
  },
  Message: "",
  StatusCode: 0
});

const fetchResult = {
  url: "https://etf.allianzgi.com.tw/webapi/api/Fund/GetFundTradeInfo",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: JSON.stringify({ FundNo: "E0002", Date: "2026-05-18T00:00:00.000Z" }),
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("allianz provider parser", () => {
  it("parses official GetFundTradeInfo response shape", () => {
    const entries = parseAllianzTradeInfo(rawBody);

    expect(entries.CFundId).toBe("E0002");
    expect(detectAllianzTradeDate(rawBody)).toBe("2026-05-15");
    expect(parseAllianzSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 12.68,
      totalUnits: 896091000,
      fundSize: 11364970115,
      netCreationUnits: 5000000,
      stockRatio: 96.43
    });
  });

  it("parses only the stock table into holdings", () => {
    const holdings = parseAllianzHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 469000,
      lots: 469,
      weight: 9.33
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "allianz",
      etfCode: "00993A",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeAllianzHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00993A",
      tradeDate: "2026-05-15",
      sourceProvider: "allianz"
    });
    expect(normalizeAllianzSummary(summaryRaw)).toMatchObject({
      etfCode: "00993A",
      tradeDate: "2026-05-15",
      sourceProvider: "allianz"
    });
  });
});

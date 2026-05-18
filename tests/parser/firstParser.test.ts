import { describe, expect, it } from "vitest";
import { normalizeFirstHoldings, normalizeFirstSummary } from "../../src/providers/first/normalizer.js";
import { detectFirstPcfTradeDate, parseFirstHoldings, parseFirstSummary } from "../../src/providers/first/parser.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  summary: {
    d: JSON.stringify([
      { fundid: "182", sdate: "2026-05-18", A: "基金淨資產價值(元)", B: "TWD 5,370,913,437" },
      { fundid: "182", sdate: "2026-05-18", A: "每受益權單位淨資產價值(元)-台幣交易", B: "16.96" },
      { fundid: "182", sdate: "2026-05-18", A: "已發行受益權單位總數-台幣交易", B: "316,690,000" },
      { fundid: "182", sdate: "2026-05-18", A: "與前日已發行單位差異數-台幣交易", B: "0" }
    ])
  },
  holdings: {
    d: JSON.stringify([
      { fundid: "182", sdate: "2026-05-15", group: "1", A: "2330", B: "台積電", C: "16.15", D: "382,999", E: "" },
      { fundid: "182", sdate: "2026-05-15", group: "1", A: "2383", B: "台光電", C: "6.01", D: "70,000", E: "" },
      { fundid: "182", sdate: "2026-05-15", group: "5", A: "股票", B: "94.81", C: "", D: "", E: "" }
    ])
  }
});

const fetchResult = {
  url: "https://www.fsitc.com.tw/FundDetail.aspx?ID=182",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: "{}",
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("first provider parser", () => {
  it("detects the holdings trade date from Get_hd rows", () => {
    expect(detectFirstPcfTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses holdings and summary from official WebAPI envelopes", () => {
    expect(parseFirstHoldings(rawBody)[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 382_999,
      lots: 382.999,
      weight: 16.15
    });

    const summary = parseFirstSummary(rawBody);
    expect(summary).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 16.96,
      totalUnits: 316_690_000,
      fundSize: 5_370_913_437,
      netCreationUnits: 0
    });
    expect(summary.stockRatio).toBeCloseTo(22.16, 2);
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "first",
      etfCode: "00994A",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeFirstHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00994A",
      tradeDate: "2026-05-15",
      stockId: "2330",
      sourceProvider: "first"
    });
    expect(normalizeFirstSummary(summaryRaw)).toMatchObject({
      etfCode: "00994A",
      tradeDate: "2026-05-15",
      nav: 16.96,
      sourceProvider: "first"
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  detectYuantaPcfTradeDate,
  parseYuantaHoldings,
  parseYuantaSummary
} from "../../src/providers/yuanta/parser.js";
import { normalizeYuantaHoldings, normalizeYuantaSummary } from "../../src/providers/yuanta/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  PCF: {
    fundid: "1254",
    fundname: "元大全球AI新經濟主動式ETF基金",
    trandate: "20260515",
    anndate: "20260518",
    totalav: 33_070_778_951,
    osunit: 1_816_522_000,
    issuesdiff: -7_000_000,
    nav: 18.21
  },
  Cash: {
    CashPosition: [{ name: "現金", amt: 446_791_514, rto: 1.4167 }]
  },
  FundWeights: {
    Summary: {
      fundsize: 31_536_764_077,
      stkvalues: 32_262_142_531
    },
    StockWeights: [
      {
        code: "LITE US",
        name: "LUMENTUM HOLDINGS INC",
        ename: "Lumentum Holdings Inc",
        qty: 70_985,
        weights: 6.89
      },
      {
        code: "2308",
        name: "台達電",
        ename: "Delta Electronics Inc",
        qty: 628_000,
        weights: 4.31
      }
    ]
  }
});

const fetchResult = {
  url: "https://etfapi.yuantaetfs.com/ectranslation/api/bridge",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("yuanta provider parser", () => {
  it("detects the trade date from PCF.trandate", () => {
    expect(detectYuantaPcfTradeDate(rawBody)).toBe("2026-05-15");
  });

  it("parses full stock weights from official PCF/Daily JSON", () => {
    const holdings = parseYuantaHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "LITE US",
      stockName: "LUMENTUM HOLDINGS INC",
      shares: 70_985,
      lots: 70.985,
      weight: 6.89
    });
    expect(holdings[1]?.marketValue).toBeCloseTo(1_425_350_572.79, 2);
  });

  it("parses summary from PCF/Daily JSON", () => {
    const summary = parseYuantaSummary(rawBody);

    expect(summary).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 18.21,
      totalUnits: 1_816_522_000,
      fundSize: 33_070_778_951,
      netCreationUnits: -7_000_000
    });
    expect(summary.stockRatio).toBeCloseTo(97.55, 2);
    expect(summary.cashRatio).toBeCloseTo(1.35, 2);
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "yuanta",
      etfCode: "00990A",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeYuantaHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00990A",
      tradeDate: "2026-05-15",
      sourceProvider: "yuanta"
    });
    expect(normalizeYuantaSummary(summaryRaw)).toMatchObject({
      etfCode: "00990A",
      tradeDate: "2026-05-15",
      sourceProvider: "yuanta"
    });
  });
});

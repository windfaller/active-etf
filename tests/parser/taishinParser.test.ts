import { describe, expect, it } from "vitest";
import {
  detectTaishinPcfTradeDate,
  parseTaishinHoldings,
  parseTaishinSummary
} from "../../src/providers/taishin/parser.js";
import { normalizeTaishinHoldings, normalizeTaishinSummary } from "../../src/providers/taishin/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = `
<input id="DATA_DATE" name="DATA_DATE" type="hidden" value="2026-05-18" />
<input type="text" id="PUB_DATE" name="PUB_DATE" value="2026-05-18" />
<table class="table table-striped listNo">
  <tbody>
    <tr><th>基金淨資產價值(元)</th><td>TWD 3,284,825,396</td></tr>
    <tr><th>每受益權單位淨資產價值(元)</th><td>TWD 16.54</td></tr>
    <tr><th>已發行受益權單位總數</th><td>198,643,000</td></tr>
    <tr><th>與前日已發行單位差異數</th><td>(2,000,000)</td></tr>
  </tbody>
</table>
<table class="table table-striped">
  <thead>
    <tr><th>代號</th><th>名稱</th><th>股數</th><th>持股權重</th></tr>
  </thead>
  <tbody>
    <tr><td>3017 TT</td><td>奇鋐</td><td>86,000</td><td>6.4274%</td></tr>
    <tr><td>2330 TT</td><td>台積電</td><td>90,000</td><td>6.2058%</td></tr>
    <tr><td colspan="3" class="text-align-right">股票合計</td><td>96.3909%</td></tr>
  </tbody>
</table>`;

const fetchResult = {
  url: "https://www.tsit.com.tw/ETF/Home/Pcf/00987A",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "text/html",
  rawBody
};

describe("taishin provider parser", () => {
  it("detects the trade date from official PCF HTML", () => {
    expect(detectTaishinPcfTradeDate(rawBody)).toBe("2026-05-18");
  });

  it("parses holdings from the official server-rendered stock table", () => {
    const holdings = parseTaishinHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "3017",
      stockName: "奇鋐",
      shares: 86_000,
      lots: 86,
      weight: 6.4274
    });
    expect(holdings[1]?.marketValue).toBeCloseTo(203_849_694.42, 2);
  });

  it("parses summary from the official PCF announcement table", () => {
    expect(parseTaishinSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-18",
      nav: 16.54,
      totalUnits: 198_643_000,
      fundSize: 3_284_825_396,
      netCreationUnits: -2_000_000,
      stockRatio: 96.3909
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "taishin",
      etfCode: "00987A",
      tradeDate: "2026-05-18",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeTaishinHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00987A",
      tradeDate: "2026-05-18",
      sourceProvider: "taishin"
    });
    expect(normalizeTaishinSummary(summaryRaw)).toMatchObject({
      etfCode: "00987A",
      tradeDate: "2026-05-18",
      sourceProvider: "taishin"
    });
  });
});

import { describe, expect, it } from "vitest";
import { detectMegaTradeDate, parseMegaHoldings, parseMegaSummary } from "../../src/providers/mega/parser.js";
import { normalizeMegaHoldings, normalizeMegaSummary } from "../../src/providers/mega/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = `
  <div class="title-info"><p>資料來源：兆豐投信，2026/05/18</p></div>
  <div class="subtilte-item bg-gray">
    <div class="si-title">淨資產價值</div>
    <div class="si-amount">4,593,140,633</div>
  </div>
  <div class="subtilte-item">
    <div class="si-title">在外流通單位數</div>
    <div class="si-amount">335,399,000</div>
  </div>
  <div class="subtilte-item">
    <div class="si-title">每單位淨值</div>
    <div class="si-amount">13.69</div>
  </div>
  <div class="fund-title">股票 ( 94.66% )</div>
  <div id="fund_content_list_1" class="funInTable-box mb_30">
    <div class="fund-title-box">
      <div class="filed-name">股票代號</div>
      <div class="filed-name">股票名稱</div>
      <div class="filed-name txt-right">股數</div>
      <div class="filed-name txt-right">持股權重</div>
    </div>
    <div class="fund-info content-list-1">
      <div class="fund-content">2330</div>
      <div class="fund-content">台積電              </div>
      <div class="fund-content txt-right">179,000</div>
      <div class="fund-content txt-right">8.73 %</div>
    </div>
    <div class="fund-info content-list-1">
      <div class="fund-content">2454</div>
      <div class="fund-content">聯發科              </div>
      <div class="fund-content txt-right">76,000</div>
      <div class="fund-content txt-right">5.63 %</div>
    </div>
  </div>
  <!-- mobile -->
`;

const fetchResult = {
  url: "https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx?id=23",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "text/html",
  rawBody
};

describe("mega provider parser", () => {
  it("parses the official product page summary", () => {
    expect(detectMegaTradeDate(rawBody)).toBe("2026-05-18");
    expect(parseMegaSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-18",
      nav: 13.69,
      totalUnits: 335399000,
      fundSize: 4593140633,
      stockRatio: 94.66
    });
  });

  it("parses stock holdings from the product page table", () => {
    const holdings = parseMegaHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 179000,
      lots: 179,
      weight: 8.73
    });
    expect(holdings[0].marketValue).toBeCloseTo(400981177.26, 2);
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "mega",
      etfCode: "00996A",
      tradeDate: "2026-05-18",
      dataType: "holdings",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeMegaHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00996A",
      tradeDate: "2026-05-18",
      sourceProvider: "mega"
    });
    expect(normalizeMegaSummary(summaryRaw)).toMatchObject({
      etfCode: "00996A",
      tradeDate: "2026-05-18",
      sourceProvider: "mega"
    });
  });
});

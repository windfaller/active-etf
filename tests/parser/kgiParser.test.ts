import { describe, expect, it } from "vitest";
import { detectKgiPcfTradeDate, parseKgiHoldings, parseKgiSummary } from "../../src/providers/kgi/parser.js";
import { normalizeKgiHoldings, normalizeKgiSummary } from "../../src/providers/kgi/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = `
<div class="FundOverviewDiv">
  <input id="DataDate" name="DataDate" type="hidden" value="2026/06/29" />
  <p class="showfund" data-fundid="J024">&#x4E3B;&#x52D5;&#x51F1;&#x57FA;&#x53F0;&#x7063;(00407A)</p>
  <ul class="w-100 list-style-striped Redemption">
    <li><span>&#x57FA;&#x91D1;&#x6DE8;&#x8CC7;&#x7522;&#x50F9;&#x503C;(&#x5143;)</span><span>TWD$22,009,908,545</span></li>
    <li><span>&#x5DF2;&#x767C;&#x884C;&#x53D7;&#x76CA;&#x6B0A;&#x55AE;&#x4F4D;&#x7E3D;&#x6578;</span><span>2,342,239,000</span></li>
    <li><span>&#x8207;&#x524D;&#x65E5;&#x5DF2;&#x767C;&#x884C;&#x55AE;&#x4F4D;&#x5DEE;&#x7570;&#x6578;</span><span>553,000,000</span></li>
    <li><span>(2026/06/26)&#x6BCF;&#x53D7;&#x76CA;&#x6B0A;&#x55AE;&#x4F4D;&#x6DE8;&#x8CC7;&#x7522;&#x50F9;&#x503C;(&#x5143;)</span><span>TWD$9.4</span></li>
  </ul>
  <table class="responsive-table responsive-table--md js-table-0">
    <thead>
      <tr>
        <th>&#x80A1;&#x7968;&#x4EE3;&#x865F;</th>
        <th>&#x80A1;&#x7968;&#x540D;&#x7A31;</th>
        <th>&#x80A1;&#x6578;</th>
        <th>&#x6B0A;&#x91CD;(%)</th>
      </tr>
    </thead>
    <tbody>
      <tr name="content"><td>2330</td><td>&#x53F0;&#x7A4D;&#x96FB;</td><td>865,000</td><td>9.20</td></tr>
      <tr name="content" style="display:none"><td>2454</td><td>&#x806F;&#x767C;&#x79D1;</td><td>386,000</td><td>6.80</td></tr>
    </tbody>
  </table>
</div>`;

const fetchResult = {
  url: "https://www.kgifund.com.tw/Fund/RedemptionVC",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: "fundID=J024&queryDate=2026%2F06%2F29",
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "text/html",
  rawBody
};

describe("kgi provider parser", () => {
  it("detects the holdings trade date from the NAV label", () => {
    expect(detectKgiPcfTradeDate(rawBody)).toBe("2026-06-26");
  });

  it("parses summary from the official redemption partial", () => {
    expect(parseKgiSummary(rawBody)).toMatchObject({
      tradeDate: "2026-06-26",
      announcementDate: "2026-06-29",
      nav: 9.4,
      totalUnits: 2_342_239_000,
      fundSize: 22_009_908_545,
      netCreationUnits: 553_000_000,
      stockRatio: 16
    });
  });

  it("parses visible and hidden stock rows", () => {
    const holdings = parseKgiHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 865_000,
      lots: 865,
      weight: 9.2
    });
    expect(holdings[0]?.marketValue).toBeCloseTo(2_024_911_586.14, 2);
    expect(holdings[1]).toMatchObject({
      stockId: "2454",
      stockName: "聯發科",
      shares: 386_000,
      weight: 6.8
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "kgi",
      etfCode: "00407A",
      tradeDate: "2026-06-26",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeKgiHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00407A",
      tradeDate: "2026-06-26",
      sourceProvider: "kgi"
    });
    expect(normalizeKgiSummary(summaryRaw)).toMatchObject({
      etfCode: "00407A",
      tradeDate: "2026-06-26",
      stockRatio: 16,
      cashRatio: 84,
      sourceProvider: "kgi"
    });
  });
});

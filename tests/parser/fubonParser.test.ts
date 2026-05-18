import { describe, expect, it } from "vitest";
import { detectFubonTradeDate, parseFubonHoldings, parseFubonSummary } from "../../src/providers/fubon/parser.js";
import { normalizeFubonHoldings, normalizeFubonSummary } from "../../src/providers/fubon/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = `
  <p class="f13 txt_black_A5A5 tar">資料日期：2026/05/15</p>
  <li><p>基金淨資產(新台幣)</p><p>842,649,839</p></li>
  <li><p>基金在外流通單位數(單位)</p><p>85,229,000</p></li>
  <li><p>基金每單位淨值(新台幣)</p><p>9.8869</p></li>
  <table class="table1 fix3 darkblue lastdark w1360 xoverscroll blue_t">
    <tbody>
      <tr class="title"><td>債券代碼</td><td>債券名稱</td><td>面額</td><td>金額</td><td>權重(%)</td></tr>
      <tr><td class="tac">US172967EW71</td><td>C 8 1/8 07/15/39</td><td>600,000</td><td>23,384,842</td><td>2.7751</td></tr>
      <tr><td class="tac"><span class="txt_bold6">債券合計</span></td><td></td><td></td><td>655,883,606</td><td></td></tr>
    </tbody>
  </table>
  <table class="table1 fix3 darkblue lastdark w1360 xoverscroll blue_t">
    <tbody>
      <tr class="title"><td>基金代碼</td><td>基金名稱</td><td>單位數</td><td>金額</td><td>權重(%)</td></tr>
      <tr><td class="tac">LQDW US</td><td>ISHARES INVESTMENT GRADE CORPO</td><td>100,000</td><td>74,864,090</td><td>8.8843</td></tr>
      <tr><td class="tac"><span class="txt_bold6">基金合計</span></td><td></td><td></td><td>143,515,785</td><td>17.0314</td></tr>
    </tbody>
  </table>
`;

const fetchResult = {
  url: "https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?stkId=00982D",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "text/html",
  rawBody
};

describe("fubon provider parser", () => {
  it("parses the official assets page summary", () => {
    expect(detectFubonTradeDate(rawBody)).toBe("2026-05-15");
    expect(parseFubonSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 9.8869,
      totalUnits: 85229000,
      fundSize: 842649839
    });
  });

  it("parses bond and fund holdings", () => {
    const holdings = parseFubonHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "US172967EW71",
      stockName: "C 8 1/8 07/15/39",
      shares: 600000,
      lots: 600,
      marketValue: 23384842,
      weight: 2.7751
    });
    expect(holdings[1]).toMatchObject({
      stockId: "LQDW US",
      stockName: "ISHARES INVESTMENT GRADE CORPO"
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "fubon",
      etfCode: "00982D",
      tradeDate: "2026-05-15",
      dataType: "holdings",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeFubonHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00982D",
      tradeDate: "2026-05-15",
      sourceProvider: "fubon"
    });
    expect(normalizeFubonSummary(summaryRaw)).toMatchObject({
      etfCode: "00982D",
      tradeDate: "2026-05-15",
      sourceProvider: "fubon"
    });
  });
});

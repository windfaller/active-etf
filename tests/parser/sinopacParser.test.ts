import { describe, expect, it } from "vitest";
import { normalizeSinopacHoldings, normalizeSinopacSummary } from "../../src/providers/sinopac/normalizer.js";
import { detectSinopacPcfTradeDate, parseSinopacHoldings, parseSinopacSummary } from "../../src/providers/sinopac/parser.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = `
<h4>與前日已發行單位差異數</h4><div><p>-17,000,000</p></div>
<p class="cash_p">資料日期：2026/08/07</p>
<table class="tab_sh tab_sh-w tab_fu-09"><tbody>
  <tr><td>基金淨資產價值(元)</td><td>NT$&nbsp;1,729,928,119</td></tr>
  <tr><td>基金在外流通單位數</td><td>162,860,000</td></tr>
  <tr><td>基金每單位淨值(元)</td><td>NT$&nbsp;10.62</td></tr>
</tbody></table>
<div class="cash_title-s">股票</div>
<table class="tab_sh tab_sh-w tab_fu-07"><tbody>
  <tr><th>證券代碼</th><th>證券名稱</th><th>股數</th><th>佔基金淨資產之權重(%)</th></tr>
  <tr><td>2330</td><td>台積電</td><td>50,000</td><td>6.86</td></tr>
  <tr><td>3491</td><td>昇達科</td><td>80,000</td><td>5.71</td></tr>
</tbody></table>`;

const fetchResult = {
  url: "https://sitc.sinopac.com/SinopacEtfs/Etfs/Pcf/00410A",
  method: "POST" as const,
  requestHeaders: {},
  requestBody: "fundId=00410A&hDate=2026-08-10&op=1",
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "text/html",
  rawBody
};

describe("sinopac provider parser", () => {
  it("parses the official PCF summary and holdings", () => {
    expect(detectSinopacPcfTradeDate(rawBody)).toBe("2026-08-07");
    expect(parseSinopacHoldings(rawBody)[0]).toMatchObject({
      stockId: "2330",
      stockName: "台積電",
      shares: 50_000,
      lots: 50,
      weight: 6.86
    });
    expect(parseSinopacSummary(rawBody)).toMatchObject({
      tradeDate: "2026-08-07",
      nav: 10.62,
      totalUnits: 162_860_000,
      fundSize: 1_729_928_119,
      netCreationUnits: -17_000_000
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "sinopac",
      etfCode: "00410A",
      tradeDate: "2026-08-07",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = { ...holdingRaw, dataType: "summary" };

    expect(normalizeSinopacHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00410A",
      tradeDate: "2026-08-07",
      sourceProvider: "sinopac"
    });
    expect(normalizeSinopacSummary(summaryRaw)).toMatchObject({
      etfCode: "00410A",
      tradeDate: "2026-08-07",
      nav: 10.62,
      sourceProvider: "sinopac"
    });
  });
});

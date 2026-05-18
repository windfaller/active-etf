import { describe, expect, it } from "vitest";
import {
  detectAllianceBernsteinTradeDate,
  parseAllianceBernsteinHoldings,
  parseAllianceBernsteinSummary
} from "../../src/providers/allianceBernstein/parser.js";
import {
  normalizeAllianceBernsteinHoldings,
  normalizeAllianceBernsteinSummary
} from "../../src/providers/allianceBernstein/normalizer.js";
import type { RawHoldingResponse, RawSummaryResponse } from "../../src/providers/types.js";

const rawBody = JSON.stringify({
  holdings: {
    domesticHoldings: [
      {
        asOfDate: "05/15/2026",
        holdingCategory: "holdings-section-futures",
        holdings: [
          {
            holding: "US 10YR NOTE (CBT)JUN26 18-JUN-2026",
            holdingPerc: "3.072219526",
            holdingCode: "",
            holdingShares: 20,
            holdingValue: 2183437.5
          }
        ]
      },
      {
        asOfDate: "05/15/2026",
        holdingCategory: "holdings-section-bond",
        holdings: [
          {
            holding: "ROCKET SOFTWARE INC SER 144A 9% 28NOV2028",
            holdingPerc: "0.085487",
            holdingCode: "US77314EAB48",
            holdingShares: 61000,
            holdingValue: 60756.1
          }
        ]
      }
    ]
  },
  basket: {
    asOfDate: "2026-05-15",
    nav: 10.0079,
    aum: 2242340966,
    shares: 224057000,
    sharesChange: 0,
    announcementDate: "2026-05-19"
  }
});

const fetchResult = {
  url: "https://webapi.alliancebernstein.com/v2/funds/tw/zh-tw/investor/TW00000984D0/holdings",
  method: "GET" as const,
  requestHeaders: {},
  responseStatus: 200,
  responseHeaders: {},
  rawContentType: "application/json",
  rawBody
};

describe("allianceBernstein provider parser", () => {
  it("parses basket summary", () => {
    expect(detectAllianceBernsteinTradeDate(rawBody)).toBe("2026-05-15");
    expect(parseAllianceBernsteinSummary(rawBody)).toMatchObject({
      tradeDate: "2026-05-15",
      nav: 10.0079,
      totalUnits: 224057000,
      fundSize: 2242340966,
      netCreationUnits: 0
    });
  });

  it("parses holdings across futures and bond categories", () => {
    const holdings = parseAllianceBernsteinHoldings(rawBody);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      stockId: "futures-1",
      stockName: "US 10YR NOTE (CBT)JUN26 18-JUN-2026",
      shares: 20,
      weight: 3.072219526,
      marketValue: 2183437.5
    });
    expect(holdings[1]).toMatchObject({
      stockId: "US77314EAB48",
      stockName: "ROCKET SOFTWARE INC SER 144A 9% 28NOV2028",
      shares: 61000
    });
  });

  it("normalizes to the shared provider format", () => {
    const holdingRaw: RawHoldingResponse = {
      providerId: "allianceBernstein",
      etfCode: "00984D",
      tradeDate: "2026-05-15",
      dataType: "pcf",
      fetchResult
    };
    const summaryRaw: RawSummaryResponse = {
      ...holdingRaw,
      dataType: "summary"
    };

    expect(normalizeAllianceBernsteinHoldings(holdingRaw)[0]).toMatchObject({
      etfCode: "00984D",
      tradeDate: "2026-05-15",
      sourceProvider: "allianceBernstein"
    });
    expect(normalizeAllianceBernsteinSummary(summaryRaw)).toMatchObject({
      etfCode: "00984D",
      tradeDate: "2026-05-15",
      sourceProvider: "allianceBernstein"
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseTwseActiveEtfProducts } from "../../src/services/discovery/twseActiveEtfParser.js";

const rawBody = JSON.stringify({
  status: "success",
  data: [
    {
      stockNo: "00403A",
      stockName: "主動統一升級50",
      listingDate: "2026.05.12",
      indexName: "臺灣證券交易所發行量加權股價報酬指數",
      totalAv: "1,564",
      close1: "9.84",
      holders: "937,990",
      valueYTD: "25,022.519",
      volumeYTD: "2,418,041,511",
      issuer: "統一證券投資信託股份有限公司"
    },
    {
      stockNo: "00997A",
      stockName: "主動群益美國增長",
      listingDate: "2026.04.14",
      indexName: "無",
      totalAv: "128",
      close1: "12.19",
      holders: "63,493",
      valueYTD: "582.034",
      volumeYTD: "52,266,248",
      issuer: "群益證券投資信託股份有限公司"
    }
  ]
});

describe("TWSE active ETF product parser", () => {
  it("parses ETFortune active ETF product rows", () => {
    expect(parseTwseActiveEtfProducts(rawBody)).toEqual([
      {
        etfCode: "00403A",
        stockName: "主動統一升級50",
        listingDate: "2026-05-12",
        issuer: "統一證券投資信託股份有限公司",
        indexName: "臺灣證券交易所發行量加權股價報酬指數",
        totalAssetValue: 1564,
        closePrice: 9.84,
        holders: 937990,
        valueYtd: 25022.519,
        volumeYtd: 2418041511
      },
      {
        etfCode: "00997A",
        stockName: "主動群益美國增長",
        listingDate: "2026-04-14",
        issuer: "群益證券投資信託股份有限公司",
        indexName: "無",
        totalAssetValue: 128,
        closePrice: 12.19,
        holders: 63493,
        valueYtd: 582.034,
        volumeYtd: 52266248
      }
    ]);
  });
});

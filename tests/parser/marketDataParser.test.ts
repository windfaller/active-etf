import { describe, expect, it } from "vitest";
import {
  parseTpexDailyMarket,
  parseTpexInstitutionalFlows,
  parseTwseDailyMarket,
  parseTwseInstitutionalFlows
} from "../../src/services/parser/marketDataParser.js";

describe("market data parser", () => {
  it("parses TWSE daily quote rows from MI_INDEX", () => {
    const rawBody = JSON.stringify({
      stat: "OK",
      tables: [
        { title: "indices", fields: ["指數"], data: [] },
        {
          title: "每日收盤行情",
          fields: [
            "證券代號",
            "證券名稱",
            "成交股數",
            "成交筆數",
            "成交金額",
            "開盤價",
            "最高價",
            "最低價",
            "收盤價",
            "漲跌(+/-)",
            "漲跌價差"
          ],
          data: [["2330", "台積電", "30,000", "4,200", "28,500,000", "950.00", "960.00", "945.00", "955.00", "+", "5.00"]]
        }
      ]
    });

    expect(parseTwseDailyMarket(rawBody, "2026-05-18")[0]).toMatchObject({
      tradeDate: "2026-05-18",
      stockId: "2330",
      market: "TWSE",
      closePrice: 955,
      change: 5,
      changePercent: 0.53,
      turnover: 28500000
    });
  });

  it("parses TPEx daily quote rows", () => {
    const rawBody = JSON.stringify({
      stat: "ok",
      tables: [
        {
          title: "上櫃股票每日收盤行情(不含定價)",
          fields: ["代號", "名稱", "收盤 ", "漲跌", "開盤 ", "最高 ", "最低", "成交股數  ", " 成交金額(元)", " 成交筆數 "],
          data: [["8299", "群聯", "2,735.00", "+85.00", "2,585.00", "2,755.00", "2,570.00", "7,957,000", "21,237,780,000", "6,510"]]
        }
      ]
    });

    expect(parseTpexDailyMarket(rawBody, "2026-05-18")[0]).toMatchObject({
      stockId: "8299",
      market: "TPEx",
      closePrice: 2735,
      change: 85,
      changePercent: 3.21,
      volumeShares: 7957000
    });
  });

  it("parses TWSE institutional flows", () => {
    const rawBody = JSON.stringify({
      stat: "OK",
      fields: [
        "證券代號",
        "證券名稱",
        "外陸資買進股數(不含外資自營商)",
        "外陸資賣出股數(不含外資自營商)",
        "外陸資買賣超股數(不含外資自營商)",
        "外資自營商買進股數",
        "外資自營商賣出股數",
        "外資自營商買賣超股數",
        "投信買進股數",
        "投信賣出股數",
        "投信買賣超股數",
        "自營商買賣超股數",
        "三大法人買賣超股數"
      ],
      data: [["2330", "台積電", "10,000", "3,000", "7,000", "1,000", "500", "500", "8,000", "2,000", "6,000", "-1,000", "12,500"]]
    });

    expect(parseTwseInstitutionalFlows(rawBody, "2026-05-18")[0]).toMatchObject({
      stockId: "2330",
      foreignNetShares: 7500,
      investmentTrustNetShares: 6000,
      dealerNetShares: -1000,
      totalNetShares: 12500
    });
  });

  it("parses TPEx institutional flows by official grouped column order", () => {
    const rawBody = JSON.stringify({
      stat: "ok",
      tables: [
        {
          title: "三大法人買賣明細資訊",
          data: [
            [
              "8299",
              "群聯",
              "2,752,132",
              "3,261,319",
              "-509,187",
              "0",
              "0",
              "0",
              "2,752,132",
              "3,261,319",
              "-509,187",
              "56,000",
              "90,000",
              "-34,000",
              "126,382",
              "123,104",
              "3,278",
              "262,528",
              "252,060",
              "10,468",
              "388,910",
              "375,164",
              "13,746",
              "-529,441"
            ]
          ]
        }
      ]
    });

    expect(parseTpexInstitutionalFlows(rawBody, "2026-05-18")[0]).toMatchObject({
      stockId: "8299",
      foreignNetShares: -509187,
      investmentTrustNetShares: -34000,
      dealerNetShares: 13746,
      totalNetShares: -529441
    });
  });
});

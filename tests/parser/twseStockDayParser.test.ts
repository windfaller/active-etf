import { describe, expect, it } from "vitest";
import { parseTwseStockDayClosingPrice } from "../../src/services/parser/twseStockDayParser.js";

describe("twse stock day parser", () => {
  it("parses ETF closing price by trade date", () => {
    const rawBody = JSON.stringify({
      stat: "OK",
      fields: ["日期", "成交股數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌價差", "成交筆數", "註記"],
      data: [
        ["115/05/14", "317,424,000", "9,353,000,000", "29.40", "29.84", "29.24", "29.44", "+0.16", "83,596", ""],
        ["115/05/15", "243,460,000", "6,950,000,000", "29.11", "29.18", "28.42", "28.42", "-1.02", "88,005", ""]
      ]
    });

    expect(parseTwseStockDayClosingPrice(rawBody, "2026-05-15")).toEqual({
      tradeDate: "2026-05-15",
      closePrice: 28.42
    });
  });
});

import { describe, expect, it } from "vitest";
import { calculateFundPerformance, parseNasdaqPriceHistory } from "../../src/services/performance/fundPerformanceService.js";

describe("fund performance calculations", () => {
  it("calculates recent returns from effective market dates", () => {
    const result = calculateFundPerformance([
      { date: "2026-05-14", price: 80 },
      { date: "2026-07-15", price: 90 },
      { date: "2026-08-07", price: 96 },
      { date: "2026-08-13", price: 99 },
      { date: "2026-08-14", price: 100 }
    ]);

    expect(result).toEqual({
      current: { date: "2026-08-14", price: 100 },
      observations: 5,
      returns: { d1: 1.01, w1: 4.17, m1: 11.11, m3: 25 }
    });
  });

  it("does not invent a period return when the comparison date is too far away", () => {
    const result = calculateFundPerformance([
      { date: "2026-05-01", price: 80 },
      { date: "2026-08-13", price: 99 },
      { date: "2026-08-14", price: 100 }
    ]);

    expect(result?.returns).toEqual({ d1: 1.01, w1: null, m1: null, m3: null });
  });

  it("parses Nasdaq rows and ignores invalid prices", () => {
    expect(parseNasdaqPriceHistory({
      data: { tradesTable: { rows: [
        { date: "08/14/2026", close: "$57.32" },
        { date: "08/13/2026", close: "56.93" },
        { date: "bad", close: "-" }
      ] } }
    })).toEqual([
      { date: "2026-08-14", price: 57.32 },
      { date: "2026-08-13", price: 56.93 }
    ]);
  });
});

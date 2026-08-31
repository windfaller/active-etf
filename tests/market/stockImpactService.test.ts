import { describe, expect, it } from "vitest";
import type { EtfHoldingChange } from "../../src/models/EtfHoldingChange.js";
import { preferredStockName, stockImpactsForDate } from "../../src/services/market/stockImpactService.js";

function change(stockName: string): EtfHoldingChange {
  return {
    etfCode: "00981A",
    tradeDate: "2026-07-17",
    stockId: "2886",
    stockName,
    prevTradeDate: "2026-07-16",
    prevShares: 1_000,
    currentShares: 2_000,
    diffShares: 1_000,
    diffLots: 1,
    diffPct: 100,
    prevWeight: 1,
    currentWeight: 1.2,
    diffWeightPoint: 0.2,
    prevTotalUnits: 1,
    currentTotalUnits: 1,
    scaleRatio: null,
    expectedSharesByScale: null,
    activeDiffShares: 1_000,
    activeDiffLots: 1,
    activeDiffPct: 100,
    activeSignalScore: 1,
    status: "increase",
    createdAt: new Date("2026-07-17T00:00:00Z"),
    updatedAt: new Date("2026-07-17T00:00:00Z")
  };
}

describe("stock impact display names", () => {
  it("prefers a Chinese name when providers disagree", () => {
    expect(preferredStockName("MEGA FINANCIAL HLDGS CO LTD", "兆豐金")).toBe("兆豐金");
    expect(preferredStockName("VANGUARD INTERNATIONAL SEMICONDUCTOR", "世界")).toBe("世界");
  });

  it("uses the official market name to enrich an English provider holding name", async () => {
    const marketRow = {
      tradeDate: "2026-07-17",
      stockId: "2886",
      stockName: "兆豐金",
      market: "TWSE",
      openPrice: 40,
      highPrice: 41,
      lowPrice: 39,
      closePrice: 40,
      change: 0,
      changePercent: 0,
      volumeShares: 1_000,
      turnover: 40_000,
      transactionCount: 10,
      source: "TWSE",
      createdAt: new Date("2026-07-17T00:00:00Z"),
      updatedAt: new Date("2026-07-17T00:00:00Z")
    };
    const collection = (name: string) => ({
      find: () => ({
        toArray: async () => name === "stock_daily_market" ? [marketRow] : []
      })
    });

    const result = await stockImpactsForDate(
      { collection } as never,
      "2026-07-17",
      [change("MEGA FINANCIAL HLDGS CO LTD")]
    );

    expect(result.impacts[0]?.stockName).toBe("兆豐金");
    expect(result.sectorSummary.sectors[0]?.topStocks[0]?.stockName).toBe("兆豐金");
  });

  it("does not treat raw share growth as active buying when fund-unit correction is unavailable", async () => {
    const missingScale = { ...change("兆豐金"), activeDiffShares: null, activeDiffLots: null, activeDiffPct: null, prevTotalUnits: null, currentTotalUnits: null };
    const collection = () => ({ find: () => ({ toArray: async () => [] }) });
    const result = await stockImpactsForDate({ collection } as never, "2026-07-17", [missingScale]);

    expect(result.impacts[0]).toMatchObject({
      totalDiffLots: 1,
      totalActiveDiffLots: 0,
      increaseEtfCount: 0,
      decreaseEtfCount: 0
    });
    expect(result.impacts[0]?.etfs[0]?.activeDiffLots).toBeNull();
  });
});

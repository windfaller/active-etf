import { describe, expect, it } from "vitest";
import type { EtfHoldingChange } from "../../src/models/EtfHoldingChange.js";
import { buildTagMovementRows } from "../../src/services/sector/tagMovementService.js";

function change(input: Partial<EtfHoldingChange> & Pick<EtfHoldingChange, "stockId" | "stockName">): EtfHoldingChange {
  return {
    etfCode: "00981A",
    tradeDate: "2026-06-24",
    stockId: input.stockId,
    stockName: input.stockName,
    prevTradeDate: "2026-06-23",
    prevShares: 0,
    currentShares: 0,
    diffShares: input.diffShares ?? 0,
    diffLots: input.diffLots ?? 0,
    diffPct: null,
    prevWeight: null,
    currentWeight: input.currentWeight ?? null,
    diffWeightPoint: input.diffWeightPoint ?? null,
    prevTotalUnits: null,
    currentTotalUnits: null,
    scaleRatio: null,
    expectedSharesByScale: null,
    activeDiffShares: input.activeDiffShares ?? null,
    activeDiffLots: input.activeDiffLots ?? null,
    activeDiffPct: null,
    activeSignalScore: null,
    status: input.status ?? "increase",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("ETF tag movement rows", () => {
  it("aggregates manager movement by theme tag", () => {
    const rows = buildTagMovementRows([
      change({ stockId: "2383", stockName: "台光電", activeDiffLots: 100, diffWeightPoint: 0.2, currentWeight: 3.1 }),
      change({ stockId: "3017", stockName: "奇鋐", activeDiffLots: 50, diffWeightPoint: 0.1, currentWeight: 2.4 }),
      change({ stockId: "1519", stockName: "華城", activeDiffLots: -20, diffWeightPoint: -0.05, currentWeight: 1.3 })
    ]);

    expect(rows.find((row) => row.tag === "AI")).toMatchObject({
      direction: "increase",
      stockCount: 2,
      increaseStockCount: 2,
      totalActiveDiffLots: 150
    });
    expect(rows.find((row) => row.tag === "電力設備")).toMatchObject({
      direction: "decrease",
      stockCount: 1,
      decreaseStockCount: 1,
      totalActiveDiffLots: -20
    });
  });
});

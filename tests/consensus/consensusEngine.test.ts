import { describe, expect, it } from "vitest";
import type { EtfHoldingChange } from "../../src/models/EtfHoldingChange.js";
import { buildConsensusRows } from "../../src/services/consensus/consensusEngine.js";
import { buildSectorFlowRows } from "../../src/services/sector/sectorFlowEngine.js";

function change(input: Partial<EtfHoldingChange> & Pick<EtfHoldingChange, "etfCode" | "stockId" | "stockName">): EtfHoldingChange {
  return {
    etfCode: input.etfCode,
    tradeDate: "2026-05-15",
    stockId: input.stockId,
    stockName: input.stockName,
    prevTradeDate: "2026-05-14",
    prevShares: 0,
    currentShares: 0,
    diffShares: 0,
    diffLots: 0,
    diffPct: null,
    prevWeight: null,
    currentWeight: input.currentWeight ?? null,
    diffWeightPoint: input.diffWeightPoint ?? null,
    prevTotalUnits: null,
    currentTotalUnits: null,
    scaleRatio: null,
    expectedSharesByScale: null,
    activeDiffShares: null,
    activeDiffLots: input.activeDiffLots ?? null,
    activeDiffPct: null,
    activeSignalScore: null,
    status: "increase",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("consensus and sector engines", () => {
  it("aggregates stock consensus across ETFs", () => {
    const rows = buildConsensusRows(
      [
        change({ etfCode: "00981A", stockId: "2383", stockName: "台光電", activeDiffLots: 100, diffWeightPoint: 0.2 }),
        change({ etfCode: "00403A", stockId: "2383", stockName: "台光電", activeDiffLots: 50, diffWeightPoint: 0.1 }),
        change({ etfCode: "00980A", stockId: "3017", stockName: "奇鋐", activeDiffLots: -10, diffWeightPoint: -0.05 })
      ],
      "2026-05-15"
    );

    expect(rows[0]).toMatchObject({
      stockId: "2383",
      etfCount: 2,
      increaseEtfCount: 2,
      totalActiveDiffLots: 150,
      totalDiffWeightPoint: 0.3
    });
  });

  it("aggregates sector flow from mapped stocks", () => {
    const rows = buildSectorFlowRows(
      [
        change({ etfCode: "00981A", stockId: "2383", stockName: "台光電", activeDiffLots: 100, diffWeightPoint: 0.2 }),
        change({ etfCode: "00403A", stockId: "3037", stockName: "欣興", activeDiffLots: 50, diffWeightPoint: 0.1 })
      ],
      "2026-05-15"
    );

    expect(rows[0]).toMatchObject({
      sector: "PCB",
      stockCount: 2,
      etfCount: 2,
      totalActiveDiffLots: 150,
      totalDiffWeightPoint: 0.3
    });
  });
});

import { describe, expect, it } from "vitest";
import { applyActiveSignal, activeThreshold } from "../../src/services/calculator/activeSignalCalculator.js";
import { calculateHoldingChange } from "../../src/services/calculator/changeCalculator.js";

describe("activeSignalCalculator", () => {
  it("uses max of one lot or 0.1 percent as active threshold", () => {
    expect(activeThreshold(500_000)).toBe(1000);
    expect(activeThreshold(2_000_000)).toBe(2000);
  });

  it("scores active increase, weight increase, active percent, and consecutive days", () => {
    const base = calculateHoldingChange({
      etfCode: "00981A",
      tradeDate: "2026-05-15",
      previous: {
        stockId: "2383",
        stockName: "台光電",
        shares: 1_000_000,
        weight: 8,
        tradeDate: "2026-05-14"
      },
      current: {
        stockId: "2383",
        stockName: "台光電",
        shares: 1_120_000,
        weight: 8.5
      },
      prevTotalUnits: 100_000_000,
      currentTotalUnits: 100_000_000
    });

    const change = applyActiveSignal(base, { consecutiveIncreaseDays: 3 });

    expect(change.activeDiffPct).toBe(12);
    expect(change.activeSignalScore).toBe(100);
  });

  it("preserves exit status after active-signal enrichment", () => {
    const base = calculateHoldingChange({
      etfCode: "00981A",
      tradeDate: "2026-05-15",
      previous: {
        stockId: "2337",
        stockName: "旺宏",
        shares: 8_000,
        weight: 0,
        tradeDate: "2026-05-14"
      },
      current: null,
      prevTotalUnits: 100_000_000,
      currentTotalUnits: 100_000_000
    });

    const change = applyActiveSignal(base);

    expect(change.status).toBe("exit");
    expect(change.currentShares).toBe(0);
    expect(change.activeDiffPct).toBe(-100);
  });
});

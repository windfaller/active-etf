import { describe, expect, it } from "vitest";
import { applyActiveSignal } from "../../src/services/calculator/activeSignalCalculator.js";
import { calculateHoldingChange } from "../../src/services/calculator/changeCalculator.js";

const now = new Date("2026-05-17T00:00:00.000Z");

function changeFor(input: {
  prevShares?: number;
  currentShares?: number;
  prevWeight?: number | null;
  currentWeight?: number | null;
  prevTotalUnits?: number | null;
  currentTotalUnits?: number | null;
}) {
  return calculateHoldingChange({
    etfCode: "00981A",
    tradeDate: "2026-05-15",
    previous:
      input.prevShares === undefined
        ? null
        : {
            stockId: "2383",
            stockName: "台光電",
            shares: input.prevShares,
            weight: input.prevWeight ?? null,
            tradeDate: "2026-05-14"
          },
    current:
      input.currentShares === undefined
        ? null
        : {
            stockId: "2383",
            stockName: "台光電",
            shares: input.currentShares,
            weight: input.currentWeight ?? null
          },
    prevTotalUnits: input.prevTotalUnits ?? null,
    currentTotalUnits: input.currentTotalUnits ?? null,
    now
  });
}

describe("calculateHoldingChange", () => {
  it("calculates normal increase", () => {
    const change = changeFor({ prevShares: 1_000_000, currentShares: 1_200_000 });

    expect(change.status).toBe("increase");
    expect(change.diffShares).toBe(200_000);
    expect(change.diffLots).toBe(200);
    expect(change.diffPct).toBe(20);
  });

  it("calculates normal decrease", () => {
    const change = changeFor({ prevShares: 1_000_000, currentShares: 800_000 });

    expect(change.status).toBe("decrease");
    expect(change.diffShares).toBe(-200_000);
    expect(change.diffLots).toBe(-200);
    expect(change.diffPct).toBe(-20);
  });

  it("detects new holdings", () => {
    const change = changeFor({ currentShares: 500_000 });

    expect(change.status).toBe("new");
    expect(change.prevShares).toBe(0);
    expect(change.currentShares).toBe(500_000);
    expect(change.diffPct).toBeNull();
  });

  it("detects exited holdings", () => {
    const change = changeFor({ prevShares: 500_000 });

    expect(change.status).toBe("exit");
    expect(change.prevShares).toBe(500_000);
    expect(change.currentShares).toBe(0);
  });

  it("detects passive share increase caused by ETF scale growth", () => {
    const change = applyActiveSignal(
      changeFor({
        prevShares: 1_000_000,
        currentShares: 1_100_000,
        prevTotalUnits: 100_000_000,
        currentTotalUnits: 110_000_000
      })
    );

    expect(change.diffShares).toBe(100_000);
    expect(change.activeDiffShares).toBe(0);
    expect(change.status).toBe("increase");
  });

  it("detects passive share decrease caused by ETF scale shrink", () => {
    const change = applyActiveSignal(
      changeFor({
        prevShares: 1_000_000,
        currentShares: 900_000,
        prevTotalUnits: 100_000_000,
        currentTotalUnits: 90_000_000
      })
    );

    expect(change.diffShares).toBe(-100_000);
    expect(change.activeDiffShares).toBe(0);
    expect(change.status).toBe("decrease");
  });

  it("detects apparent increase but active decrease", () => {
    const change = applyActiveSignal(
      changeFor({
        prevShares: 1_000_000,
        currentShares: 1_050_000,
        prevTotalUnits: 100_000_000,
        currentTotalUnits: 110_000_000
      })
    );

    expect(change.diffShares).toBe(50_000);
    expect(change.activeDiffShares).toBe(-50_000);
    expect(change.status).toBe("scale_adjusted_decrease");
  });

  it("detects apparent decrease but active increase", () => {
    const change = applyActiveSignal(
      changeFor({
        prevShares: 1_000_000,
        currentShares: 950_000,
        prevTotalUnits: 100_000_000,
        currentTotalUnits: 90_000_000
      })
    );

    expect(change.diffShares).toBe(-50_000);
    expect(change.activeDiffShares).toBe(50_000);
    expect(change.status).toBe("scale_adjusted_increase");
  });
});

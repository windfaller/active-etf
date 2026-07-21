import { describe, expect, it } from "vitest";
import type { EtfHoldingChange } from "../../src/models/EtfHoldingChange.js";
import { adjustmentWindows, globalDateAlignment } from "../../src/services/intelligence/etfComparisonService.js";

describe("ETF comparison adjustment semantics", () => {
  it("names row counts as holding-change counts and omits the old public keys", () => {
    const changes = [
      { tradeDate: "2026-07-21", activeDiffLots: 10, diffWeightPoint: 0.2 },
      { tradeDate: "2026-07-21", activeDiffLots: -5, diffWeightPoint: -0.1 },
      { tradeDate: "2026-07-18", activeDiffLots: 4, diffWeightPoint: 0.05 }
    ] as EtfHoldingChange[];
    const result = adjustmentWindows(changes, ["2026-07-21", "2026-07-18", "2026-07-17"])[0];
    expect(result).toMatchObject({ increaseHoldingChangeCount: 2, decreaseHoldingChangeCount: 1 });
    expect(result).not.toHaveProperty("increaseCount");
    expect(result).not.toHaveProperty("decreaseCount");
  });

  it("marks different global source dates as non-common and preserves every fetch time", () => {
    const mixed = globalDateAlignment([
      { code: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z" },
      { code: "HBMX", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z" }
    ]);
    expect(mixed).toEqual({
      commonDateOnly: false,
      commonDate: null,
      rows: [
        { code: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z" },
        { code: "HBMX", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z" }
      ]
    });
    expect(globalDateAlignment([
      { code: "DRAM", sourceAsOf: "2026-07-21" },
      { code: "HBMX", sourceAsOf: "2026-07-21" }
    ]).commonDate).toBe("2026-07-21");
  });
});

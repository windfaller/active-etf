import { describe, expect, it } from "vitest";
import {
  adjustmentIntensity,
  concentrationMetrics,
  confidenceForSignal,
  consensusFromDirections,
  consecutiveDirection,
  detectReversal,
  directionForChange,
  hasDirectionConflict,
  jaccardOverlap,
  percentileRank,
  relationBetweenEtfAndInstitution,
  weightedOverlap
} from "../../src/services/intelligence/calculations.js";

describe("P1 intelligence calculations", () => {
  it("treats tiny changes as neutral and missing measures as unknown", () => {
    expect(directionForChange({ activeDiffLots: 0.005, diffWeightPoint: 0.00005 })).toBe("neutral");
    expect(directionForChange({ activeDiffLots: null, diffWeightPoint: null })).toBe("unknown");
    expect(directionForChange({ activeDiffLots: 2, diffWeightPoint: 0 })).toBe("increase");
    expect(directionForChange({ activeDiffLots: -2, diffWeightPoint: 0 })).toBe("decrease");
    expect(directionForChange({ activeDiffLots: 2, diffWeightPoint: -1 })).toBe("increase");
    expect(directionForChange({ activeDiffLots: 0.005, diffWeightPoint: -1 })).toBe("decrease");
    expect(hasDirectionConflict({ activeDiffLots: 2, diffWeightPoint: -1 })).toBe(true);
    expect(hasDirectionConflict({ activeDiffLots: 0.005, diffWeightPoint: -1 })).toBe(false);
  });

  it("applies the P0 consensus rule without diluting the ratio by neutral rows", () => {
    const result = consensusFromDirections(["increase", "increase", "decrease", "neutral", "neutral"]);
    expect(result.hasConsensus).toBe(true);
    expect(result.directionalEtfCount).toBe(3);
    expect(result.neutralCount).toBe(2);
    expect(result.ratio).toBeCloseTo(2 / 3);
  });

  it("classifies ETF and institution alignment without converting unknown to zero", () => {
    expect(relationBetweenEtfAndInstitution("increase", 1000)).toBe("aligned");
    expect(relationBetweenEtfAndInstitution("increase", -1000)).toBe("divergent");
    expect(relationBetweenEtfAndInstitution("increase", null)).toBe("insufficient");
  });

  it("counts consecutive effective trading observations and requires a prior run for reversals", () => {
    const observations = [
      { date: "2026-07-21", direction: "increase" as const, activeNetLots: 12 },
      { date: "2026-07-18", direction: "decrease" as const, activeNetLots: -5 },
      { date: "2026-07-17", direction: "decrease" as const, activeNetLots: -6 }
    ];
    expect(consecutiveDirection(observations)).toMatchObject({ direction: "increase", tradingDays: 1, startDate: "2026-07-21" });
    expect(detectReversal(observations)).toMatchObject({ detected: true, from: "decrease", to: "increase", priorTradingDays: 2 });
    expect(detectReversal(observations.slice(0, 2))).toMatchObject({ detected: false, priorTradingDays: 1 });
  });

  it("interrupts a streak for both neutral and unknown while exposing missing coverage", () => {
    const withMissing = consecutiveDirection([
      { date: "2026-07-21", direction: "increase", activeNetLots: 10 },
      { date: "2026-07-18", direction: "unknown", activeNetLots: null },
      { date: "2026-07-17", direction: "increase", activeNetLots: 8 }
    ]);
    expect(withMissing).toMatchObject({ tradingDays: 1, actualObservationCount: 2, missingObservationCount: 1 });
    const withNeutral = consecutiveDirection([
      { date: "2026-07-21", direction: "increase", activeNetLots: 10 },
      { date: "2026-07-18", direction: "neutral", activeNetLots: 0 },
      { date: "2026-07-17", direction: "increase", activeNetLots: 8 }
    ]);
    expect(withNeutral).toMatchObject({ tradingDays: 1, actualObservationCount: 3, missingObservationCount: 0 });
    const twentyDayCoverage = consecutiveDirection(Array.from({ length: 20 }, (_, index) => ({
      date: `2026-07-${String(21 - index).padStart(2, "0")}`,
      direction: index >= 17 ? "unknown" as const : "increase" as const,
      activeNetLots: index >= 17 ? null : 1
    })));
    expect(twentyDayCoverage).toMatchObject({ actualObservationCount: 17, missingObservationCount: 3 });
  });

  it("calculates set and weight overlap with separate position keys", () => {
    expect(jaccardOverlap(["MU|Equity", "TSM|Equity"], ["MU|Equity", "MU|Swap"])).toEqual({
      intersectionCount: 1,
      unionCount: 3,
      similarity: 1 / 3
    });
    expect(weightedOverlap(new Map([["MU|Equity", 12], ["TSM|Equity", 8]]), new Map([["MU|Equity", 5], ["MU|Swap", 7]]))).toBe(5);
  });

  it("calculates concentration, adjustment intensity and sample-gated percentiles", () => {
    expect(concentrationMetrics([40, 30, 20, 10])).toEqual({ top5: 100, top10: 100, hhi: 0.3 });
    expect(adjustmentIntensity([1, -2, 3])).toBe(3);
    expect(percentileRank(3, [1, 2, 3, 4])).toBeNull();
    expect(percentileRank(3, [1, 2, 3, 4, 5])).toBe(50);
  });

  it("uses explainable coverage rules for signal confidence", () => {
    expect(confidenceForSignal({ tracked: 10, available: 9, delayed: 0, scaleComplete: 9, requiredObservations: 5, actualObservations: 5, dominantShare: 0.4, directionalRatio: 0.7 }).level).toBe("high");
    expect(confidenceForSignal({ tracked: 10, available: 6, delayed: 2, scaleComplete: 4, requiredObservations: 5, actualObservations: 4, dominantShare: 0.7, directionalRatio: 0.55 }).level).toBe("medium");
    expect(confidenceForSignal({ tracked: 10, available: 2, delayed: 8, scaleComplete: 1, requiredObservations: 20, actualObservations: 2, dominantShare: 1, directionalRatio: 1 }).level).toBe("low");
    expect(confidenceForSignal({ tracked: 10, available: 10, delayed: 0, scaleComplete: 10, requiredObservations: 5, actualObservations: 5, dominantShare: 0.4, directionalRatio: 0.7, directionConflictCount: 1 })).toEqual({
      level: "medium",
      reason: "張數與權重方向不一致"
    });
  });
});

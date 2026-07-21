import { describe, expect, it } from "vitest";
import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../../src/web/contracts/dashboard.js";
import { buildDailyBrief, coverageConfidence } from "../../src/web/domain/dailyBrief.js";

function coverage(availableCount: number, trackedCount = 10, staleCount = trackedCount - availableCount): EtfCoverageResponse {
  return { date: "2026-07-21", availableCount, trackedCount, staleCount, etfs: [] };
}

function impact(overrides: Partial<StockImpact> = {}): StockImpact {
  return {
    stockId: "2330", stockName: "台積電", sector: "半導體", themeTags: ["AI"], etfCount: 4,
    increaseEtfCount: 4, decreaseEtfCount: 0, totalDiffLots: 1200, totalActiveDiffLots: 1000,
    totalDiffWeightPoint: .42, maxAbsActiveDiffLots: 1000, maxAbsDiffWeightPoint: .42, impactScore: 10,
    market: null, institutional: { foreignNetShares: null, investmentTrustNetShares: null, dealerNetShares: null, totalNetShares: -1_000_000 },
    primaryImpactEtf: null, etfs: [], ...overrides
  };
}

const sectors: SectorSummaryRow[] = [{ sector: "半導體", stockCount: 5, etfCount: 4, totalActiveDiffLots: 2000, totalInstitutionalNetLots: -500, totalTurnover: 1, topStocks: [] }];

describe("daily brief rules", () => {
  it("lowers confidence as coverage becomes incomplete", () => {
    expect(coverageConfidence(coverage(10, 10, 0), 8).level).toBe("high");
    expect(coverageConfidence(coverage(7, 10, 3), 8).level).toBe("medium");
    expect(coverageConfidence(coverage(4, 10, 6), 8).level).toBe("low");
  });

  it("does not manufacture three insights when data is insufficient", () => {
    const result = buildDailyBrief([], [], coverage(0, 10, 10));
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]?.id).toBe("insufficient");
  });

  it("classifies consensus additions and reductions by direction", () => {
    const increase = impact();
    const decrease = impact({ stockId: "2317", stockName: "鴻海", totalActiveDiffLots: -800, totalDiffWeightPoint: -.25, increaseEtfCount: 0, decreaseEtfCount: 3 });
    const result = buildDailyBrief([increase, decrease, impact({ stockId: "2454" })], sectors, coverage(10, 10, 0));
    expect(result.additions.map((row) => row.stockId)).toContain("2330");
    expect(result.reductions.map((row) => row.stockId)).toContain("2317");
  });

  it("identifies ETF and institutional direction divergence", () => {
    const rows = [impact({ stockId: "1" }), impact({ stockId: "2" }), impact({ stockId: "3" }), impact({ stockId: "4", institutional: { foreignNetShares: null, investmentTrustNetShares: null, dealerNetShares: null, totalNetShares: 1_000_000 } })];
    const result = buildDailyBrief(rows, sectors, coverage(10, 10, 0));
    expect(result.insights.some((item) => item.tone === "divergence")).toBe(true);
  });
});

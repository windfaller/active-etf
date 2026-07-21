import { describe, expect, it } from "vitest";
import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../../src/web/contracts/dashboard.js";
import { buildDailyBrief, coverageConfidence, hasDirectionConsensus } from "../../src/web/domain/dailyBrief.js";

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
    expect(result.insights[0]?.title).toBe("目前資料涵蓋不足");
    expect(result.insights[0]?.description).toContain("目前僅反映已更新 ETF，尚不能視為完整市場方向");
  });

  it("does not emit full-market conclusions for low coverage even with many impacts", () => {
    const rows = Array.from({ length: 10 }, (_, index) => impact({ stockId: String(index + 1) }));
    const result = buildDailyBrief(rows, sectors, coverage(4, 30, 26));
    const copy = result.insights.map((item) => `${item.title} ${item.description}`).join(" ");
    expect(result.confidence.level).toBe("low");
    expect(copy).toContain("資料涵蓋不足");
    expect(copy).toContain("已更新樣本");
    expect(copy).not.toContain("今日主要產業方向");
    expect(copy).not.toContain("跨 ETF 共識");
    expect(copy).not.toContain("ETF 與三大法人方向偏一致");
  });

  it("keeps every medium-confidence insight explicit about the coverage limitation", () => {
    const rows = [impact({ stockId: "1" }), impact({ stockId: "2" }), impact({ stockId: "3" }), impact({ stockId: "4" })];
    const result = buildDailyBrief(rows, sectors, coverage(7, 10, 3));
    expect(result.confidence.level).toBe("medium");
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights.every((item) => item.description.includes(result.confidence.explanation))).toBe(true);
  });

  it("classifies consensus additions and reductions by direction", () => {
    const increase = impact();
    const decrease = impact({ stockId: "2317", stockName: "鴻海", totalActiveDiffLots: -800, totalDiffWeightPoint: -.25, increaseEtfCount: 0, decreaseEtfCount: 3 });
    const result = buildDailyBrief([increase, decrease, impact({ stockId: "2454" })], sectors, coverage(10, 10, 0));
    expect(result.additions.map((row) => row.stockId)).toContain("2330");
    expect(result.reductions.map((row) => row.stockId)).toContain("2317");
  });

  it("requires a directional majority and at least 60 percent before using consensus wording", () => {
    const consensus = impact({ etfCount: 5, increaseEtfCount: 4, decreaseEtfCount: 1 });
    const minority = impact({ etfCount: 7, increaseEtfCount: 2, decreaseEtfCount: 5 });
    const tie = impact({ etfCount: 4, increaseEtfCount: 2, decreaseEtfCount: 2 });
    const belowRatio = impact({ etfCount: 4, increaseEtfCount: 2, decreaseEtfCount: 0 });
    const oneEtf = impact({ etfCount: 1, increaseEtfCount: 1, decreaseEtfCount: 0 });
    const noEtfs = impact({ etfCount: 0, increaseEtfCount: 2, decreaseEtfCount: 0 });

    expect(hasDirectionConsensus(consensus, "increase")).toBe(true);
    expect(hasDirectionConsensus(minority, "increase")).toBe(false);
    expect(hasDirectionConsensus(tie, "increase")).toBe(false);
    expect(hasDirectionConsensus(belowRatio, "increase")).toBe(false);
    expect(hasDirectionConsensus(oneEtf, "increase")).toBe(false);
    expect(hasDirectionConsensus(noEtfs, "increase")).toBe(false);
  });

  it("keeps a two-ETF non-majority action but does not call it consensus", () => {
    const commonOnly = impact({ etfCount: 4, increaseEtfCount: 2, decreaseEtfCount: 2 });
    const result = buildDailyBrief([
      commonOnly,
      impact({ stockId: "2", etfCount: 2, increaseEtfCount: 1, decreaseEtfCount: 1 }),
      impact({ stockId: "3", etfCount: 2, increaseEtfCount: 1, decreaseEtfCount: 1 })
    ], sectors, coverage(10, 10, 0));
    expect(result.additions[0]?.stockId).toBe("2330");
    expect(result.insights.some((item) => item.id === "common-action" && item.title.includes("共同加碼"))).toBe(true);
    expect(result.insights.some((item) => item.title.includes("跨 ETF 共識"))).toBe(false);
  });

  it("sorts common actions by ratio, then count, then absolute active change", () => {
    const lowerRatio = impact({ stockId: "LOW", etfCount: 5, increaseEtfCount: 3, decreaseEtfCount: 0, totalActiveDiffLots: 9000 });
    const higherRatio = impact({ stockId: "HIGH", etfCount: 3, increaseEtfCount: 2, decreaseEtfCount: 0, totalActiveDiffLots: 100 });
    const third = impact({ stockId: "THIRD", etfCount: 3, increaseEtfCount: 1, decreaseEtfCount: 2 });
    const result = buildDailyBrief([lowerRatio, higherRatio, third], sectors, coverage(10, 10, 0));
    expect(result.additions.map((row) => row.stockId).slice(0, 2)).toEqual(["HIGH", "LOW"]);
  });

  it("identifies ETF and institutional direction divergence", () => {
    const rows = [impact({ stockId: "1" }), impact({ stockId: "2" }), impact({ stockId: "3" }), impact({ stockId: "4", institutional: { foreignNetShares: null, investmentTrustNetShares: null, dealerNetShares: null, totalNetShares: 1_000_000 } })];
    const result = buildDailyBrief(rows, sectors, coverage(10, 10, 0));
    expect(result.insights.some((item) => item.tone === "divergence")).toBe(true);
  });
});

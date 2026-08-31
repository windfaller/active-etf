import { describe, expect, it } from "vitest";
import type { EtfCoverageResponse, StockImpact } from "../../src/web/contracts/dashboard.js";
import { buildPullPushPreview } from "../../src/web/domain/pullPushRadar.js";

function impact(overrides: Partial<StockImpact> = {}): StockImpact {
  return {
    stockId: "2330",
    stockName: "台積電",
    sector: "半導體",
    themeTags: ["AI"],
    etfCount: 3,
    increaseEtfCount: 2,
    decreaseEtfCount: 0,
    totalDiffLots: 220,
    totalActiveDiffLots: 150,
    totalDiffWeightPoint: 0.2,
    maxAbsActiveDiffLots: 100,
    maxAbsDiffWeightPoint: 0.1,
    impactScore: 10,
    market: null,
    institutional: { foreignNetShares: -500, investmentTrustNetShares: 1_000, dealerNetShares: 0, totalNetShares: 500 },
    primaryImpactEtf: null,
    etfs: [
      { etfCode: "00981A", diffLots: 120, activeDiffLots: 100, diffWeightPoint: 0.1, currentWeight: 5, status: "increase" },
      { etfCode: "00982A", diffLots: 80, activeDiffLots: 50, diffWeightPoint: 0.08, currentWeight: 4, status: "increase" },
      { etfCode: "00990A", diffLots: 20, activeDiffLots: null, diffWeightPoint: 0.02, currentWeight: 1, status: "increase" }
    ],
    ...overrides
  };
}

const coverage: EtfCoverageResponse = { date: "2026-08-28", trackedCount: 3, availableCount: 3, staleCount: 0, etfs: [] };
const issuers = new Map([["00981A", "統一投信"], ["00982A", "群益投信"], ["00990A", "元大投信"]]);

describe("ETF and investment-trust homepage observation", () => {
  it("uses only flow-corrected ETF rows and exposes no unavailable score fields", () => {
    const result = buildPullPushPreview([impact()], coverage, "2026-08-28", issuers);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      pullSignals: ["半導體", "AI"],
      marketChangePercent: null,
      adjustedActiveLots: 150,
      activeEtfCount: 2,
      issuerCount: 2,
      statusLabel: "ETF 與投信同向"
    });
    expect(result).not.toHaveProperty("readiness");
    expect(result.candidates[0]).not.toHaveProperty("rawDiffLots");
    expect(result.candidates[0]).not.toHaveProperty("flowCorrectionCoverage");
    expect(result.candidates[0]).not.toHaveProperty("pullScore");
    expect(result.candidates[0]).not.toHaveProperty("pushScoreV21");
    expect(result.candidates[0]).not.toHaveProperty("investableScore");
    expect(result.candidates[0]).not.toHaveProperty("blockers");
  });

  it("uses investment-trust direction instead of the total institutional flow", () => {
    const divergent = impact({
      institutional: { foreignNetShares: 5_000, investmentTrustNetShares: -1_000, dealerNetShares: 0, totalNetShares: 4_000 }
    });
    const result = buildPullPushPreview([divergent], coverage, "2026-08-28", issuers);
    expect(result.candidates[0]?.crossSourceState).toBe("divergent");
    expect(result.candidates[0]?.statusLabel).toBe("ETF 加碼、投信賣超");
  });

  it("conservatively collapses multiple ETFs from one issuer", () => {
    const oneIssuer = new Map([["00981A", "統一投信"], ["00982A", "統一投信"], ["00990A", "元大投信"]]);
    const result = buildPullPushPreview([impact()], coverage, "2026-08-28", oneIssuer);
    expect(result.candidates[0]?.issuerCount).toBe(1);
    expect(result.candidates[0]?.statusLabel).toBe("ETF 加碼觀察");
  });
});

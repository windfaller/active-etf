import { describe, expect, it } from "vitest";
import { prerenderContentForPath, prerenderDateForPath, type PrerenderSnapshot } from "../../src/web/seo/prerenderSnapshot.js";

describe("build-time SEO data snapshot", () => {
  const snapshot: PrerenderSnapshot = {
    market: {
      dates: ["2026-07-22", "2026-07-21", "2026-07-20"],
      selectedDate: "2026-07-20",
      recommendedDate: "2026-07-20",
      coverage: [
        { date: "2026-07-22", availableCount: 1, trackedCount: 28 },
        { date: "2026-07-21", availableCount: 14, trackedCount: 28 },
        { date: "2026-07-20", availableCount: 25, trackedCount: 28 }
      ],
      dashboard: {
        coverage: {
          availableCount: 25,
          trackedCount: 28,
          etfs: [
            { etfCode: "00981A", latestTradeDate: "2026-07-21" },
            { etfCode: "00982A", latestTradeDate: "2026-07-20" }
          ]
        },
        stockImpact: {
          impacts: [
            { stockId: "2330", stockName: "台積電", totalActiveDiffLots: -760, totalDiffWeightPoint: -0.3 }
          ]
        }
      }
    }
  };

  it("separates the newest disclosure date from the recommended comparison date", () => {
    expect(prerenderDateForPath(snapshot, "/market")).toBe("2026-07-22");
    const content = prerenderContentForPath(snapshot, "/market");
    expect(content).toContain("最新揭露日 2026-07-22");
    expect(content).toContain("跨 ETF 比較預設使用 2026-07-20");
    expect(content).toContain("25／28");
  });

  it("uses each Taiwan ETF's own latest date", () => {
    expect(prerenderDateForPath(snapshot, "/etf/00981A")).toBe("2026-07-21");
    expect(prerenderDateForPath(snapshot, "/etf/00982A/changes")).toBe("2026-07-20");
  });

  it("omits content and dates instead of inventing a build date", () => {
    expect(prerenderDateForPath({}, "/market")).toBeUndefined();
    expect(prerenderContentForPath({}, "/market")).toBe("");
  });
});

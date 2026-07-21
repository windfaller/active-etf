import { expect, test, type Page } from "playwright/test";

const dashboard = {
  holdings: [], summary: null, summaries: [],
  changes: { topIncreases: [], topDecreases: [], topActiveIncreases: [], topActiveDecreases: [], newHoldings: [], exitedHoldings: [], tagMovements: [] },
  stockImpact: { impacts: [], sectorSummary: { sectors: [] } },
  coverage: { date: "2026-07-21", trackedCount: 1, availableCount: 1, staleCount: 0, etfs: [] }
};

const globalReport = {
  reportDate: "2026-07-21", coveredEtfs: ["DRAM", "ARK13F"], successCount: 2, totalCount: 2,
  highlights: [], statusRows: [], commonHoldings: [], globalMovers: [], adContext: { tags: [] },
  sections: [
    { etfCode: "DRAM", fundName: "Roundhill Memory ETF", issuer: "Roundhill Investments", strategyType: "index", sourceAsOf: "2026-07-20", sourceUrl: "https://example.com/dram", sourceStatus: "ok", rowCount: 0, topHoldings: [], newPositions: [], exitedPositions: [], weightChanges: [], takeaway: "" },
    { etfCode: "ARK13F", fundName: "ARK Investment Management 13F Portfolio", issuer: "ARK Investment Management", strategyType: "13f", sourceAsOf: "2026-03-31", filedAt: "2026-05-12", capturedAt: "2026-05-13T01:02:03.000Z", sourceUrl: "https://www.sec.gov/", sourceStatus: "ok", rowCount: 0, topHoldings: [], newPositions: [], exitedPositions: [], weightChanges: [], takeaway: "" }
  ]
};

async function mockApis(page: Page) {
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.includes("/market/dates")) return route.fulfill({ json: { dates: ["2026-07-21"], recommendedDate: "2026-07-21", coverage: [{ date: "2026-07-21", availableCount: 1, trackedCount: 1, coverageRate: 1 }] } });
    if (/\/api\/etf\/[^/]+\/dates/u.test(url)) return route.fulfill({ json: { dates: ["2026-07-20"] } });
    if (url.includes("/dashboard")) return route.fulfill({ json: dashboard });
    if (url.includes("/global-etfs/enabled")) return route.fulfill({ json: { productGroup: "global_etf", enabled: [{ etfCode: "DRAM", fundName: "Roundhill Memory ETF", strategyType: "index" }, { etfCode: "ARK13F", fundName: "ARK Investment Management 13F Portfolio", strategyType: "13f" }], candidates: [] } });
    if (url.includes("/global-etfs/dates")) return route.fulfill({ json: { dates: ["2026-07-21"] } });
    if (url.includes("/global-etfs/daily-report")) return route.fulfill({ json: globalReport });
    if (url.includes("/telegram/info")) return route.fulfill({ json: { configured: false, username: null, subscribeUrl: null } });
    return route.fulfill({ status: 404, json: {} });
  });
}

const directRoutes = [
  ["/", "主動 ETF 機構調倉情報"],
  ["/market", "台灣主動式 ETF 市場總覽"],
  ["/etf/00981A", "00981A 主動統一台股增長"],
  ["/etf/00981A/changes", "00981A 主動統一台股增長"],
  ["/global-etfs/DRAM", "DRAM Roundhill Memory ETF"],
  ["/institutions", "機構 13F 季度持倉"],
  ["/institutions/ARK13F", "ARK Investment Management 13F Portfolio"]
] as const;

test("built static preview serves and hydrates every P0 direct route", async ({ page }) => {
  await mockApis(page);
  for (const [path, heading] of directRoutes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await response?.text(), path).toContain(`href="https://active-etf.inthewins.com${path}"`);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
});

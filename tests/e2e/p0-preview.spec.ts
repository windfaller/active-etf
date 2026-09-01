import { expect, test, type Page } from "playwright/test";
import { mockP1Apis } from "./p1-fixtures.js";

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
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.route("https://connect.facebook.net/**", (route) => route.abort());
  await page.route("https://www.forvix.app/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>FORVIX embed fixture</title>" }));
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.includes("/market/bootstrap")) return route.fulfill({ json: { dates: ["2026-07-21"], recommendedDate: "2026-07-21", selectedDate: "2026-07-21", coverage: [{ date: "2026-07-21", availableCount: 1, trackedCount: 1, coverageRate: 1 }], dashboard: { date: "2026-07-21", stockImpact: dashboard.stockImpact, coverage: dashboard.coverage } } });
    if (url.includes("/market/dates")) return route.fulfill({ json: { dates: ["2026-07-21"], recommendedDate: "2026-07-21", coverage: [{ date: "2026-07-21", availableCount: 1, trackedCount: 1, coverageRate: 1 }] } });
    if (/\/api\/etf\/[^/]+\/dates/u.test(url)) return route.fulfill({ json: { dates: ["2026-07-20"] } });
    if (url.includes("/market/dashboard")) return route.fulfill({ json: { date: "2026-07-21", stockImpact: dashboard.stockImpact, coverage: dashboard.coverage } });
    if (url.includes("/dashboard")) return route.fulfill({ json: dashboard });
    if (url.includes("/global-etfs/enabled")) return route.fulfill({ json: { productGroup: "global_etf", enabled: [{ etfCode: "DRAM", fundName: "Roundhill Memory ETF", strategyType: "index" }, { etfCode: "ARK13F", fundName: "ARK Investment Management 13F Portfolio", strategyType: "13f" }], candidates: [] } });
    if (url.includes("/global-etfs/dates")) return route.fulfill({ json: { dates: ["2026-07-21"] } });
    if (url.includes("/global-etfs/daily-report")) return route.fulfill({ json: globalReport });
    if (url.includes("/telegram/info")) return route.fulfill({ json: { configured: false, username: null, subscribeUrl: null } });
    return route.fulfill({ status: 404, json: {} });
  });
  await mockP1Apis(page);
}

const directRoutes = [
  ["/", "主動 ETF 機構調倉情報"],
  ["/market", "台灣主動式 ETF 市場總覽"],
  ["/etf/00981A", "00981A 主動統一台股增長"],
  ["/etf/00981A/changes", "00981A 主動統一台股增長"],
  ["/global-etfs/DRAM", "DRAM Roundhill Memory ETF"],
  ["/institutions", "機構 13F 季度持倉"],
  ["/institutions/ARK13F", "ARK Investment Management 13F Portfolio"],
  ["/stocks", "從股票反查 ETF 調倉"],
  ["/stocks/tw/2330", "2330 台積電"],
  ["/stocks/us/MU", "MU Micron Technology"],
  ["/compare/etfs", "持股重疊、調倉與配置差異"],
  ["/signals", "連續調倉、反轉與方向分歧"],
  ["/signals/consecutive", "連續調倉、反轉與方向分歧"],
  ["/signals/reversals", "連續調倉、反轉與方向分歧"],
  ["/signals/divergence", "連續調倉、反轉與方向分歧"],
  ["/etf/00981A/style", "00981A 主動統一台股增長"],
  ["/methodology", "情報指標方法論與限制"],
  ["/privacy", "隱私政策"],
  ["/terms", "服務條款"]
] as const;

test("anonymous Google measurement starts before consent while Meta remains gated", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");

  const consent = page.getByRole("dialog", { name: "匿名量測與完整追蹤" });
  await expect(consent).toBeVisible();
  await expect(page.locator('script[data-google-tag-id="G-DG02G9VVHY"]')).toHaveCount(1);
  await expect(page.locator('script[data-meta-pixel-id="1811635619849853"]')).toHaveCount(0);
  await expect(page.locator('script[data-gtm-id]')).toHaveCount(0);
  const forvixEmbed = page.locator("#forvix-market-watch-embed");
  await forvixEmbed.scrollIntoViewIfNeeded();
  await expect(forvixEmbed.locator("iframe")).toHaveCount(0);

  await consent.getByRole("button", { name: "維持匿名量測" }).click();
  await expect(consent).toBeHidden();
  await expect(page.locator('script[data-google-tag-id="G-DG02G9VVHY"]')).toHaveCount(1);
  await expect(page.locator('script[data-meta-pixel-id="1811635619849853"]')).toHaveCount(0);

  await page.getByRole("button", { name: "追蹤設定" }).click();
  await consent.getByRole("button", { name: "同意完整量測" }).click();
  await expect(page.locator('script[data-google-tag-id="G-DG02G9VVHY"]')).toHaveCount(1);
  await expect(page.locator('script[data-meta-pixel-id="1811635619849853"]')).toHaveCount(1);
  await expect(forvixEmbed.locator("iframe")).toHaveCount(1);
});

test("built static preview serves and hydrates every P0 direct route", async ({ page }) => {
  await mockApis(page);
  for (const [path, heading] of directRoutes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await response?.text(), path).toContain(`href="https://active-etf.inthewins.com${path}"`);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    if (path === "/privacy" || path === "/terms") {
      await expect(page.locator(".legal-view section").first()).toBeVisible();
    }
  }
});

test("primary navigation is crawlable and preserves SPA navigation", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  const taiwanLink = page.getByRole("navigation", { name: "主要導覽" }).getByRole("link", { name: "台灣 ETF", exact: true });
  await expect(taiwanLink).toHaveAttribute("href", "/market");
  await taiwanLink.click();
  await expect(page).toHaveURL(/\/market$/u);
  await expect(page.getByRole("heading", { name: "台灣主動式 ETF 市場總覽" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "匿名量測與完整追蹤" })).toBeHidden();
  await expect(page.locator('script[data-meta-pixel-id="1811635619849853"]')).toHaveCount(1);
});

test("mobile homepage opens a preselected ETF comparison in one action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page);
  await page.goto("/");
  const launcher = page.getByLabel("首頁 ETF 快速比較");
  await expect(launcher).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(launcher.getByLabel("快速比較第一檔 ETF")).toHaveValue("00981A");
  await expect(launcher.getByLabel("快速比較第二檔 ETF")).toHaveValue("00982A");
  await launcher.getByRole("link", { name: "立即比較 00981A × 00982A" }).click();
  await expect(page).toHaveURL(/\/compare\/etfs\?type=tw&codes=00981A,00982A$/u);
  await expect(page.getByRole("heading", { name: "持股重疊、調倉與配置差異" })).toBeVisible();
});

test("unknown routes are real noindex 404s while dynamic stock deep links remain available", async ({ page }) => {
  for (const path of ["/does-not-exist", "/etf/NOTREAL"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    expect(await response?.text(), path).toContain('<meta name="robots" content="noindex, nofollow"');
    await expect(page.getByRole("heading", { name: "找不到 ETF 或資料頁面" })).toBeVisible();
  }

  const stockResponse = await page.goto("/stocks/us/NVDA");
  expect(stockResponse?.status()).toBe(200);
  expect(await stockResponse?.text()).toContain('<meta name="robots" content="noindex, nofollow"');
});

test("crawlable mobile navigation has no horizontal page overflow", async ({ page }) => {
  await mockApis(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/market");
  await expect(page.getByRole("navigation", { name: "行動版主要導覽" }).getByRole("link", { name: "台灣", exact: true })).toHaveAttribute("href", "/market");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

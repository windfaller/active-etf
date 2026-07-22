import { expect, test } from "playwright/test";
import { mockP1Apis } from "./p1-fixtures.js";

test.beforeEach(async ({ page }) => mockP1Apis(page));

test("P1 routes are shareable, preserve time scales, and support browser history", async ({ page }) => {
  await page.goto("/stocks/tw/2330");
  await expect(page.getByRole("heading", { name: "2330 台積電" })).toBeVisible();
  await expect(page.getByText("3／5／20 個有效交易日趨勢")).toBeVisible();
  await expect(page.getByText("方向指標分歧").first()).toBeVisible();
  await expect(page.getByText("有效觀察 17/20").first()).toBeVisible();
  await page.getByRole("button", { name: "比較" }).click();
  await expect(page).toHaveURL(/\/compare\/etfs$/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/stocks\/tw\/2330$/u);
  await page.reload();
  await expect(page.getByRole("heading", { name: "2330 台積電" })).toBeVisible();

  await page.goto("/stocks/us/MU");
  await expect(page.getByRole("heading", { name: "MU Micron Technology" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "海外 ETF 曝險" })).toBeVisible();
  await expect(page.locator(".exposure-grid").getByText(/HBMX/u)).toBeVisible();
  await expect(page.locator(".exposure-grid").getByText(/DRAM/u)).toHaveCount(0);
  await expect(page.locator(".etf-detail-table").getByText(/HBMX/u)).toBeVisible();
  await expect(page.locator(".etf-detail-table").getByText(/DRAM/u)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "機構 13F 季度持倉" })).toBeVisible();
  await expect(page.getByText(/持倉截止 2026-06-30/u)).toBeVisible();
  await expect(page.locator(".filing-cards").getByText(/ARK13F/u)).toHaveCount(0);
});

test("ETF compare enforces four selections and never offers 13F", async ({ page }) => {
  await page.goto("/compare/etfs?type=tw&codes=00981A,00982A");
  await expect(page.getByRole("heading", { name: "持股重疊、調倉與配置差異" })).toBeVisible();
  await expect(page.getByText("Jaccard", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "調整" }).click();
  await expect(page.getByText(/加碼持股筆數 5/u).first()).toBeVisible();
  await expect(page.getByText(/減碼持股筆數 2/u).first()).toBeVisible();
  await page.locator(".type-toggle").getByRole("button", { name: "海外 ETF" }).click();
  await expect(page.getByRole("button", { name: /ARK13F/u })).toHaveCount(0);
  const options = page.locator(".code-options button");
  const count = await options.count();
  for (let index = 0; index < Math.min(5, count); index += 1) await options.nth(index).click();
  await expect(page.getByText("已選 4 / 4 檔")).toBeVisible();
});

test("ETF compare starts with useful defaults and shows only complete option rows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/compare/etfs");
  await expect(page.getByText("已選 2 / 4 檔")).toBeVisible();
  await expect(page.getByRole("button", { name: /00981A/u })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /00982A/u })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Jaccard", { exact: true })).toBeVisible();

  const clipping = await page.locator(".code-options").evaluate((container) => {
    const bottom = container.clientHeight;
    return [...container.querySelectorAll("button")]
      .map((button) => ({ top: (button as HTMLElement).offsetTop - (container as HTMLElement).offsetTop, bottom: (button as HTMLElement).offsetTop - (container as HTMLElement).offsetTop + (button as HTMLElement).offsetHeight }))
      .filter((row) => row.top < bottom && row.bottom > bottom);
  });
  expect(clipping).toEqual([]);

  const optionTextLayout = await page.getByRole("button", { name: /00981A/u }).evaluate((button) => {
    const name = button.querySelector("small");
    if (!name) return null;
    const buttonRect = button.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    return {
      lineHeight: Number.parseFloat(getComputedStyle(name).lineHeight),
      topInset: nameRect.top - buttonRect.top,
      bottomInset: buttonRect.bottom - nameRect.bottom
    };
  });
  expect(optionTextLayout).not.toBeNull();
  expect(optionTextLayout?.lineHeight).toBeGreaterThanOrEqual(17);
  expect(optionTextLayout?.topInset).toBeGreaterThanOrEqual(8);
  expect(optionTextLayout?.bottomInset).toBeGreaterThanOrEqual(8);
});

test("selected ETF options keep WCAG AA text contrast in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare/etfs?type=tw&codes=00981A,00982A");
  await page.getByRole("button", { name: "切換至深色模式" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");

  const contrastRatios = await page.locator(".code-options button.selected").first().evaluate((button) => {
    const luminance = (color: string): number => {
      const channels = color.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? [];
      const linear = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
    };
    const contrast = (foreground: string, background: string): number => {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    };
    const buttonStyle = getComputedStyle(button);
    const small = button.querySelector("small");
    return {
      primary: contrast(buttonStyle.color, buttonStyle.backgroundColor),
      secondary: small ? contrast(getComputedStyle(small).color, buttonStyle.backgroundColor) : 0
    };
  });

  expect(contrastRatios.primary).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatios.secondary).toBeGreaterThanOrEqual(4.5);
});

test("global compare keeps daily ETF data separate from 13F", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/compare/etfs?type=global&codes=DRAM,HBMX");
  await expect(page.getByRole("heading", { name: "持股重疊、調倉與配置差異" })).toBeVisible();
  await expect(page.getByText("Jaccard", { exact: true })).toBeVisible();
  await expect(page.locator(".code-options").getByText(/13F/u)).toHaveCount(0);
  const dateNotice = page.getByTestId("global-date-alignment");
  await expect(dateNotice.getByText("非共同資料日", { exact: true })).toBeVisible();
  await expect(dateNotice.getByText(/DRAM.*2026-07-21/u)).toBeVisible();
  await expect(dateNotice.getByText(/HBMX.*2026-07-19/u)).toBeVisible();
  await expect(dateNotice.getByText(/最後抓取/u)).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "切換至深色模式" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect(dateNotice).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(/type=global&codes=DRAM%2CHBMX|type=global&codes=DRAM,HBMX/u);
});

test("signals, style, and search interactions are keyboard accessible", async ({ page }) => {
  await page.goto("/signals");
  await expect(page.getByRole("heading", { name: "連續調倉、反轉與方向分歧" })).toBeVisible();
  await expect(page.getByText("連續 3 日")).toBeVisible();
  await expect(page.getByText("有效觀察 17/20")).toBeVisible();
  await page.goto("/etf/00981A/style");
  await expect(page.getByRole("heading", { name: "00981A 主動統一台股增長" })).toBeVisible();
  await expect(page.getByText("第 78 百分位")).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder(/輸入股票名稱/u);
  await expect(search).toBeFocused();
  await search.fill("台積電");
  await expect(page.getByRole("button", { name: /2330 台積電/u })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
});

test("search discards a cancelled stale response", async ({ page }) => {
  await page.route("**/api/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "台積") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({ json: { generatedAt: "2026-07-21T08:00:00Z", query, results: [{ type: "tw_stock", typeLabel: "股票", code: "2331", name: "過期結果", market: "台灣", latestDataDate: "2026-07-21", path: "/stocks/tw/2331" }] } });
    }
    return route.fulfill({ json: { generatedAt: "2026-07-21T08:00:00Z", query, results: [{ type: "tw_stock", typeLabel: "股票", code: "2330", name: "台積電", market: "台灣", latestDataDate: "2026-07-21", path: "/stocks/tw/2330" }] } });
  });
  await page.goto("/etf/00981A/style");
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder(/輸入股票名稱/u);
  await search.fill("台積");
  await page.waitForTimeout(320);
  await search.fill("台積電");
  await expect(page.getByRole("button", { name: /2330 台積電/u })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByText("過期結果")).toHaveCount(0);
});

test("invalid stock shows an explicit not-found state", async ({ page }) => {
  await page.goto("/stocks/tw/9999");
  await expect(page.getByText("stock not found", { exact: true })).toBeVisible();
});

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`P1 stock and compare avoid horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/stocks/tw/2330", "/compare/etfs?type=tw&codes=00981A,00982A", "/signals"]) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });
}

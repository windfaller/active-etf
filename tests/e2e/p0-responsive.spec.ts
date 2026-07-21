import { expect, test, type Page } from "playwright/test";
import type { GlobalReport } from "../../src/web/contracts/global.js";

const impacts = [
  { stockId:"2330",stockName:"台積電",sector:"半導體",themeTags:["AI"],etfCount:8,increaseEtfCount:8,decreaseEtfCount:0,totalDiffLots:3600,totalActiveDiffLots:3250,totalDiffWeightPoint:.42,maxAbsActiveDiffLots:1500,maxAbsDiffWeightPoint:.2,impactScore:100,market:{market:"TWSE",closePrice:1200,change:10,changePercent:.84,volumeShares:20_000_000,turnover:24_000_000_000,transactionCount:10000},institutional:{foreignNetShares:-900_000,investmentTrustNetShares:-120_000,dealerNetShares:-100_000,totalNetShares:-1_120_000},primaryImpactEtf:{etfCode:"00981A",diffLots:1000,activeDiffLots:900,diffWeightPoint:.12,currentWeight:12,status:"increase"},etfs:[{etfCode:"00981A",diffLots:1000,activeDiffLots:900,diffWeightPoint:.12,currentWeight:12,status:"increase"}] },
  { stockId:"2317",stockName:"鴻海",sector:"電子零組件",themeTags:["AI Server"],etfCount:5,increaseEtfCount:0,decreaseEtfCount:5,totalDiffLots:-1500,totalActiveDiffLots:-1300,totalDiffWeightPoint:-.25,maxAbsActiveDiffLots:800,maxAbsDiffWeightPoint:.14,impactScore:80,market:null,institutional:{foreignNetShares:300_000,investmentTrustNetShares:100_000,dealerNetShares:0,totalNetShares:400_000},primaryImpactEtf:null,etfs:[] },
  { stockId:"2454",stockName:"聯發科",sector:"半導體",themeTags:["IC 設計"],etfCount:3,increaseEtfCount:3,decreaseEtfCount:0,totalDiffLots:600,totalActiveDiffLots:550,totalDiffWeightPoint:.1,maxAbsActiveDiffLots:300,maxAbsDiffWeightPoint:.06,impactScore:50,market:null,institutional:{foreignNetShares:200_000,investmentTrustNetShares:0,dealerNetShares:0,totalNetShares:200_000},primaryImpactEtf:null,etfs:[] }
];

const dashboard = {
  holdings:[{stockId:"2330",stockName:"台積電",shares:1_000_000,lots:1000,weight:12.3,marketValue:1_200_000_000}],
  summary:{tradeDate:"2026-07-21",nav:20.1,marketPrice:20.2,premiumDiscount:.5,totalUnits:1_000_000,fundSize:2_000_000_000,netCreationUnits:10_000,cashRatio:3,stockRatio:97},
  summaries:[{tradeDate:"2026-07-21",nav:20.1,marketPrice:20.2,premiumDiscount:.5,totalUnits:1_000_000,fundSize:2_000_000_000,netCreationUnits:10_000,cashRatio:3,stockRatio:97}],
  changes:{topIncreases:[],topDecreases:[],topActiveIncreases:[],topActiveDecreases:[],newHoldings:[],exitedHoldings:[],tagMovements:[]},
  stockImpact:{impacts,sectorSummary:{sectors:[{sector:"半導體",stockCount:2,etfCount:8,totalActiveDiffLots:3800,totalInstitutionalNetLots:-920,totalTurnover:24_000_000_000,topStocks:[]},{sector:"電子零組件",stockCount:1,etfCount:5,totalActiveDiffLots:-1300,totalInstitutionalNetLots:400,totalTurnover:0,topStocks:[]}]}},
  coverage:{date:"2026-07-21",trackedCount:10,availableCount:10,staleCount:0,etfs:[{etfCode:"00981A",name:"主動統一台股增長",issuer:"統一投信",providerId:"ezmoney",latestTradeDate:"2026-07-21",hasSelectedDate:true,status:"available",updatedAt:"2026-07-21T08:30:00Z"}]}
};

const globalReport: GlobalReport = {
  reportDate:"2026-07-21",coveredEtfs:["DRAM","ARK13F"],successCount:2,totalCount:2,highlights:[],statusRows:[],commonHoldings:[],globalMovers:[],adContext:{tags:[]},
  sections:[
    {etfCode:"DRAM",fundName:"Roundhill Memory ETF",issuer:"Roundhill Investments",strategyType:"index",sourceAsOf:"2026-07-20",sourceUrl:"https://example.com/dram",sourceStatus:"verified",rowCount:1,topHoldings:[{ticker:"MU",name:"Micron Technology",weightPercent:18.4,assetType:"Equity",exposureComponents:[{ticker:"MU",name:"Micron",weightPercent:17,assetType:"Equity"},{ticker:"MU SWAP",name:"Micron swap",weightPercent:1.4,assetType:"Swap"}]}],newPositions:[],exitedPositions:[],weightChanges:[{etfCode:"DRAM",ticker:"MU",name:"Micron Technology",currentWeightPercent:18.4,prevWeightPercent:17.2,deltaPp:1.2,status:"increase"}],takeaway:"Memory exposure"},
    {etfCode:"ARK13F",fundName:"ARK Investment Management 13F Portfolio",issuer:"ARK Investment Management",strategyType:"13f",sourceAsOf:"2026-03-31",filedAt:"2026-05-12",capturedAt:"2026-05-13T01:02:03.000Z",sourceUrl:"https://www.sec.gov/",sourceStatus:"verified",rowCount:1,topHoldings:[{ticker:"TSLA",name:"Tesla",weightPercent:12,marketValue:1000000,assetType:"Equity"}],newPositions:[],exitedPositions:[],weightChanges:[{etfCode:"ARK13F",ticker:"TSLA",name:"Tesla",currentWeightPercent:12,prevWeightPercent:10,deltaPp:2,status:"increase"}],takeaway:"Quarterly filing"}
  ]
};

async function mockApis(page: Page, globalReportFixture: GlobalReport = globalReport) {
  await page.route("**/app-version.json*", (route) => route.fulfill({ json: { version: "p0-test" } }));
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    const headers = { "access-control-allow-origin": "*" };
    if (url.includes("/global-etfs/enabled")) return route.fulfill({ headers, json:{productGroup:"global_etf",enabled:[{etfCode:"DRAM",fundName:"Roundhill Memory ETF",strategyType:"index"},{etfCode:"ARK13F",fundName:"ARK Investment Management 13F Portfolio",strategyType:"13f"}],candidates:[]} });
    if (url.includes("/global-etfs/dates")) return route.fulfill({ headers, json:{dates:["2026-07-21"]} });
    if (url.includes("/global-etfs/daily-report")) return route.fulfill({ headers, json:globalReportFixture });
    if (url.includes("/market/dates")) return route.fulfill({ headers, json:{
      dates:["2026-07-21","2026-07-20"],
      recommendedDate:"2026-07-20",
      coverage:[
        {date:"2026-07-21",availableCount:4,trackedCount:10,coverageRate:.4},
        {date:"2026-07-20",availableCount:10,trackedCount:10,coverageRate:1}
      ]
    } });
    if (/\/api\/etf\/[^/]+\/dates/u.test(url)) return route.fulfill({ headers, json:{dates:["2026-07-20","2026-07-19"]} });
    if (url.includes("/dashboard")) {
      const selected = new URL(url).searchParams.get("date") ?? "2026-07-21";
      const latestPartial = selected === "2026-07-21";
      return route.fulfill({ headers, json:{...dashboard,summary:{...dashboard.summary,tradeDate:selected},coverage:{...dashboard.coverage,date:selected,availableCount:latestPartial ? 4 : 10,staleCount:latestPartial ? 6 : 0}} });
    }
    if (url.includes("/telegram/info")) return route.fulfill({ headers, json:{configured:false,username:null,subscribeUrl:null} });
    return route.fulfill({ headers, status:404, json:{} });
  });
}

const viewports = [
  { width:375,height:812 }, { width:390,height:844 }, { width:768,height:1024 }, { width:1440,height:900 }
];

for (const viewport of viewports) {
  test(`${viewport.width}x${viewport.height} has no page overflow and preserves responsive data`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApis(page);
    await page.goto("/market");
    await expect(page.getByRole("heading", { name: "台灣主動式 ETF 市場總覽" })).toBeVisible();
    await expect(page.getByText("正負值同時使用文字與符號呈現，不只依賴顏色。")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width <= 760) {
      const card = page.locator("article.market-impact-card").first();
      await expect(card).toBeVisible();
      await expect(page.locator("details.market-impact-card")).toHaveCount(0);
      await expect(card.locator(".mobile-card-toggle")).toHaveCount(0);
      await expect(card.locator(".mobile-card-detail-static")).toBeVisible();
      await expect(card.getByText("產業／主題")).toBeVisible();
      await expect(card.getByText("成交金額")).toBeVisible();
      await expect(card.getByRole("button", { name: /00981A/u })).toBeVisible();
      const toneStyles = await page.locator("article.market-impact-card").evaluateAll((cards) => cards.slice(0, 2).map((toneCard) => ({
        background: getComputedStyle(toneCard).backgroundColor,
        accent: getComputedStyle(toneCard.querySelector(".impact-summary-primary b") as Element).color,
        leftBorderWidth: getComputedStyle(toneCard).borderLeftWidth
      })));
      expect(toneStyles).toHaveLength(2);
      expect(toneStyles[0].background).not.toBe(toneStyles[1].background);
      expect(toneStyles[0].accent).not.toBe(toneStyles[1].accent);
      expect(toneStyles.map((style) => style.leftBorderWidth)).toEqual(["1px", "1px"]);
      const search = page.getByPlaceholder("搜尋代碼、名稱、產業或 ETF");
      await search.fill("2317");
      await expect(page.locator("article.market-impact-card")).toHaveCount(1);
      await expect(page.locator("article.market-impact-card")).toContainText("2317 鴻海");
      await search.fill("");
      const nav = page.locator(".mobile-primary-nav");
      await expect(nav).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect.poll(() => page.evaluate(() => {
        const footer = document.querySelector(".p0-footer")?.getBoundingClientRect();
        const navRect = document.querySelector(".mobile-primary-nav")?.getBoundingClientRect();
        return Boolean(footer && navRect && footer.bottom <= navRect.top + 1);
      })).toBe(true);
      const undersizedTargets = await page.locator("button:visible, summary:visible, select:visible").evaluateAll((nodes) => nodes
        .map((node) => ({ label: node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 40), height: node.getBoundingClientRect().height }))
        .filter((row) => row.height < 43.5));
      expect(undersizedTargets).toEqual([]);
    } else {
      await expect(page.locator(".desktop-data").first()).toBeVisible();
    }
  });
}

test("market impact cards keep distinct tone surfaces in dark mode", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await mockApis(page);
  await page.goto("/market");
  const toneStyles = async () => page.locator("article.market-impact-card").evaluateAll((cards) => cards.slice(0, 2).map((toneCard) => ({
    background: getComputedStyle(toneCard).backgroundColor,
    accent: getComputedStyle(toneCard.querySelector(".impact-summary-primary b") as Element).color
  })));
  const lightStyles = await toneStyles();
  await page.getByRole("button", { name: "切換至深色模式" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  const darkStyles = await toneStyles();
  expect(darkStyles[0].background).not.toBe(darkStyles[1].background);
  expect(darkStyles[0].accent).not.toBe(darkStyles[1].accent);
  expect(darkStyles[0].background).not.toBe(lightStyles[0].background);
  expect(darkStyles[1].background).not.toBe(lightStyles[1].background);
});

test("homepage does not request the full global report and browser history follows URL", async ({ page }) => {
  await mockApis(page);
  const globalReportRequests: string[] = [];
  const initialApiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/global-etfs/daily-report")) globalReportRequests.push(request.url());
    if (request.url().includes("/api/")) initialApiRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "主動 ETF 機構調倉情報" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(globalReportRequests).toHaveLength(0);
  expect(initialApiRequests.filter((path) => path !== "/api/telegram/info")).toEqual(["/api/market/dates", "/api/dashboard"]);
  await page.getByRole("button", { name: "海外 ETF", exact: true }).click();
  await expect(page).toHaveURL(/\/global-etfs$/u);
  await expect(page.getByRole("heading", { name: "海外 ETF 市場總覽" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("heading", { name: "主動 ETF 機構調倉情報" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/global-etfs$/u);
  await expect(page.getByRole("heading", { name: "海外 ETF 市場總覽" })).toBeVisible();
});

test("market and single-ETF dates stay independent across navigation and history", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  const marketDate = page.getByLabel("台灣市場資料日期");
  await expect(marketDate).toHaveValue("2026-07-20");
  await expect(page.getByText("2026-07-21 已有 4 / 10 檔更新")).toBeVisible();

  await page.getByRole("button", { name: /選擇台灣單檔 ETF/u }).click();
  await expect(page).toHaveURL(/\/etf\/00981A$/u);
  const etfDate = page.getByLabel("單檔 ETF 資料日期");
  await expect(etfDate).toHaveValue("2026-07-20");

  await page.getByRole("button", { name: "返回台灣 ETF 市場總覽" }).click();
  await expect(page).toHaveURL(/\/market$/u);
  await expect(page.getByLabel("台灣市場資料日期")).toHaveValue("2026-07-20");

  await page.goBack();
  await expect(page).toHaveURL(/\/etf\/00981A$/u);
  await expect(page.getByLabel("單檔 ETF 資料日期")).toHaveValue("2026-07-20");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByLabel("台灣市場資料日期")).toHaveValue("2026-07-20");
});

test("market defaults to high coverage and can open the newer partial date", async ({ page }) => {
  await mockApis(page);
  await page.goto("/market");
  const marketDate = page.getByLabel("台灣市場資料日期");
  await expect(marketDate).toHaveValue("2026-07-20");
  await expect(page.getByText("目前預設顯示涵蓋較完整的 2026-07-20")).toBeVisible();

  await page.getByRole("button", { name: "查看 2026-07-21" }).click();

  await expect(marketDate).toHaveValue("2026-07-21");
  await expect(page.getByText("較新資料持續揭露中")).toHaveCount(0);
  await expect(page.locator(".coverage-status")).toContainText("4 / 10");
});

test("institution cards avoid empty expansion, provide parent navigation, and persist dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page);
  await page.goto("/institutions/ARK13F");
  await expect(page.getByRole("heading", { name: "ARK Investment Management 13F Portfolio" })).toBeVisible();

  await expect(page.locator("article.mobile-data-card")).not.toHaveCount(0);
  await expect(page.locator("details.mobile-data-card")).toHaveCount(0);
  await expect(page.locator(".mobile-card-summary").filter({ hasText: "類型 Equity" })).toHaveCount(1);
  await expect(page.getByText("持倉截止日").first()).toBeVisible();
  await expect(page.getByText("2026-03-31").first()).toBeVisible();
  await expect(page.getByText("SEC 申報日").first()).toBeVisible();
  await expect(page.getByText("2026-05-12").first()).toBeVisible();
  await expect(page.getByText("報表基準日").first()).toBeVisible();
  await expect(page.getByText("申報延遲").first()).toBeVisible();
  await expect(page.getByText(/資料取得日 2026-07-21/u)).toHaveCount(0);

  const themeButton = page.getByRole("button", { name: "切換至深色模式" });
  await expect(themeButton).toHaveCount(1);
  await themeButton.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect(page.getByRole("button", { name: "切換至淺色模式" })).toBeVisible();

  const backButton = page.getByRole("button", { name: "返回機構 13F 清單" });
  await expect(backButton).toHaveCount(1);
  await backButton.click();
  await expect(page).toHaveURL(/\/institutions$/u);
  await expect(page.getByRole("heading", { name: "機構 13F 季度持倉" })).toBeVisible();
});

test("13F without filing metadata only labels reportDate as the report basis", async ({ page }) => {
  const withoutFilingMetadata = {
    ...globalReport,
    sections: globalReport.sections.map((section) => section.etfCode === "ARK13F"
      ? { ...section, filedAt: undefined, capturedAt: undefined }
      : section)
  };
  await mockApis(page, withoutFilingMetadata);
  await page.goto("/institutions/ARK13F");
  await expect(page.getByRole("heading", { name: "ARK Investment Management 13F Portfolio" })).toBeVisible();
  await expect(page.getByText("報表基準日").first()).toBeVisible();
  await expect(page.getByText("SEC 申報日")).toHaveCount(0);
  await expect(page.getByText("系統取得時間")).toHaveCount(0);
  await expect(page.getByText("申報延遲")).toHaveCount(0);
  await expect(page.getByText(/資料取得日/u)).toHaveCount(0);
});

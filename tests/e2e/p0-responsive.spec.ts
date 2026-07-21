import { expect, test, type Page } from "playwright/test";

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

const globalReport = {
  reportDate:"2026-07-21",coveredEtfs:["DRAM","ARK13F"],successCount:2,totalCount:2,highlights:[],statusRows:[],commonHoldings:[],globalMovers:[],adContext:{tags:[]},
  sections:[
    {etfCode:"DRAM",fundName:"Roundhill Memory ETF",issuer:"Roundhill Investments",strategyType:"index",sourceAsOf:"2026-07-20",sourceUrl:"https://example.com/dram",sourceStatus:"verified",rowCount:1,topHoldings:[{ticker:"MU",name:"Micron Technology",weightPercent:18.4,assetType:"Equity",exposureComponents:[{ticker:"MU",name:"Micron",weightPercent:17,assetType:"Equity"},{ticker:"MU SWAP",name:"Micron swap",weightPercent:1.4,assetType:"Swap"}]}],newPositions:[],exitedPositions:[],weightChanges:[{etfCode:"DRAM",ticker:"MU",name:"Micron Technology",currentWeightPercent:18.4,prevWeightPercent:17.2,deltaPp:1.2,status:"increase"}],takeaway:"Memory exposure"},
    {etfCode:"ARK13F",fundName:"ARK Investment Management 13F Portfolio",issuer:"ARK Investment Management",strategyType:"13f",sourceAsOf:"2026-06-30",sourceUrl:"https://www.sec.gov/",sourceStatus:"verified",rowCount:1,topHoldings:[{ticker:"TSLA",name:"Tesla",weightPercent:12,marketValue:1000000,assetType:"Equity"}],newPositions:[],exitedPositions:[],weightChanges:[{etfCode:"ARK13F",ticker:"TSLA",name:"Tesla",currentWeightPercent:12,prevWeightPercent:10,deltaPp:2,status:"increase"}],takeaway:"Quarterly filing"}
  ]
};

async function mockApis(page: Page) {
  await page.route("**/app-version.json*", (route) => route.fulfill({ json: { version: "p0-test" } }));
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    const headers = { "access-control-allow-origin": "*" };
    if (url.includes("/global-etfs/enabled")) return route.fulfill({ headers, json:{productGroup:"global_etf",enabled:[{etfCode:"DRAM",fundName:"Roundhill Memory ETF",strategyType:"index"},{etfCode:"ARK13F",fundName:"ARK Investment Management 13F Portfolio",strategyType:"13f"}],candidates:[]} });
    if (url.includes("/global-etfs/dates")) return route.fulfill({ headers, json:{dates:["2026-07-21"]} });
    if (url.includes("/global-etfs/daily-report")) return route.fulfill({ headers, json:globalReport });
    if (url.includes("/dates")) return route.fulfill({ headers, json:{dates:["2026-07-21"]} });
    if (url.includes("/dashboard")) return route.fulfill({ headers, json:dashboard });
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
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width <= 760) {
      const card = page.locator(".mobile-data-card").first();
      await expect(card).toBeVisible();
      await card.locator("summary").focus();
      await expect.poll(() => card.locator("summary").evaluate((node) => getComputedStyle(node).outlineStyle !== "none")).toBe(true);
      await card.locator("summary").click();
      await expect(card.locator(".mobile-card-detail")).toBeVisible();
      const nav = page.locator(".mobile-primary-nav");
      await expect(nav).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect.poll(() => page.evaluate(() => {
        const footer = document.querySelector(".p0-footer")?.getBoundingClientRect();
        const navRect = document.querySelector(".mobile-primary-nav")?.getBoundingClientRect();
        return Boolean(footer && navRect && footer.bottom <= navRect.top + 1);
      })).toBe(true);
    } else {
      await expect(page.locator(".desktop-data").first()).toBeVisible();
    }
  });
}

test("homepage does not request the full global report and browser history follows URL", async ({ page }) => {
  await mockApis(page);
  const globalReportRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/global-etfs/daily-report")) globalReportRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "主動 ETF 機構調倉情報" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(globalReportRequests).toHaveLength(0);
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

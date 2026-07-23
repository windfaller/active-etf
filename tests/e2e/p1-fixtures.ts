import type { Page } from "playwright/test";

export const p1Overview = {
  found: true, generatedAt: "2026-07-21T08:00:00.000Z", sourceAsOf: "2026-07-21",
  coverage: { tracked: 28, available: 24, delayed: 4 }, confidence: { level: "medium", reason: "4 檔 ETF 延遲" },
  stock: { market: "tw", symbol: "2330", normalizedSymbol: "2330", name: "台積電", sector: "半導體", industry: null },
  summary: { dataDate: "2026-07-21", lastUpdated: "2026-07-21T07:00:00.000Z", coveredEtfs: 3, primarySources: ["投信官方持股", "三大法人"] },
  today: { activeNetLots: 120, surfaceNetLots: 180, scaleAdjustedNetLots: 120, increaseEtfCount: 2, decreaseEtfCount: 1, neutralEtfCount: 1, unknownEtfCount: 0, consensus: { formed: true, direction: "increase", sameDirectionRatio: 2/3 }, institutionRelation: "aligned", primaryEtfs: [] },
  overseasEtfExposure: null, sec13f: null
};

const usOverview = {
  ...p1Overview,
  stock: { market: "us", symbol: "MU", normalizedSymbol: "MU", name: "Micron Technology", sector: "Semiconductors", industry: null },
  summary: { dataDate: "2026-07-19", lastUpdated: "2026-07-20T07:00:00.000Z", coveredEtfs: 1, primarySources: ["海外 ETF 發行商官方持股", "SEC 13F"] },
  today: null,
  overseasEtfExposure: { timeScale: "依發行商實際更新頻率", rows: [{ etfCode: "HBMX", fundName: "Horizon Memory Active ETF", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T07:00:00.000Z", sourceUrl: "https://example.com", sourceStatus: "ok", assetType: "Equity", weightPercent: 8.4, shares: 1000 }] },
  sec13f: { timeScale: "季度申報，非即時持倉", rows: [{ institutionCode: "BRK13F", institutionName: "Berkshire Hathaway", periodOfReport: "2026-06-30", filedAt: "2026-08-12", capturedAt: "2026-08-13T01:00:00.000Z", shares: 100, marketValue: 5000, weightPercent: 1.2, sourceUrl: "https://sec.gov" }] }
};

const history = { generatedAt: "2026-07-21T08:00:00.000Z", sourceAsOf: "2026-07-21", coverage: { tracked: 28, available: 24, delayed: 4 }, confidence: { level: "medium", reason: "部分延遲" }, market: "tw", symbol: "2330", window: 20, summary: { cumulativeActiveNetLots: 300, increaseTradingDays: 3, decreaseTradingDays: 1, consecutive: { direction: "increase", tradingDays: 3, startDate: "2026-07-17", latestDate: "2026-07-21", cumulativeActiveNetLots: 300, actualObservationCount: 17, missingObservationCount: 3 }, reversal: { detected: false, date: null, from: "unknown", to: "increase", priorTradingDays: 0 }, sameDirectionEtfRatio: .67, dataCoverageRate: .85 }, points: [{ date: "2026-07-21", activeNetLots: 120, direction: "increase", sameDirectionEtfRatio: .67 }, { date: "2026-07-18", activeNetLots: 100, direction: "increase", sameDirectionEtfRatio: .75 }, { date: "2026-07-17", activeNetLots: 80, direction: "increase", sameDirectionEtfRatio: .7 }] };
const usHistory = { generatedAt: "2026-07-21T08:00:00.000Z", sourceAsOf: "2026-07-21", coverage: { tracked: 26, available: 24, delayed: 2 }, confidence: { level: "medium", reason: "不同發行商更新日期不一致" }, market: "us", symbol: "MU", window: 20, timeScale: "海外 ETF 發行商持股資料變動點，不等同交易日或成交張數", globalSummary: { cumulativeWeightChangePercentPoints: -.8, increaseChangePoints: 1, decreaseChangePoints: 2, latestDirection: "decrease", actualChangePointCount: 3, requestedChangePointCount: 20 }, points: [{ date: "2026-07-21", weightChangePercentPoints: -.6, direction: "decrease", updatedEtfCount: 2, increaseEtfCount: 1, decreaseEtfCount: 1, neutralEtfCount: 0 }, { date: "2026-07-20", weightChangePercentPoints: .2, direction: "increase", updatedEtfCount: 1, increaseEtfCount: 1, decreaseEtfCount: 0, neutralEtfCount: 0 }, { date: "2026-07-19", weightChangePercentPoints: -.4, direction: "decrease", updatedEtfCount: 1, increaseEtfCount: 0, decreaseEtfCount: 1, neutralEtfCount: 0 }] };
const meta = { generatedAt: "2026-07-21T08:00:00.000Z", sourceAsOf: "2026-07-21", coverage: { tracked: 28, available: 24, delayed: 4 }, confidence: { level: "medium", reason: "部分延遲" } };
const comparison = { ...meta, type: "tw", cards: ["00981A", "00982A"].map((code, index) => ({ code, name: `${code} 測試 ETF`, issuer: "測試投信", sourceAsOf: "2026-07-21", fundSize: 1e9, premiumDiscount: index === 0 ? .1 : -.2, holdingCount: 50, top10Concentration: 55, hhi: .07, sectorExposure: [{ sector: "半導體", weight: 45 }], activeAdjustments: [{ window: 3, cumulativeActiveNetLots: index === 0 ? 100 : -120, adjustmentIntensity: 2, increaseHoldingChangeCount: 5, decreaseHoldingChangeCount: 2 }], addedHoldings: 1, exitedHoldings: 0, dataCoverageRate: .9, topHoldings: [{ key: "2330|Equity", symbol: "2330", name: "台積電", assetType: "Equity", weight: 12 }] })), pairwise: [{ left: "00981A", right: "00982A", intersectionCount: 30, unionCount: 70, similarity: .428, weightedOverlap: 44, common: [{ key: "2330|Equity", label: "2330 台積電", leftWeight: 12, rightWeight: 10 }] }], methodology: { setOverlap: "intersection count 與 Jaccard similarity", weightedOverlap: "Σ min", commonDateOnly: true, missingWeight: "缺少權重不計", exposureIdentity: "代碼與類型" } };
const globalComparison = { ...meta, sourceAsOf: "2026-07-21", type: "global", cards: [{ code: "DRAM", name: "Roundhill Memory ETF", issuer: "Roundhill", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z", fundSize: null, holdingCount: 40, top10Concentration: 60, hhi: .08, sectorExposure: [], assetComposition: [{ assetType: "Equity", weight: 100 }], weightAdjustmentIntensity: 1.2, topHoldings: [{ key: "NVDA|Equity", symbol: "NVDA", name: "NVIDIA", assetType: "Equity", weight: 10 }] }, { code: "HBMX", name: "Horizon Memory Active ETF", issuer: "Horizon", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z", fundSize: null, holdingCount: 35, top10Concentration: 58, hhi: .07, sectorExposure: [], assetComposition: [{ assetType: "Equity", weight: 100 }], weightAdjustmentIntensity: .8, topHoldings: [{ key: "MU|Equity", symbol: "MU", name: "Micron", assetType: "Equity", weight: 8.4 }] }], dateAlignment: { commonDateOnly: false, commonDate: null, rows: [{ code: "DRAM", sourceAsOf: "2026-07-21", fetchedAt: "2026-07-21T12:00:00.000Z" }, { code: "HBMX", sourceAsOf: "2026-07-19", fetchedAt: "2026-07-20T12:00:00.000Z" }] }, pairwise: [{ left: "DRAM", right: "HBMX", intersectionCount: 0, unionCount: 2, similarity: 0, weightedOverlap: 0, common: [] }], methodology: { setOverlap: "intersection count 與 Jaccard similarity", weightedOverlap: "Σ min", commonDateOnly: false, missingWeight: "缺少權重不計", exposureIdentity: "代碼與類型", dateBasis: "逐檔最新有效快照" } };
const signals = {
  ...meta,
  market: "tw",
  window: 20,
  kind: "all",
  methodology: { tradingDays: "有效市場交易日", neutralThreshold: "極小變動為 neutral", consensus: "至少 2 檔且 60%", reversal: "前 2 日" },
  consecutive: [
    { stock: { market: "tw", symbol: "2330", name: "台積電", path: "/stocks/tw/2330" }, direction: "increase", consecutiveTradingDays: 3, cumulativeActiveNetLots: 300, participatingEtfs: 3, sameDirectionEtfRatio: .67, neutralEtfs: 1, startDate: "2026-07-17", latestDate: "2026-07-21", actualObservationCount: 17, missingObservationCount: 3, coverage: meta.coverage, confidence: meta.confidence },
    { stock: { market: "tw", symbol: "2317", name: "鴻海", path: "/stocks/tw/2317" }, direction: "decrease", consecutiveTradingDays: 2, cumulativeActiveNetLots: -220, participatingEtfs: 2, sameDirectionEtfRatio: .75, neutralEtfs: 0, startDate: "2026-07-18", latestDate: "2026-07-21", actualObservationCount: 18, missingObservationCount: 2, coverage: meta.coverage, confidence: meta.confidence }
  ],
  reversals: [
    { stock: { market: "tw", symbol: "2454", name: "聯發科", path: "/stocks/tw/2454" }, coverage: meta.coverage, confidence: meta.confidence, reversalType: "加碼轉減碼", from: "increase", to: "decrease", priorTradingDays: 3, reversalDate: "2026-07-21", beforeActiveNetLots: 180, afterActiveNetLots: -90, majorityEtfDirectionFlip: true, participatingEtfs: 3, sameDirectionEtfRatio: .67 }
  ],
  divergences: [
    { stock: { market: "tw", symbol: "2303", name: "聯電", path: "/stocks/tw/2303" }, coverage: meta.coverage, confidence: meta.confidence, etfDirection: "increase", institutionNetShares: -500000, relation: "divergent", changedFromAligned: true, date: "2026-07-21" }
  ]
};
const style = { ...meta, etf: { code: "00981A", name: "主動統一台股增長", issuer: "統一投信", sourceUrl: "https://example.com" }, period: { window: 20, effectiveTradingDays: 20, startDate: "2026-06-23", endDate: "2026-07-21" }, concentration: { top5: 35, top10: 55, hhi: .07 }, adjustmentBreadth: { averageDailyAdjustedHoldings: 8, latest: { adjusted: 8, increased: 5, decreased: 3, added: 1, exited: 0 }, trend: [] }, adjustmentIntensity: 3.2, sectorRotation: { intensity: 1.8, increased: [{ sector: "半導體", change: 2 }], decreased: [{ sector: "金融", change: -1 }] }, stability: { retention20: .82, retention60: null, averageNewHoldingDuration: null, frequentEntryExitRatio: null }, tendencies: ["集中持股", "調整頻率低", "持股相對穩定"], percentiles: { comparisonGroup: "台灣已啟用主動式 ETF", sampleSize: 28, calculationWindow: 20, dataDate: "2026-07-21", top10Concentration: 78, adjustmentIntensity: 65 }, limitations: ["資料不足，無法計算 60 日比例。"] };

export async function mockP1Apis(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/config")) return route.fulfill({ json: { ads: { enabled: false, trackingEnabled: false } } });
    if (url.includes("/stocks/tw/2330/overview")) return route.fulfill({ json: p1Overview });
    if (url.includes("/stocks/us/MU/overview")) return route.fulfill({ json: usOverview });
    if (/\/stocks\/(tw|us)\/[^/]+\/overview/u.test(url)) return route.fulfill({ status: 404, json: { error: "stock not found" } });
    if (url.includes("/stocks/us/MU/history")) return route.fulfill({ json: usHistory });
    if (url.includes("/stocks/") && url.includes("/history")) return route.fulfill({ json: history });
    if (url.includes("/stocks/us/MU/etfs")) return route.fulfill({ json: { ...meta, rows: [{ etfCode: "HBMX", name: "Horizon Memory Active ETF", latestWeight: 8.4, weightChange: -.2, assetType: "Equity", dataDate: "2026-07-19", confidence: "high" }] } });
    if (url.includes("/stocks/") && url.includes("/etfs")) return route.fulfill({ json: { ...meta, rows: [{ etfCode: "00981A", name: "主動統一台股增長", latestWeight: 12, weightChange: .3, activeNetLots: 80, surfaceNetLots: 100, consecutiveDirection: "increase", consecutiveTradingDays: 3, directionConflict: true, observationCoverage: { expected: 20, actual: 17, missing: 3 }, dataDate: "2026-07-21", confidence: "medium", confidenceReason: "張數與權重方向不一致" }] } });
    if (url.includes("/stocks/us/MU/institutions")) return route.fulfill({ json: { ...meta, timeScale: "13F 季度持倉截止日", rows: usOverview.sec13f.rows } });
    if (url.includes("/stocks/") && url.includes("/institutions")) return route.fulfill({ json: { ...meta, timeScale: "台灣交易日", row: { foreignNetShares: 1000, investmentTrustNetShares: 200, dealerNetShares: -100, totalNetShares: 1100, source: "TWSE", relation: "aligned" } } });
    if (url.includes("/compare/etfs")) return route.fulfill({ json: url.includes("type=global") ? globalComparison : comparison });
    if (url.includes("/signals")) return route.fulfill({ json: signals });
    if (url.includes("/etf/00981A/style")) return route.fulfill({ json: style });
    if (url.includes("/search")) return route.fulfill({ json: { generatedAt: meta.generatedAt, query: "台積電", results: [{ type: "tw_stock", typeLabel: "股票", code: "2330", name: "台積電", market: "台灣", latestDataDate: "2026-07-21", path: "/stocks/tw/2330" }] } });
    if (url.includes("/telegram/info")) return route.fulfill({ json: { configured: false, username: null, subscribeUrl: null } });
    return route.fallback();
  });
}

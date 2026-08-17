import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import { round } from "../../utils/number.js";
import { fetchSource } from "../source/httpClient.js";

export type FundPerformanceMarket = "tw" | "global";
export type FundPerformancePeriod = "d1" | "w1" | "m1" | "m3";
export type FundPriceSource = "market_price" | "nav" | "nasdaq_close";

export interface FundPricePoint {
  date: string;
  price: number;
}

export interface FundPerformanceReturns {
  d1: number | null;
  w1: number | null;
  m1: number | null;
  m3: number | null;
}

export interface FundPerformanceRow {
  market: FundPerformanceMarket;
  etfCode: string;
  fundName: string;
  issuer: string;
  currency: "TWD" | "USD";
  latestDate: string;
  latestPrice: number;
  priceSource: FundPriceSource;
  returns: FundPerformanceReturns;
  observations: number;
}

export interface FundPerformanceSection {
  market: FundPerformanceMarket;
  sourceName: string;
  sourceUrl: string;
  trackedCount: number;
  availableCount: number;
  unavailableCodes: string[];
  rows: FundPerformanceRow[];
}

export interface FundPerformanceResponse {
  generatedAt: string;
  requestedDate: string | null;
  periods: Array<{ key: FundPerformancePeriod; label: string; methodology: string }>;
  sections: {
    tw: FundPerformanceSection;
    global: FundPerformanceSection;
  };
  methodology: {
    returnType: string;
    dateAlignment: string;
    dividendTreatment: string;
    missingData: string;
  };
}

interface NasdaqHistoryResponse {
  data?: {
    tradesTable?: {
      rows?: Array<{ date?: string; close?: string }>;
    };
  } | null;
}

const performancePeriods: FundPerformanceResponse["periods"] = [
  { key: "d1", label: "1 日", methodology: "與前一個有效交易日比較" },
  { key: "w1", label: "1 週", methodology: "與 7 個日曆日前最近一個有效交易日比較" },
  { key: "m1", label: "1 個月", methodology: "與 30 個日曆日前最近一個有效交易日比較" },
  { key: "m3", label: "3 個月", methodology: "與 90 個日曆日前最近一個有效交易日比較" }
];

function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return isoDateFromUtc(value);
}

function calendarDayDistance(left: string, right: string): number {
  return Math.round(
    Math.abs(new Date(`${left}T00:00:00.000Z`).getTime() - new Date(`${right}T00:00:00.000Z`).getTime()) / 86_400_000
  );
}

function normalizePoints(points: FundPricePoint[], requestedDate?: string): FundPricePoint[] {
  const byDate = new Map<string, FundPricePoint>();
  for (const point of points) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(point.date) || !Number.isFinite(point.price) || point.price <= 0) continue;
    if (requestedDate && point.date > requestedDate) continue;
    byDate.set(point.date, point);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function baselineAtOrBefore(points: FundPricePoint[], targetDate: string, maxGapDays: number): FundPricePoint | null {
  const baseline = [...points].reverse().find((point) => point.date <= targetDate) ?? null;
  if (!baseline || calendarDayDistance(baseline.date, targetDate) > maxGapDays) return null;
  return baseline;
}

function percentageReturn(current: FundPricePoint, baseline: FundPricePoint | null): number | null {
  if (!baseline || baseline.price <= 0) return null;
  return round(((current.price / baseline.price) - 1) * 100, 2);
}

export function calculateFundPerformance(points: FundPricePoint[], requestedDate?: string): {
  current: FundPricePoint;
  returns: FundPerformanceReturns;
  observations: number;
} | null {
  const normalized = normalizePoints(points, requestedDate);
  const current = normalized.at(-1);
  if (!current) return null;
  const previous = normalized.at(-2) ?? null;
  return {
    current,
    observations: normalized.length,
    returns: {
      d1: percentageReturn(current, previous),
      w1: percentageReturn(current, baselineAtOrBefore(normalized, subtractDays(current.date, 7), 7)),
      m1: percentageReturn(current, baselineAtOrBefore(normalized, subtractDays(current.date, 30), 10)),
      m3: percentageReturn(current, baselineAtOrBefore(normalized, subtractDays(current.date, 90), 14))
    }
  };
}

function parseNasdaqDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value.trim());
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

function parseNasdaqPrice(value: string): number | null {
  const parsed = Number(value.replace(/[$,]/gu, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseNasdaqPriceHistory(payload: unknown): FundPricePoint[] {
  const rows = (payload as NasdaqHistoryResponse)?.data?.tradesTable?.rows ?? [];
  return rows.flatMap((row) => {
    const date = row.date ? parseNasdaqDate(row.date) : null;
    const price = row.close ? parseNasdaqPrice(row.close) : null;
    return date && price !== null ? [{ date, price }] : [];
  });
}

function currentTaipeiDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function taiwanSeries(rows: EtfDailySummary[]): { source: "market_price" | "nav"; points: FundPricePoint[] } | null {
  const candidates = (["marketPrice", "nav"] as const).map((field) => ({
    source: field === "marketPrice" ? "market_price" as const : "nav" as const,
    points: rows.flatMap((row) => {
      const price = row[field];
      return price !== null && price > 0 ? [{ date: row.tradeDate, price }] : [];
    })
  })).filter((candidate) => candidate.points.length > 0);
  return candidates.sort((a, b) => {
    const dateDifference = (b.points.at(-1)?.date ?? "").localeCompare(a.points.at(-1)?.date ?? "");
    if (dateDifference) return dateDifference;
    if (a.source === b.source) return 0;
    return a.source === "market_price" ? -1 : 1;
  })[0] ?? null;
}

async function taiwanPerformance(db: Db, requestedDate: string | undefined): Promise<FundPerformanceSection> {
  const funds = configuredEtfs.filter((etf) => etf.enabled);
  const toDate = requestedDate ?? currentTaipeiDate();
  const fromDate = subtractDays(toDate, 120);
  const rows = await db.collection<EtfDailySummary>("etf_daily_summary")
    .find({ etfCode: { $in: funds.map((fund) => fund.etfCode) }, tradeDate: { $gte: fromDate, $lte: toDate } })
    .sort({ tradeDate: 1 })
    .toArray();
  const rowsByCode = new Map<string, EtfDailySummary[]>();
  for (const row of rows) rowsByCode.set(row.etfCode, [...(rowsByCode.get(row.etfCode) ?? []), row]);

  const performanceRows = funds.flatMap<FundPerformanceRow>((fund) => {
    const series = taiwanSeries(rowsByCode.get(fund.etfCode) ?? []);
    const performance = series ? calculateFundPerformance(series.points, requestedDate) : null;
    if (!series || !performance) return [];
    return [{
      market: "tw",
      etfCode: fund.etfCode,
      fundName: fund.name,
      issuer: fund.issuer,
      currency: "TWD",
      latestDate: performance.current.date,
      latestPrice: performance.current.price,
      priceSource: series.source,
      returns: performance.returns,
      observations: performance.observations
    }];
  });
  const available = new Set(performanceRows.map((row) => row.etfCode));
  return {
    market: "tw",
    sourceName: "各投信公開淨值／證交所收盤市價",
    sourceUrl: "https://www.twse.com.tw/",
    trackedCount: funds.length,
    availableCount: performanceRows.length,
    unavailableCodes: funds.map((fund) => fund.etfCode).filter((code) => !available.has(code)),
    rows: performanceRows
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await worker(item);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchNasdaqHistory(etfCode: string, requestedDate?: string): Promise<FundPricePoint[]> {
  const toDate = requestedDate ?? currentTaipeiDate();
  const params = new URLSearchParams({
    assetclass: "etf",
    fromdate: subtractDays(toDate, 120),
    todate: toDate,
    limit: "500"
  });
  const response = await fetchSource({
    url: `https://api.nasdaq.com/api/quote/${encodeURIComponent(etfCode)}/historical?${params.toString()}`,
    timeoutMs: 8_000,
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `https://www.nasdaq.com/market-activity/etf/${etfCode.toLowerCase()}/historical`
    }
  });
  if (response.responseStatus !== 200) return [];
  try {
    return parseNasdaqPriceHistory(JSON.parse(response.rawBody));
  } catch {
    return [];
  }
}

async function globalPerformance(requestedDate: string | undefined): Promise<FundPerformanceSection> {
  const funds = enabledGlobalEtfs.filter((etf) => etf.strategyType !== "13f");
  const performanceRows = (await mapWithConcurrency(funds, 6, async (fund): Promise<FundPerformanceRow | null> => {
    try {
      const performance = calculateFundPerformance(await fetchNasdaqHistory(fund.etfCode, requestedDate), requestedDate);
      if (!performance) return null;
      return {
        market: "global",
        etfCode: fund.etfCode,
        fundName: fund.fundName,
        issuer: fund.issuer,
        currency: "USD",
        latestDate: performance.current.date,
        latestPrice: performance.current.price,
        priceSource: "nasdaq_close",
        returns: performance.returns,
        observations: performance.observations
      };
    } catch {
      return null;
    }
  })).filter((row): row is FundPerformanceRow => row !== null);
  const available = new Set(performanceRows.map((row) => row.etfCode));
  return {
    market: "global",
    sourceName: "Nasdaq Historical",
    sourceUrl: "https://www.nasdaq.com/market-activity/etf",
    trackedCount: funds.length,
    availableCount: performanceRows.length,
    unavailableCodes: funds.map((fund) => fund.etfCode).filter((code) => !available.has(code)),
    rows: performanceRows
  };
}

export async function fundPerformanceRankings(db: Db, requestedDate?: string): Promise<FundPerformanceResponse> {
  const [tw, global] = await Promise.all([
    taiwanPerformance(db, requestedDate),
    globalPerformance(requestedDate)
  ]);
  return {
    generatedAt: new Date().toISOString(),
    requestedDate: requestedDate ?? null,
    periods: performancePeriods,
    sections: { tw, global },
    methodology: {
      returnType: "以同一檔 ETF 的期末市價除以期初市價計算百分比變化",
      dateAlignment: "各 ETF 使用自身最近有效交易日，並逐列顯示資料日；期間基準採目標日前最近有效交易日",
      dividendTreatment: "目前為市價漲跌幅，不含配息再投資，因此不是總報酬率",
      missingData: "沒有足夠歷史價格的期間顯示為無資料，且不納入該期間排序"
    }
  };
}

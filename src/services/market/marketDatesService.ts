import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";

export const MARKET_DATE_COVERAGE_THRESHOLD = 0.7;
export const MARKET_DATE_COVERAGE_WINDOW = 5;

export interface MarketDateCoverage {
  date: string;
  availableCount: number;
  trackedCount: number;
  coverageRate: number;
}

export interface MarketDateOverview {
  dates: string[];
  recommendedDate: string | null;
  coverage: MarketDateCoverage[];
}

export function safeMarketDateLimit(limit = 180): number {
  return Math.max(1, Math.min(Math.trunc(limit) || 180, 365));
}

export async function availableMarketDates(db: Db, limit = 180): Promise<string[]> {
  const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
  const rows = await db
    .collection<EtfHoldingChange>("etf_holding_changes")
    .aggregate<{ _id: string }>([
      {
        $match: {
          etfCode: { $in: enabledCodes },
          tradeDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" }
        }
      },
      { $group: { _id: "$tradeDate" } },
      { $sort: { _id: -1 } },
      { $limit: safeMarketDateLimit(limit) }
    ])
    .toArray();

  return rows.map((row) => row._id);
}

export function selectRecommendedMarketDate(
  coverage: MarketDateCoverage[],
  threshold = MARKET_DATE_COVERAGE_THRESHOLD
): string | null {
  const qualifying = coverage.find((row) => row.coverageRate >= threshold);
  if (qualifying) return qualifying.date;

  return [...coverage].sort((a, b) => {
    if (a.availableCount !== b.availableCount) return b.availableCount - a.availableCount;
    return b.date.localeCompare(a.date);
  })[0]?.date ?? null;
}

export async function marketDateOverview(db: Db, limit = 180): Promise<MarketDateOverview> {
  const dates = await availableMarketDates(db, limit);
  const candidateDates = dates.slice(0, MARKET_DATE_COVERAGE_WINDOW);
  const enabledCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);

  if (!candidateDates.length || !enabledCodes.length) {
    return { dates, recommendedDate: dates[0] ?? null, coverage: [] };
  }

  const summaryRows = await db
    .collection<EtfDailySummary>("etf_daily_summary")
    .find(
      { etfCode: { $in: enabledCodes }, tradeDate: { $in: candidateDates } },
      { projection: { _id: 0, etfCode: 1, tradeDate: 1 } }
    )
    .toArray();
  const codesByDate = new Map<string, Set<string>>();
  for (const row of summaryRows) {
    const codes = codesByDate.get(row.tradeDate) ?? new Set<string>();
    codes.add(row.etfCode);
    codesByDate.set(row.tradeDate, codes);
  }

  const coverage = candidateDates.map((date) => {
    const availableCount = codesByDate.get(date)?.size ?? 0;
    return {
      date,
      availableCount,
      trackedCount: enabledCodes.length,
      coverageRate: availableCount / enabledCodes.length
    };
  });

  return {
    dates,
    recommendedDate: selectRecommendedMarketDate(coverage) ?? dates[0] ?? null,
    coverage
  };
}

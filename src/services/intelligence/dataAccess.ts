import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import { availableMarketDates, marketDateOverview } from "../market/marketDatesService.js";

export const enabledTaiwanEtfCodes = configuredEtfs.filter((etf) => etf.enabled).map((etf) => etf.etfCode);
export const enabledDailyGlobalEtfCodes = enabledGlobalEtfs.filter((etf) => etf.strategyType !== "13f").map((etf) => etf.etfCode);
export const enabledInstitutionCodes = enabledGlobalEtfs.filter((etf) => etf.strategyType === "13f").map((etf) => etf.etfCode);

export interface IntelligenceCoverage {
  tracked: number;
  available: number;
  delayed: number;
}

export async function effectiveTaiwanDates(db: Db, date: string | undefined, limit: number): Promise<string[]> {
  const queryLimit = Math.max(limit * 2, 40);
  if (date) {
    const dates = await availableMarketDates(db, queryLimit);
    return dates.filter((candidate) => candidate <= date).slice(0, limit);
  }

  const overview = await marketDateOverview(db, queryLimit);
  const anchorDate = overview.recommendedDate ?? overview.dates[0];
  const eligible = anchorDate ? overview.dates.filter((candidate) => candidate <= anchorDate) : [];
  return eligible.slice(0, limit);
}

export async function taiwanCoverageForDate(db: Db, date: string | null): Promise<IntelligenceCoverage> {
  if (!date) return { tracked: enabledTaiwanEtfCodes.length, available: 0, delayed: enabledTaiwanEtfCodes.length };
  const available = await db.collection<EtfDailySummary>("etf_daily_summary").distinct("etfCode", {
    tradeDate: date,
    etfCode: { $in: enabledTaiwanEtfCodes }
  });
  return {
    tracked: enabledTaiwanEtfCodes.length,
    available: available.length,
    delayed: Math.max(0, enabledTaiwanEtfCodes.length - available.length)
  };
}

export async function globalCoverageForDate(db: Db, date: string | null): Promise<IntelligenceCoverage> {
  const filter: Record<string, unknown> = {
    etfCode: { $in: enabledDailyGlobalEtfCodes },
    strategyType: { $ne: "13f" },
    sourceStatus: "ok"
  };
  if (date) filter.sourceAsOf = date;
  const available = await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").distinct("etfCode", filter);
  return {
    tracked: enabledDailyGlobalEtfCodes.length,
    available: available.length,
    delayed: Math.max(0, enabledDailyGlobalEtfCodes.length - available.length)
  };
}

export async function latestGlobalSourceDate(db: Db, etfCodes = enabledDailyGlobalEtfCodes): Promise<string | null> {
  const row = await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
    { etfCode: { $in: etfCodes }, strategyType: { $ne: "13f" }, sourceStatus: "ok" },
    { sort: { sourceAsOf: -1, fetchedAt: -1 }, projection: { _id: 0, sourceAsOf: 1 } }
  );
  return row?.sourceAsOf ?? null;
}

export async function changesForDates(db: Db, dates: string[], stockId?: string): Promise<EtfHoldingChange[]> {
  if (!dates.length) return [];
  return db.collection<EtfHoldingChange>("etf_holding_changes").find({
    etfCode: { $in: enabledTaiwanEtfCodes },
    tradeDate: { $in: dates },
    ...(stockId ? { stockId } : {})
  }).toArray();
}

export function generatedAt(): string {
  return new Date().toISOString();
}

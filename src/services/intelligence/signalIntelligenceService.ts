import type { Db } from "mongodb";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import { confidenceForSignal, consecutiveDirection, detectReversal, relationBetweenEtfAndInstitution } from "./calculations.js";
import { effectiveTaiwanDates, enabledTaiwanEtfCodes, generatedAt, taiwanCoverageForDate } from "./dataAccess.js";
import { aggregateTaiwanDay, groupTaiwanDays } from "./stockIntelligenceService.js";

export type SignalKind = "all" | "consecutive" | "reversals" | "divergence";

export async function intelligenceSignals(
  db: Db,
  kind: SignalKind,
  window: 3 | 5 | 20,
  limit: number,
  date?: string
) {
  const dates = await effectiveTaiwanDates(db, date, Math.max(window, 5));
  const sourceAsOf = dates[0] ?? null;
  const changes = dates.length ? await db.collection<EtfHoldingChange>("etf_holding_changes").find({
    etfCode: { $in: enabledTaiwanEtfCodes },
    tradeDate: { $in: dates },
    $or: [{ activeDiffLots: { $ne: null } }, { diffWeightPoint: { $ne: null } }]
  }).limit(150_000).toArray() : [];
  const byStock = new Map<string, EtfHoldingChange[]>();
  for (const row of changes) byStock.set(row.stockId, [...(byStock.get(row.stockId) ?? []), row]);
  const stockIds = [...byStock.keys()];
  const institutionalRows = stockIds.length && dates.length
    ? await db.collection<StockInstitutionalFlow>("stock_institutional_flows").find({ stockId: { $in: stockIds }, tradeDate: { $in: dates.slice(0, 2) } }).toArray()
    : [];
  const institutions = new Map(institutionalRows.map((row) => [`${row.stockId}|${row.tradeDate}`, row]));
  const coverage = await taiwanCoverageForDate(db, sourceAsOf);

  const consecutive = [];
  const reversals = [];
  const divergences = [];

  for (const [stockId, rows] of byStock) {
    const days = groupTaiwanDays(dates, rows);
    const observations = days.map((row) => ({ date: row.date, direction: row.direction, activeNetLots: row.activeNetLots }));
    const streak = consecutiveDirection(observations);
    const reversal = detectReversal(observations);
    const current = days[0] ?? aggregateTaiwanDay(sourceAsOf ?? "", []);
    const currentInstitution = sourceAsOf ? institutions.get(`${stockId}|${sourceAsOf}`) : undefined;
    const previousDate = dates[1];
    const previousInstitution = previousDate ? institutions.get(`${stockId}|${previousDate}`) : undefined;
    const currentRelation = relationBetweenEtfAndInstitution(current.direction, currentInstitution?.totalNetShares ?? null);
    const previousRelation = relationBetweenEtfAndInstitution(days[1]?.direction ?? "unknown", previousInstitution?.totalNetShares ?? null);
    const rowCoverage = {
      tracked: coverage.tracked,
      available: current.availableEtfs,
      delayed: Math.max(0, coverage.tracked - current.availableEtfs)
    };
    const confidence = confidenceForSignal({
      ...rowCoverage,
      scaleComplete: current.scaleCompleteEtfs,
      requiredObservations: window,
      actualObservations: days.filter((row) => row.availableEtfs > 0).length,
      dominantShare: current.dominantShare,
      directionalRatio: current.sameDirectionEtfRatio
    });
    const stockName = rows[0]?.stockName ?? stockId;

    if (streak.tradingDays >= 2) {
      consecutive.push({
        stock: { market: "tw", symbol: stockId, name: stockName, path: `/stocks/tw/${stockId}` },
        direction: streak.direction,
        consecutiveTradingDays: streak.tradingDays,
        cumulativeActiveNetLots: streak.cumulativeActiveNetLots,
        participatingEtfs: current.directionalEtfCount,
        sameDirectionEtfRatio: current.sameDirectionEtfRatio,
        neutralEtfs: current.neutralEtfCount,
        startDate: streak.startDate,
        latestDate: streak.latestDate,
        coverage: rowCoverage,
        confidence
      });
    }

    if (reversal.detected) {
      reversals.push({
        stock: { market: "tw", symbol: stockId, name: stockName, path: `/stocks/tw/${stockId}` },
        reversalType: reversal.from === "increase" ? "連續加碼後轉為減碼" : "連續減碼後轉為加碼",
        from: reversal.from,
        to: reversal.to,
        priorTradingDays: reversal.priorTradingDays,
        reversalDate: reversal.date,
        beforeActiveNetLots: reversal.beforeActiveNetLots,
        afterActiveNetLots: reversal.afterActiveNetLots,
        majorityEtfDirectionFlip: days[1]?.hasConsensus === true && current.hasConsensus && days[1].consensusDirection !== current.consensusDirection,
        participatingEtfs: current.directionalEtfCount,
        sameDirectionEtfRatio: current.sameDirectionEtfRatio,
        coverage: rowCoverage,
        confidence
      });
    }

    if (currentRelation === "divergent") {
      divergences.push({
        stock: { market: "tw", symbol: stockId, name: stockName, path: `/stocks/tw/${stockId}` },
        etfDirection: current.direction,
        institutionNetShares: currentInstitution?.totalNetShares ?? null,
        relation: currentRelation,
        changedFromAligned: previousRelation === "aligned",
        date: sourceAsOf,
        coverage: rowCoverage,
        confidence
      });
    }
  }

  consecutive.sort((a, b) => b.consecutiveTradingDays - a.consecutiveTradingDays || Math.abs(b.cumulativeActiveNetLots ?? 0) - Math.abs(a.cumulativeActiveNetLots ?? 0));
  reversals.sort((a, b) => Math.abs(b.afterActiveNetLots ?? 0) - Math.abs(a.afterActiveNetLots ?? 0));
  divergences.sort((a, b) => Math.abs(b.institutionNetShares ?? 0) - Math.abs(a.institutionNetShares ?? 0));
  const overallConfidence = confidenceForSignal({ ...coverage, scaleComplete: coverage.available, requiredObservations: window, actualObservations: dates.length, dominantShare: null, directionalRatio: null });
  return {
    generatedAt: generatedAt(),
    sourceAsOf,
    coverage,
    confidence: overallConfidence,
    market: "tw",
    window,
    kind,
    methodology: {
      tradingDays: "使用資料庫中的有效市場交易日，不使用日曆天。",
      neutralThreshold: "主動淨變動絕對值不超過 0.01 張且權重變化不超過 0.0001 個百分點時視為 neutral。",
      reversal: "反轉前至少 2 個有效交易日同方向，反轉日需跨過 neutral 門檻。",
      consensus: "同方向至少 2 檔、多於反方向且占 directional ETF 至少 60%；neutral 另列。"
    },
    consecutive: kind === "all" || kind === "consecutive" ? consecutive.slice(0, limit) : [],
    reversals: kind === "all" || kind === "reversals" ? reversals.slice(0, limit) : [],
    divergences: kind === "all" || kind === "divergence" ? divergences.slice(0, limit) : []
  };
}

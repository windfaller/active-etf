import type { Db } from "mongodb";
import { enabledGlobalEtfs, findGlobalEtfConfig } from "../../config/globalEtfs.js";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { GlobalEtfHolding, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { round } from "../../utils/number.js";
import { preferredStockName } from "../market/stockImpactService.js";
import {
  confidenceForSignal,
  consecutiveDirection,
  consensusFromDirections,
  detectReversal,
  directionForChange,
  hasDirectionConflict,
  relationBetweenEtfAndInstitution,
  type DailyDirectionObservation,
  type SignalDirection
} from "./calculations.js";
import {
  changesForDates,
  effectiveTaiwanDates,
  enabledDailyGlobalEtfCodes,
  enabledInstitutionCodes,
  enabledTaiwanEtfCodes,
  generatedAt,
  globalCoverageForDate,
  latestGlobalSourceDate,
  taiwanCoverageForDate
} from "./dataAccess.js";

export type StockMarket = "tw" | "us";

export interface DailyAggregate {
  date: string;
  activeNetLots: number | null;
  surfaceNetLots: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  neutralEtfCount: number;
  unknownEtfCount: number;
  directionalEtfCount: number;
  sameDirectionEtfRatio: number | null;
  consensusDirection: SignalDirection;
  hasConsensus: boolean;
  direction: SignalDirection;
  availableEtfs: number;
  scaleCompleteEtfs: number;
  dominantShare: number | null;
  directionConflictCount: number;
}

function normalizeSymbol(market: StockMarket, symbol: string): string {
  return market === "us" ? symbol.trim().toUpperCase() : symbol.trim();
}

function activeValue(change: EtfHoldingChange): number | null {
  return change.activeDiffLots;
}

export function aggregateTaiwanDay(date: string, rows: EtfHoldingChange[]): DailyAggregate {
  const directions = rows.map((row) => directionForChange({ activeDiffLots: activeValue(row), diffWeightPoint: row.diffWeightPoint }));
  const directionConflictCount = rows.filter((row) => hasDirectionConflict({ activeDiffLots: activeValue(row), diffWeightPoint: row.diffWeightPoint })).length;
  const consensus = consensusFromDirections(directions);
  const activeValues = rows.map(activeValue).filter((value): value is number => value !== null);
  const absoluteTotal = activeValues.reduce((sum, value) => sum + Math.abs(value), 0);
  const maxMagnitude = activeValues.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const activeNetLots = activeValues.length ? round(activeValues.reduce((sum, value) => sum + value, 0)) : null;
  const direction = activeNetLots === null
    ? "unknown"
    : directionForChange({ activeDiffLots: activeNetLots, diffWeightPoint: null });
  return {
    date,
    activeNetLots,
    surfaceNetLots: round(rows.reduce((sum, row) => sum + row.diffLots, 0)),
    increaseEtfCount: directions.filter((value) => value === "increase").length,
    decreaseEtfCount: directions.filter((value) => value === "decrease").length,
    neutralEtfCount: directions.filter((value) => value === "neutral").length,
    unknownEtfCount: directions.filter((value) => value === "unknown").length,
    directionalEtfCount: consensus.directionalEtfCount,
    sameDirectionEtfRatio: consensus.ratio,
    consensusDirection: consensus.direction,
    hasConsensus: consensus.hasConsensus,
    direction,
    availableEtfs: new Set(rows.map((row) => row.etfCode)).size,
    scaleCompleteEtfs: new Set(rows.filter((row) => row.activeDiffLots !== null).map((row) => row.etfCode)).size,
    dominantShare: absoluteTotal > 0 ? maxMagnitude / absoluteTotal : null,
    directionConflictCount
  };
}

export function groupTaiwanDays(dates: string[], changes: EtfHoldingChange[]): DailyAggregate[] {
  const byDate = new Map<string, EtfHoldingChange[]>();
  for (const row of changes) byDate.set(row.tradeDate, [...(byDate.get(row.tradeDate) ?? []), row]);
  return dates.map((date) => aggregateTaiwanDay(date, byDate.get(date) ?? []));
}

function latestHoldingForTicker(snapshot: GlobalEtfSnapshot, symbol: string): GlobalEtfHolding[] {
  return snapshot.holdings.filter((holding) => holding.ticker?.trim().toUpperCase() === symbol);
}

export function latestSnapshotsForStockPipeline(symbol: string, include13f: boolean) {
  const codes = include13f ? enabledInstitutionCodes : enabledDailyGlobalEtfCodes;
  return [
    {
      $match: {
        etfCode: { $in: codes },
        strategyType: include13f ? "13f" : { $ne: "13f" },
        sourceStatus: "ok",
        sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" }
      }
    },
    { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: "$etfCode", snapshot: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$snapshot" } },
    { $match: { holdings: { $elemMatch: { ticker: symbol } } } },
    { $sort: { sourceAsOf: -1, etfCode: 1 } }
  ];
}

export async function globalSnapshotsForStock(db: Db, symbol: string, include13f: boolean): Promise<GlobalEtfSnapshot[]> {
  return db.collection<GlobalEtfSnapshot>("global_etf_snapshots").aggregate<GlobalEtfSnapshot>(
    latestSnapshotsForStockPipeline(symbol, include13f)
  ).toArray();
}

export function latestStockSearchPipeline(normalizedQuery: string, limit: number) {
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const usEscaped = normalizedQuery.toUpperCase().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [
    { $match: { etfCode: { $in: enabledDailyGlobalEtfCodes }, strategyType: { $ne: "13f" }, sourceStatus: "ok", sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } } },
    { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: "$etfCode", snapshot: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$snapshot" } },
    { $unwind: "$holdings" },
    { $match: { $or: [{ "holdings.ticker": { $regex: `^${usEscaped}`, $options: "i" } }, { "holdings.name": { $regex: `^${escaped}`, $options: "i" } }] } },
    { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: { $toUpper: "$holdings.ticker" }, name: { $first: "$holdings.name" }, sector: { $first: "$holdings.sector" }, sourceAsOf: { $first: "$sourceAsOf" } } },
    { $limit: Math.max(0, limit) },
    { $project: { _id: 0, ticker: "$_id", name: 1, sector: 1, sourceAsOf: 1 } }
  ];
}

async function previousGlobalSnapshots(db: Db, snapshots: GlobalEtfSnapshot[]): Promise<Map<string, GlobalEtfSnapshot>> {
  const pairs = await Promise.all(snapshots.map(async (snapshot) => {
    const previous = await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
      { etfCode: snapshot.etfCode, sourceAsOf: { $lt: snapshot.sourceAsOf }, sourceStatus: "ok" },
      { sort: { sourceAsOf: -1, fetchedAt: -1 } }
    );
    return [snapshot.etfCode, previous] as const;
  }));
  const result = new Map<string, GlobalEtfSnapshot>();
  for (const [code, snapshot] of pairs) {
    if (snapshot) result.set(code, snapshot);
  }
  return result;
}

function globalStockName(symbol: string, snapshots: GlobalEtfSnapshot[]): string {
  return snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol)).find((holding) => holding.name)?.name ?? symbol;
}

export async function searchStocks(db: Db, query: string, market: StockMarket | undefined, limit: number) {
  const normalizedQuery = query.trim();
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const results: Array<{ market: StockMarket; symbol: string; normalizedSymbol: string; name: string; sector: string | null; latestDataDate: string | null; path: string }> = [];

  if (!market || market === "tw") {
    const profiles = await db.collection<StockSectorProfile>("stock_sector_profiles").find(
      { $or: [{ stockId: { $regex: `^${escaped}`, $options: "i" } }, { stockName: { $regex: `^${escaped}`, $options: "i" } }] },
      { limit, projection: { _id: 0, stockId: 1, stockName: 1, sector: 1 } }
    ).toArray();
    for (const profile of profiles) {
      results.push({ market: "tw", symbol: profile.stockId, normalizedSymbol: profile.stockId, name: profile.stockName ?? profile.stockId, sector: profile.sector, latestDataDate: null, path: `/stocks/tw/${profile.stockId}` });
    }
  }

  if ((!market || market === "us") && results.length < limit) {
    const rows = await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").aggregate<{
      ticker: string;
      name: string;
      sector?: string;
      sourceAsOf: string;
    }>(latestStockSearchPipeline(normalizedQuery, limit - results.length)).toArray();
    for (const row of rows) {
      if (!row.ticker) continue;
      results.push({ market: "us", symbol: row.ticker, normalizedSymbol: row.ticker, name: row.name, sector: row.sector ?? null, latestDataDate: row.sourceAsOf, path: `/stocks/us/${row.ticker}` });
    }
  }
  return { generatedAt: generatedAt(), query: normalizedQuery, results: results.slice(0, limit) };
}

async function taiwanStockBase(db: Db, symbol: string, date?: string) {
  const dates = await effectiveTaiwanDates(db, date, 20);
  const sourceAsOf = dates[0] ?? null;
  const [changes, profile, institutional, coverage] = await Promise.all([
    changesForDates(db, dates, symbol),
    db.collection<StockSectorProfile>("stock_sector_profiles").findOne({ stockId: symbol }),
    sourceAsOf ? db.collection<StockInstitutionalFlow>("stock_institutional_flows").findOne({ stockId: symbol, tradeDate: sourceAsOf }) : null,
    taiwanCoverageForDate(db, sourceAsOf)
  ]);
  const days = groupTaiwanDays(dates, changes);
  const currentRows = changes.filter((row) => row.tradeDate === sourceAsOf);
  const name = preferredStockName(profile?.stockName, institutional?.stockName, currentRows[0]?.stockName, symbol);
  return { dates, sourceAsOf, changes, profile, institutional, coverage, days, currentRows, name };
}

export async function stockOverview(db: Db, market: StockMarket, rawSymbol: string, date?: string) {
  const symbol = normalizeSymbol(market, rawSymbol);
  if (market === "tw") {
    const base = await taiwanStockBase(db, symbol, date);
    const current = base.days[0] ?? aggregateTaiwanDay(base.sourceAsOf ?? "", []);
    const confidence = confidenceForSignal({
      ...base.coverage,
      scaleComplete: current.scaleCompleteEtfs,
      requiredObservations: 3,
      actualObservations: base.days.filter((row) => row.availableEtfs > 0).length,
      dominantShare: current.dominantShare,
      directionalRatio: current.sameDirectionEtfRatio,
      directionConflictCount: current.directionConflictCount
    });
    const primaryEtfs = [...base.currentRows]
      .sort((a, b) => Math.abs(b.activeDiffLots ?? 0) - Math.abs(a.activeDiffLots ?? 0))
      .slice(0, 4)
      .map((row) => ({
        etfCode: row.etfCode,
        activeDiffLots: row.activeDiffLots,
        diffLots: row.diffLots,
        direction: directionForChange({ activeDiffLots: row.activeDiffLots, diffWeightPoint: row.diffWeightPoint }),
        directionConflict: hasDirectionConflict({ activeDiffLots: row.activeDiffLots, diffWeightPoint: row.diffWeightPoint })
      }));
    const institutionRelation = relationBetweenEtfAndInstitution(current.direction, base.institutional?.totalNetShares ?? null);
    return {
      generatedAt: generatedAt(),
      found: Boolean(base.profile || base.institutional || base.currentRows.length),
      sourceAsOf: base.sourceAsOf,
      coverage: base.coverage,
      confidence,
      stock: { market, symbol, normalizedSymbol: symbol, name: base.name, sector: base.profile?.sector ?? "其他", industry: null },
      summary: { dataDate: base.sourceAsOf, lastUpdated: base.currentRows.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null)?.toISOString() ?? null, coveredEtfs: current.availableEtfs, primarySources: ["投信官方持股", "證交所／櫃買中心三大法人"] },
      today: {
        activeNetLots: current.activeNetLots,
        surfaceNetLots: current.surfaceNetLots,
        scaleAdjustedNetLots: current.activeNetLots,
        increaseEtfCount: current.increaseEtfCount,
        decreaseEtfCount: current.decreaseEtfCount,
        neutralEtfCount: current.neutralEtfCount,
        unknownEtfCount: current.unknownEtfCount,
        consensus: { formed: current.hasConsensus, direction: current.consensusDirection, sameDirectionRatio: current.sameDirectionEtfRatio },
        institutionRelation,
        primaryEtfs
      },
      overseasEtfExposure: null,
      sec13f: null
    };
  }

  const [snapshots, institutions] = await Promise.all([
    globalSnapshotsForStock(db, symbol, false),
    globalSnapshotsForStock(db, symbol, true)
  ]);
  const sourceAsOf = snapshots[0]?.sourceAsOf ?? await latestGlobalSourceDate(db);
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  const exposures = snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol).map((holding) => ({
    etfCode: snapshot.etfCode,
    fundName: snapshot.fundName,
    sourceAsOf: snapshot.sourceAsOf,
    fetchedAt: snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt.toISOString() : String(snapshot.fetchedAt),
    sourceUrl: snapshot.sourceUrl,
    sourceStatus: snapshot.sourceStatus,
    assetType: holding.assetType ?? "Unknown",
    weightPercent: holding.weightPercent ?? null,
    shares: holding.shares ?? null
  })));
  const confidence = confidenceForSignal({ ...coverage, scaleComplete: coverage.available, requiredObservations: 1, actualObservations: snapshots.length ? 1 : 0, dominantShare: null, directionalRatio: null });
  return {
    generatedAt: generatedAt(),
    found: snapshots.length > 0 || institutions.length > 0,
    sourceAsOf,
    coverage,
    confidence,
    stock: { market, symbol, normalizedSymbol: symbol, name: globalStockName(symbol, [...snapshots, ...institutions]), sector: latestHoldingForTicker(snapshots[0] ?? ({ holdings: [] } as unknown as GlobalEtfSnapshot), symbol)[0]?.sector ?? null, industry: null },
    summary: { dataDate: sourceAsOf, lastUpdated: snapshots[0]?.fetchedAt instanceof Date ? snapshots[0].fetchedAt.toISOString() : snapshots[0]?.fetchedAt ?? null, coveredEtfs: snapshots.length, primarySources: ["海外 ETF 發行商官方持股", "SEC 13F"] },
    today: null,
    overseasEtfExposure: { timeScale: "依發行商實際更新頻率", rows: exposures },
    sec13f: {
      timeScale: "季度申報，非即時持倉",
      rows: institutions.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol).map((holding) => ({
        institutionCode: snapshot.etfCode,
        institutionName: snapshot.fundName,
        periodOfReport: snapshot.sourceAsOf,
        filedAt: snapshot.filedAt ?? null,
        capturedAt: snapshot.capturedAt ?? (snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt.toISOString() : String(snapshot.fetchedAt)),
        shares: holding.shares ?? null,
        marketValue: holding.marketValue ?? null,
        weightPercent: holding.weightPercent ?? null,
        sourceUrl: snapshot.sourceUrl
      })))
    }
  };
}

export async function stockHistory(db: Db, market: StockMarket, rawSymbol: string, window: 3 | 5 | 20, date?: string) {
  const symbol = normalizeSymbol(market, rawSymbol);
  if (market === "tw") {
    const dates = await effectiveTaiwanDates(db, date, window);
    const changes = await changesForDates(db, dates, symbol);
    const days = groupTaiwanDays(dates, changes);
    const observations: DailyDirectionObservation[] = days.map((row) => ({ date: row.date, direction: row.direction, activeNetLots: row.activeNetLots }));
    const streak = consecutiveDirection(observations);
    const reversal = detectReversal(observations);
    const coverage = await taiwanCoverageForDate(db, dates[0] ?? null);
    const current = days[0];
    const confidence = confidenceForSignal({ ...coverage, scaleComplete: current?.scaleCompleteEtfs ?? 0, requiredObservations: window, actualObservations: days.filter((row) => row.availableEtfs > 0).length, dominantShare: current?.dominantShare ?? null, directionalRatio: current?.sameDirectionEtfRatio ?? null, directionConflictCount: current?.directionConflictCount ?? 0 });
    return {
      generatedAt: generatedAt(), sourceAsOf: dates[0] ?? null, coverage, confidence, market, symbol, window,
      summary: {
        cumulativeActiveNetLots: days.some((row) => row.activeNetLots !== null) ? round(days.reduce((sum, row) => sum + (row.activeNetLots ?? 0), 0)) : null,
        increaseTradingDays: days.filter((row) => row.direction === "increase").length,
        decreaseTradingDays: days.filter((row) => row.direction === "decrease").length,
        consecutive: streak,
        reversal,
        sameDirectionEtfRatio: current?.sameDirectionEtfRatio ?? null,
        dataCoverageRate: coverage.tracked ? coverage.available / coverage.tracked : 0
      },
      points: days
    };
  }

  const rows = await db.collection<GlobalEtfSnapshot>("global_etf_snapshots").find(
    { etfCode: { $in: enabledDailyGlobalEtfCodes }, strategyType: { $ne: "13f" }, sourceStatus: "ok", holdings: { $elemMatch: { ticker: symbol } }, ...(date ? { sourceAsOf: { $lte: date } } : {}) },
    { sort: { sourceAsOf: -1, fetchedAt: -1 }, limit: Math.min(400, window * enabledDailyGlobalEtfCodes.length) }
  ).toArray();
  const dates = [...new Set(rows.map((row) => row.sourceAsOf))].sort((a, b) => b.localeCompare(a)).slice(0, window);
  const points = dates.map((sourceDate) => {
    const snapshots = rows.filter((row) => row.sourceAsOf === sourceDate);
    const holdings = snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol));
    return { date: sourceDate, totalWeightPercent: round(holdings.reduce((sum, holding) => sum + (holding.weightPercent ?? 0), 0)), etfCount: snapshots.length };
  });
  const sourceAsOf = dates[0] ?? await latestGlobalSourceDate(db);
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  return { generatedAt: generatedAt(), sourceAsOf, coverage, confidence: confidenceForSignal({ ...coverage, scaleComplete: coverage.available, requiredObservations: window, actualObservations: dates.length, dominantShare: null, directionalRatio: null }), market, symbol, window, timeScale: "海外 ETF 實際持股日，不等同台灣交易日", points };
}

export async function stockEtfs(db: Db, market: StockMarket, rawSymbol: string, date?: string) {
  const symbol = normalizeSymbol(market, rawSymbol);
  if (market === "tw") {
    const dates = await effectiveTaiwanDates(db, date, 20);
    const sourceAsOf = dates[0] ?? null;
    const [changes, holdings, coverage] = await Promise.all([
      changesForDates(db, dates, symbol),
      sourceAsOf ? db.collection<EtfDailyHolding>("etf_daily_holdings").find({ stockId: symbol, tradeDate: sourceAsOf, etfCode: { $in: enabledTaiwanEtfCodes } }).toArray() : [],
      taiwanCoverageForDate(db, sourceAsOf)
    ]);
    const holdingsByEtf = new Map(holdings.map((holding) => [holding.etfCode, holding]));
    const currentChanges = changes.filter((row) => row.tradeDate === sourceAsOf);
    const codes = [...new Set([...holdings.map((row) => row.etfCode), ...changes.map((row) => row.etfCode)])];
    const optionsByCode = new Map(configuredEtfs.map((etf) => [etf.etfCode, etf]));
    const rows = codes.map((etfCode) => {
      const holding = holdingsByEtf.get(etfCode);
      const current = currentChanges.find((row) => row.etfCode === etfCode);
      const observations = dates.map((tradeDate) => {
        const row = changes.find((change) => change.etfCode === etfCode && change.tradeDate === tradeDate);
        return { date: tradeDate, direction: row ? directionForChange({ activeDiffLots: row.activeDiffLots, diffWeightPoint: row.diffWeightPoint }) : "unknown" as const, activeNetLots: row?.activeDiffLots ?? null };
      });
      const streak = consecutiveDirection(observations);
      const directionConflict = current ? hasDirectionConflict({ activeDiffLots: current.activeDiffLots, diffWeightPoint: current.diffWeightPoint }) : false;
      const observationCoverage = { expected: dates.length, actual: streak.actualObservationCount, missing: streak.missingObservationCount };
      const confidence = !current || (current.activeDiffLots === null && current.diffWeightPoint === null)
        ? "low"
        : directionConflict || observationCoverage.missing > 0 ? "medium" : "high";
      const confidenceReason = !current
        ? "最新資料日沒有此 ETF 的實際觀察。"
        : [
          directionConflict ? "張數與權重方向不一致，方向以張數為準。" : null,
          observationCoverage.missing > 0 ? `觀察期缺少 ${observationCoverage.missing} 個實際觀察日。` : null
        ].filter(Boolean).join("；") || "觀察期與方向資料完整。";
      return {
        etfCode,
        name: optionsByCode.get(etfCode)?.name ?? etfCode,
        latestWeight: holding?.weight ?? current?.currentWeight ?? null,
        weightChange: current?.diffWeightPoint ?? null,
        activeNetLots: current?.activeDiffLots ?? null,
        surfaceNetLots: current?.diffLots ?? null,
        consecutiveDirection: streak.direction,
        consecutiveTradingDays: streak.tradingDays,
        directionConflict,
        observationCoverage,
        dataDate: sourceAsOf,
        confidence,
        confidenceReason
      };
    }).sort((a, b) => Math.abs(b.activeNetLots ?? 0) - Math.abs(a.activeNetLots ?? 0));
    return { generatedAt: generatedAt(), sourceAsOf, coverage, confidence: confidenceForSignal({ ...coverage, scaleComplete: currentChanges.filter((row) => row.activeDiffLots !== null).length, requiredObservations: 1, actualObservations: sourceAsOf ? 1 : 0, dominantShare: null, directionalRatio: null, directionConflictCount: currentChanges.filter((row) => hasDirectionConflict({ activeDiffLots: row.activeDiffLots, diffWeightPoint: row.diffWeightPoint })).length }), rows };
  }

  const snapshots = await globalSnapshotsForStock(db, symbol, false);
  const previous = await previousGlobalSnapshots(db, snapshots);
  const sourceAsOf = snapshots[0]?.sourceAsOf ?? await latestGlobalSourceDate(db);
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  const rows = snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol).map((holding) => {
    const priorHolding = previous.get(snapshot.etfCode) ? latestHoldingForTicker(previous.get(snapshot.etfCode) as GlobalEtfSnapshot, symbol).find((row) => row.positionKey === holding.positionKey || row.assetType === holding.assetType) : undefined;
    return {
      etfCode: snapshot.etfCode,
      name: snapshot.fundName,
      latestWeight: holding.weightPercent ?? null,
      weightChange: holding.weightPercent !== undefined && priorHolding?.weightPercent !== undefined ? round(holding.weightPercent - priorHolding.weightPercent, 4) : null,
      assetType: holding.assetType ?? "Unknown",
      dataDate: snapshot.sourceAsOf,
      confidence: snapshot.sourceStatus === "ok" ? "high" : "low",
      sourceUrl: snapshot.sourceUrl
    };
  }));
  return { generatedAt: generatedAt(), sourceAsOf, coverage, confidence: confidenceForSignal({ ...coverage, scaleComplete: coverage.available, requiredObservations: 1, actualObservations: snapshots.length ? 1 : 0, dominantShare: null, directionalRatio: null }), rows };
}

export async function stockInstitutions(db: Db, market: StockMarket, rawSymbol: string, date?: string) {
  const symbol = normalizeSymbol(market, rawSymbol);
  if (market === "tw") {
    const base = await taiwanStockBase(db, symbol, date);
    const currentDirection = base.days[0]?.direction ?? "unknown";
    const row = base.institutional;
    return {
      generatedAt: generatedAt(), sourceAsOf: base.sourceAsOf, coverage: base.coverage,
      confidence: confidenceForSignal({ ...base.coverage, scaleComplete: base.days[0]?.scaleCompleteEtfs ?? 0, requiredObservations: 1, actualObservations: row ? 1 : 0, dominantShare: base.days[0]?.dominantShare ?? null, directionalRatio: base.days[0]?.sameDirectionEtfRatio ?? null, directionConflictCount: base.days[0]?.directionConflictCount ?? 0 }),
      timeScale: "台灣交易日",
      row: row ? { foreignNetShares: row.foreignNetShares, investmentTrustNetShares: row.investmentTrustNetShares, dealerNetShares: row.dealerNetShares, totalNetShares: row.totalNetShares, source: row.source, relation: relationBetweenEtfAndInstitution(currentDirection, row.totalNetShares) } : null
    };
  }
  const snapshots = await globalSnapshotsForStock(db, symbol, true);
  return {
    generatedAt: generatedAt(), sourceAsOf: snapshots[0]?.sourceAsOf ?? null,
    coverage: { tracked: enabledInstitutionCodes.length, available: snapshots.length, delayed: Math.max(0, enabledInstitutionCodes.length - snapshots.length) },
    confidence: { level: snapshots.length ? "medium" : "low", reason: snapshots.length ? "13F 為季度申報且存在法定延遲，不代表目前持倉。" : "沒有可用的 13F 申報資料。" },
    timeScale: "13F 季度持倉截止日",
    rows: snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol).map((holding) => ({ institutionCode: snapshot.etfCode, institutionName: snapshot.fundName, periodOfReport: snapshot.sourceAsOf, filedAt: snapshot.filedAt ?? null, capturedAt: snapshot.capturedAt ?? (snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt.toISOString() : String(snapshot.fetchedAt)), shares: holding.shares ?? null, marketValue: holding.marketValue ?? null, sourceUrl: snapshot.sourceUrl })))
  };
}

export function isKnownGlobalEtfCode(code: string): boolean {
  const etf = findGlobalEtfConfig(code);
  return Boolean(etf && etf.enabled && etf.strategyType !== "13f");
}

export function isInstitutionCode(code: string): boolean {
  return enabledGlobalEtfs.some((etf) => etf.etfCode === code && etf.strategyType === "13f");
}

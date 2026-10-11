import type { Db, ObjectId } from "mongodb";
import { enabledGlobalEtfs, findGlobalEtfConfig } from "../../config/globalEtfs.js";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { GlobalEtfHolding, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { round } from "../../utils/number.js";
import { preferredStockName } from "../market/stockImpactService.js";
import { snapshotReadMetadataProjection, type SnapshotReadMetadata } from "../globalEtf/snapshotSelection.js";
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

export interface GlobalStockHistoryPoint {
  date: string;
  weightChangePercentPoints: number;
  direction: SignalDirection;
  updatedEtfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  neutralEtfCount: number;
}

const isoSourceDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

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

type GlobalStockHolding = Pick<GlobalEtfHolding, "ticker" | "positionKey" | "name" | "weightPercent" | "shares" | "marketValue" | "sector" | "assetType">;
export type GlobalStockSnapshot = Pick<GlobalEtfSnapshot, "etfCode" | "fundName" | "sourceAsOf" | "filedAt" | "capturedAt" | "fetchedAt" | "sourceUrl" | "sourceStatus"> & { holdings: GlobalStockHolding[] };

function latestHoldingForTicker(snapshot: Pick<GlobalStockSnapshot, "holdings">, symbol: string): GlobalStockHolding[] {
  return snapshot.holdings.filter((holding) => holding.ticker?.trim().toUpperCase() === symbol);
}

function stockSnapshotProjection(symbol: string) {
  return {
    etfCode: 1, fundName: 1, sourceAsOf: 1, filedAt: 1, capturedAt: 1,
    fetchedAt: 1, sourceUrl: 1, sourceStatus: 1,
    holdings: { $map: {
      input: { $filter: {
        input: "$holdings", as: "holding",
        cond: { $eq: [{ $toUpper: { $trim: { input: { $ifNull: ["$$holding.ticker", ""] } } } }, { $literal: symbol }] }
      } },
      as: "holding",
      in: { ticker: "$$holding.ticker", positionKey: "$$holding.positionKey", name: "$$holding.name", weightPercent: "$$holding.weightPercent", shares: "$$holding.shares", marketValue: "$$holding.marketValue", sector: "$$holding.sector", assetType: "$$holding.assetType" }
    } }
  };
}

export function latestSnapshotsForStockPipeline(_symbol: string, include13f: boolean) {
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
    { $project: snapshotReadMetadataProjection }
  ];
}

export async function globalSnapshotsForStock(db: Db, symbol: string, include13f: boolean): Promise<GlobalStockSnapshot[]> {
  const collection = db.collection<GlobalEtfSnapshot>("global_etf_snapshots");
  const metadata = await collection.aggregate<SnapshotReadMetadata>(latestSnapshotsForStockPipeline(symbol, include13f), { maxTimeMS: 10000 }).toArray();
  const candidates = new Map<string, SnapshotReadMetadata[]>();
  for (const row of metadata) {
    if (row.unusableReason != null) continue;
    const rows = candidates.get(row.etfCode) ?? [];
    rows.push(row);
    candidates.set(row.etfCode, rows);
  }
  const selected: GlobalStockSnapshot[] = [];
  const deadline = Date.now() + 20000;
  // Validate rowCount only on selected IDs. An invalid capture can use the next
  // valid one, but a valid capture without the ticker is a definitive exit.
  while (candidates.size) {
    const ids = [...candidates.values()].map(rows => rows[0]!._id);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Global stock snapshot selection exceeded its read deadline");
    const rows = await collection.find<GlobalStockSnapshot & { _id: ObjectId }>({ _id: { $in: ids }, rowCount: { $gt: 0 } }, {
      hint: "_id_", maxTimeMS: remaining, projection: stockSnapshotProjection(symbol)
    }).toArray();
    const valid = new Map(rows.map(row => [String(row._id), row]));
    for (const [code, queue] of candidates) {
      const row = valid.get(String(queue[0]!._id));
      if (row) {
        selected.push(row);
        candidates.delete(code);
      } else {
        queue.shift();
        if (!queue.length) candidates.delete(code);
      }
    }
  }
  return selected.filter(row => row.holdings.some(holding => holding.ticker === symbol))
    .sort((a, b) => b.sourceAsOf.localeCompare(a.sourceAsOf) || a.etfCode.localeCompare(b.etfCode));
}

export function globalStockHistoryPipeline(symbol: string, window: 3 | 5 | 20, date?: string) {
  const maximumRows = Math.min(2_000, (window + 2) * enabledDailyGlobalEtfCodes.length);
  return [
    {
      $match: {
        etfCode: { $in: enabledDailyGlobalEtfCodes },
        strategyType: { $ne: "13f" },
        sourceStatus: "ok",
        sourceAsOf: {
          $regex: "^\\d{4}-\\d{2}-\\d{2}$",
          ...(date ? { $lte: date } : {})
        }
      }
    },
    { $sort: { etfCode: 1, sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: { etfCode: "$etfCode", sourceAsOf: "$sourceAsOf" }, snapshot: { $first: { snapshotId: "$_id", etfCode: "$etfCode", sourceAsOf: "$sourceAsOf", fetchedAt: "$fetchedAt" } } } },
    { $replaceRoot: { newRoot: "$snapshot" } },
    { $sort: { sourceAsOf: -1, fetchedAt: -1, etfCode: 1 } },
    { $limit: maximumRows }
  ];
}

export type GlobalHistoryObservation = Pick<GlobalEtfSnapshot, "etfCode" | "sourceAsOf" | "fetchedAt"> & {
  holdings: Array<Pick<GlobalEtfHolding, "ticker" | "weightPercent">>;
};
interface GlobalHistorySelection extends Omit<GlobalHistoryObservation, "holdings"> { snapshotId: ObjectId }
export async function globalStockHistorySnapshots(db: Db, symbol: string, window: 3 | 5 | 20, date?: string): Promise<GlobalHistoryObservation[]> {
  const collection = db.collection<GlobalEtfSnapshot>("global_etf_snapshots");
  const selected = await collection.aggregate<GlobalHistorySelection>(globalStockHistoryPipeline(symbol, window, date), { maxTimeMS: 10000 }).toArray();
  if (!selected.length) return [];
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // Bound hydration to the metadata winners. A case-insensitive ticker regex
  // cannot bound the ticker index and would scan unrelated historical captures.
  // Keep empty observations below so exits never fall back to an old holding.
  const rows = await collection.find({
    _id: { $in: selected.map(row => row.snapshotId) },
    "holdings.ticker": { $regex: `^${escaped}$`, $options: "i" }
  }, {
    hint: "_id_",
    maxTimeMS: 20000,
    projection: {
      _id: 1,
      holdings: { $map: {
        input: { $filter: { input: "$holdings", as: "holding", cond: { $eq: [{ $toUpper: { $ifNull: ["$$holding.ticker", ""] } }, symbol] } } },
        as: "holding",
        in: { ticker: "$$holding.ticker", weightPercent: "$$holding.weightPercent" }
      } }
    }
  }).toArray();
  const byId = new Map(rows.map(row => [String(row._id), row]));
  return selected.map(row => ({
    etfCode: row.etfCode, sourceAsOf: row.sourceAsOf, fetchedAt: row.fetchedAt,
    holdings: byId.get(String(row.snapshotId))?.holdings ?? []
  }));
}

function fetchedAtMilliseconds(snapshot: Pick<GlobalEtfSnapshot, "fetchedAt">): number {
  const value = snapshot.fetchedAt instanceof Date ? snapshot.fetchedAt.getTime() : new Date(snapshot.fetchedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function stockWeight(snapshot: GlobalHistoryObservation, symbol: string): number {
  return round(snapshot.holdings
    .filter((holding) => holding.ticker?.trim().toUpperCase() === symbol)
    .reduce((sum, holding) => sum + (holding.weightPercent ?? 0), 0), 6);
}

export function globalStockHistoryPoints(
  rawSymbol: string,
  snapshots: GlobalHistoryObservation[],
  window: 3 | 5 | 20
): GlobalStockHistoryPoint[] {
  const symbol = rawSymbol.trim().toUpperCase();
  const latestByEtfAndDate = new Map<string, GlobalHistoryObservation>();
  for (const snapshot of snapshots) {
    if (!isoSourceDatePattern.test(snapshot.sourceAsOf)) continue;
    const key = `${snapshot.etfCode}|${snapshot.sourceAsOf}`;
    const existing = latestByEtfAndDate.get(key);
    if (!existing || fetchedAtMilliseconds(snapshot) > fetchedAtMilliseconds(existing)) {
      latestByEtfAndDate.set(key, snapshot);
    }
  }

  const byEtf = new Map<string, GlobalHistoryObservation[]>();
  for (const snapshot of latestByEtfAndDate.values()) {
    byEtf.set(snapshot.etfCode, [...(byEtf.get(snapshot.etfCode) ?? []), snapshot]);
  }

  const events = new Map<string, Array<{ direction: SignalDirection; weightChangePercentPoints: number }>>();
  for (const rows of byEtf.values()) {
    const ordered = [...rows].sort((left, right) => left.sourceAsOf.localeCompare(right.sourceAsOf));
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (!previous || !current) continue;
      const previousWeight = stockWeight(previous, symbol);
      const currentWeight = stockWeight(current, symbol);
      if (previousWeight === 0 && currentWeight === 0) continue;
      const weightChangePercentPoints = round(currentWeight - previousWeight, 6);
      const direction = directionForChange({ activeDiffLots: null, diffWeightPoint: weightChangePercentPoints });
      events.set(current.sourceAsOf, [
        ...(events.get(current.sourceAsOf) ?? []),
        { direction, weightChangePercentPoints }
      ]);
    }
  }

  return [...events.entries()]
    .map(([date, rows]) => {
      const weightChangePercentPoints = round(rows.reduce((sum, row) => sum + row.weightChangePercentPoints, 0), 6);
      return {
        date,
        weightChangePercentPoints,
        direction: directionForChange({ activeDiffLots: null, diffWeightPoint: weightChangePercentPoints }),
        updatedEtfCount: rows.length,
        increaseEtfCount: rows.filter((row) => row.direction === "increase").length,
        decreaseEtfCount: rows.filter((row) => row.direction === "decrease").length,
        neutralEtfCount: rows.filter((row) => row.direction === "neutral").length
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, window);
}

export function latestStockSearchPipeline(normalizedQuery: string, limit: number) {
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const usEscaped = normalizedQuery.toUpperCase().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [
    { $match: { etfCode: { $in: enabledDailyGlobalEtfCodes }, strategyType: { $ne: "13f" }, sourceStatus: "ok", sourceAsOf: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } } },
    { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: "$etfCode", snapshotId: { $first: "$_id" } } },
    { $lookup: { from: "global_etf_snapshots", localField: "snapshotId", foreignField: "_id", as: "snapshot" } },
    { $unwind: "$snapshot" },
    { $replaceRoot: { newRoot: "$snapshot" } },
    { $unwind: "$holdings" },
    { $match: { $or: [{ "holdings.ticker": { $regex: `^${usEscaped}`, $options: "i" } }, { "holdings.name": { $regex: `^${escaped}`, $options: "i" } }] } },
    { $sort: { sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: { $toUpper: "$holdings.ticker" }, name: { $first: "$holdings.name" }, sector: { $first: "$holdings.sector" }, sourceAsOf: { $first: "$sourceAsOf" } } },
    { $limit: Math.max(0, limit) },
    { $project: { _id: 0, ticker: "$_id", name: 1, sector: 1, sourceAsOf: 1 } }
  ];
}

export async function previousGlobalSnapshotsForStock(db: Db, snapshots: GlobalStockSnapshot[], symbol: string): Promise<Map<string, GlobalStockSnapshot>> {
  if (!snapshots.length) return new Map();
  const collection = db.collection<GlobalEtfSnapshot>("global_etf_snapshots");
  // Select each ETF's newest earlier capture using covered metadata before
  // inspecting holdings. An empty prior position must never backfill an older one.
  const selected = await collection.aggregate<{ _id: string; snapshotId: ObjectId }>([
    { $match: { sourceStatus: "ok", $or: snapshots.map(snapshot => ({ etfCode: snapshot.etfCode, sourceAsOf: { $lt: snapshot.sourceAsOf } })) } },
    { $sort: { etfCode: 1, sourceAsOf: -1, fetchedAt: -1 } },
    { $group: { _id: "$etfCode", snapshotId: { $first: "$_id" } } }
  ], { maxTimeMS: 10000 }).toArray();
  if (!selected.length) return new Map();
  const rows = await collection.find<GlobalStockSnapshot>({ _id: { $in: selected.map(row => row.snapshotId) } }, {
    hint: "_id_", maxTimeMS: 10000, projection: stockSnapshotProjection(symbol)
  }).toArray();
  return new Map(rows.map(row => [row.etfCode, row]));
}

function globalStockName(symbol: string, snapshots: GlobalStockSnapshot[]): string {
  return snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol)).find((holding) => holding.name)?.name ?? symbol;
}

export async function searchStocks(db: Db, query: string, market: StockMarket | undefined, limit: number) {
  const normalizedQuery = query.trim();
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const results: Array<{ market: StockMarket; symbol: string; normalizedSymbol: string; name: string; sector: string | null; latestDataDate: string | null; path: string }> = [];

  if (!market || market === "tw") {
    const profiles = await db.collection<StockSectorProfile>("stock_sector_profiles").find(
      {
        // This collection also contains overseas profiles. Only identifiers
        // accepted by the Taiwan stock routes may consume the result limit.
        stockId: { $regex: "^\\d{4,6}$" },
        $or: [{ stockId: { $regex: `^${escaped}`, $options: "i" } }, { stockName: { $regex: `^${escaped}`, $options: "i" } }]
      },
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
    }>(latestStockSearchPipeline(normalizedQuery, limit - results.length), { maxTimeMS: 20000 }).toArray();
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
    stock: { market, symbol, normalizedSymbol: symbol, name: globalStockName(symbol, [...snapshots, ...institutions]), sector: latestHoldingForTicker(snapshots[0] ?? { holdings: [] }, symbol)[0]?.sector ?? null, industry: null },
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

  const rows = await globalStockHistorySnapshots(db, symbol, window, date);
  const points = globalStockHistoryPoints(symbol, rows, window);
  const latestHoldingDate = rows
    .filter((snapshot) => stockWeight(snapshot, symbol) > 0)
    .map((snapshot) => snapshot.sourceAsOf)
    .sort((left, right) => right.localeCompare(left))[0];
  const sourceAsOf = points[0]?.date ?? latestHoldingDate ?? await latestGlobalSourceDate(db);
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  const cumulativeWeightChangePercentPoints = points.length
    ? round(points.reduce((sum, point) => sum + point.weightChangePercentPoints, 0), 6)
    : null;
  return {
    generatedAt: generatedAt(),
    sourceAsOf,
    coverage,
    confidence: confidenceForSignal({
      ...coverage,
      scaleComplete: coverage.available,
      requiredObservations: window,
      actualObservations: points.length,
      dominantShare: null,
      directionalRatio: null
    }),
    market,
    symbol,
    window,
    timeScale: "海外 ETF 發行商持股資料變動點，不等同交易日或成交張數",
    globalSummary: {
      cumulativeWeightChangePercentPoints,
      increaseChangePoints: points.filter((point) => point.direction === "increase").length,
      decreaseChangePoints: points.filter((point) => point.direction === "decrease").length,
      latestDirection: points[0]?.direction ?? "unknown",
      actualChangePointCount: points.length,
      requestedChangePointCount: window
    },
    points
  };
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
  const previous = await previousGlobalSnapshotsForStock(db, snapshots, symbol);
  const sourceAsOf = snapshots[0]?.sourceAsOf ?? await latestGlobalSourceDate(db);
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  const rows = snapshots.flatMap((snapshot) => latestHoldingForTicker(snapshot, symbol).map((holding) => {
    const previousSnapshot = previous.get(snapshot.etfCode);
    const priorHolding = previousSnapshot ? latestHoldingForTicker(previousSnapshot, symbol).find((row) => row.positionKey === holding.positionKey || row.assetType === holding.assetType) : undefined;
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

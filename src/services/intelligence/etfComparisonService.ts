import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import { findGlobalEtfConfig } from "../../config/globalEtfs.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { GlobalEtfHolding, GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { round } from "../../utils/number.js";
import { adjustmentIntensity, confidenceForSignal, concentrationMetrics, jaccardOverlap, weightedOverlap } from "./calculations.js";
import { effectiveTaiwanDates, generatedAt, globalCoverageForDate, taiwanCoverageForDate } from "./dataAccess.js";

export type EtfComparisonType = "tw" | "global";

function positionKeyForGlobal(holding: GlobalEtfHolding): string {
  const identity = holding.positionKey || (holding.ticker ? `ticker:${holding.ticker.toUpperCase()}` : `name:${holding.name.toUpperCase()}`);
  return `${identity}|${holding.assetType ?? "Unknown"}`;
}

function pairwiseRows(items: Array<{ code: string; keys: string[]; weights: Map<string, number>; labels: Map<string, string> }>) {
  const rows = [];
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      if (!left || !right) continue;
      const setOverlap = jaccardOverlap(left.keys, right.keys);
      const common = left.keys
        .filter((key) => right.weights.has(key))
        .map((key) => ({ key, label: left.labels.get(key) ?? right.labels.get(key) ?? key, leftWeight: left.weights.get(key) ?? null, rightWeight: right.weights.get(key) ?? null }))
        .sort((a, b) => Math.min(b.leftWeight ?? 0, b.rightWeight ?? 0) - Math.min(a.leftWeight ?? 0, a.rightWeight ?? 0))
        .slice(0, 20);
      rows.push({ left: left.code, right: right.code, ...setOverlap, weightedOverlap: weightedOverlap(left.weights, right.weights), common });
    }
  }
  return rows;
}

function sectorExposureFromTaiwanHoldings(holdings: EtfDailyHolding[], profiles: Map<string, StockSectorProfile>) {
  const sectors = new Map<string, number>();
  for (const holding of holdings) {
    if (holding.weight === null) continue;
    const sector = profiles.get(holding.stockId)?.sector ?? "其他";
    sectors.set(sector, (sectors.get(sector) ?? 0) + holding.weight);
  }
  return [...sectors.entries()].map(([sector, weight]) => ({ sector, weight: round(weight, 4) })).sort((a, b) => b.weight - a.weight);
}

function adjustmentWindows(changes: EtfHoldingChange[], dates: string[]) {
  return ([3, 5, 20] as const).map((window) => {
    const windowDates = new Set(dates.slice(0, window));
    const rows = changes.filter((row) => windowDates.has(row.tradeDate));
    const active = rows.map((row) => row.activeDiffLots).filter((value): value is number => value !== null);
    return {
      window,
      cumulativeActiveNetLots: active.length ? round(active.reduce((sum, value) => sum + value, 0)) : null,
      adjustmentIntensity: adjustmentIntensity(rows.map((row) => row.diffWeightPoint)),
      increaseCount: rows.filter((row) => (row.activeDiffLots ?? 0) > 0).length,
      decreaseCount: rows.filter((row) => (row.activeDiffLots ?? 0) < 0).length
    };
  });
}

async function compareTaiwanEtfs(db: Db, codes: string[], date?: string) {
  const dates = await effectiveTaiwanDates(db, date, 20);
  const sourceAsOf = dates[0] ?? null;
  const [holdings, summaries, changes, coverage] = await Promise.all([
    sourceAsOf ? db.collection<EtfDailyHolding>("etf_daily_holdings").find({ etfCode: { $in: codes }, tradeDate: sourceAsOf }).toArray() : [],
    sourceAsOf ? db.collection<EtfDailySummary>("etf_daily_summary").find({ etfCode: { $in: codes }, tradeDate: sourceAsOf }).toArray() : [],
    dates.length ? db.collection<EtfHoldingChange>("etf_holding_changes").find({ etfCode: { $in: codes }, tradeDate: { $in: dates } }).toArray() : [],
    taiwanCoverageForDate(db, sourceAsOf)
  ]);
  const stockIds = [...new Set(holdings.map((row) => row.stockId))];
  const profiles = stockIds.length ? await db.collection<StockSectorProfile>("stock_sector_profiles").find({ stockId: { $in: stockIds } }).toArray() : [];
  const profileByStock = new Map(profiles.map((row) => [row.stockId, row]));
  const configByCode = new Map(configuredEtfs.map((row) => [row.etfCode, row]));
  const summariesByCode = new Map(summaries.map((row) => [row.etfCode, row]));

  const cards = codes.map((code) => {
    const rows = holdings.filter((row) => row.etfCode === code).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const codeChanges = changes.filter((row) => row.etfCode === code);
    const currentChanges = codeChanges.filter((row) => row.tradeDate === sourceAsOf);
    const concentration = concentrationMetrics(rows.map((row) => row.weight));
    const summary = summariesByCode.get(code);
    return {
      code,
      name: configByCode.get(code)?.name ?? code,
      issuer: configByCode.get(code)?.issuer ?? "-",
      sourceAsOf,
      fundSize: summary?.fundSize ?? null,
      premiumDiscount: summary?.premiumDiscount ?? null,
      holdingCount: rows.length,
      top10Concentration: concentration.top10,
      hhi: concentration.hhi,
      sectorExposure: sectorExposureFromTaiwanHoldings(rows, profileByStock),
      activeAdjustments: adjustmentWindows(codeChanges, dates),
      addedHoldings: currentChanges.filter((row) => row.status === "new").length,
      exitedHoldings: currentChanges.filter((row) => row.status === "exit").length,
      topHoldings: rows.slice(0, 15).map((row) => ({ key: `${row.stockId}|Equity`, symbol: row.stockId, name: row.stockName, assetType: "Equity", weight: row.weight })),
      dataCoverageRate: dates.length ? new Set(codeChanges.map((row) => row.tradeDate)).size / Math.min(20, dates.length) : 0
    };
  });
  const pairItems = codes.map((code) => {
    const rows = holdings.filter((row) => row.etfCode === code && row.weight !== null);
    const weights = new Map(rows.map((row) => [`${row.stockId}|Equity`, row.weight as number]));
    return { code, keys: rows.map((row) => `${row.stockId}|Equity`), weights, labels: new Map(rows.map((row) => [`${row.stockId}|Equity`, `${row.stockId} ${row.stockName}`])) };
  });
  const scaleComplete = changes.filter((row) => row.tradeDate === sourceAsOf && row.activeDiffLots !== null).length;
  return {
    generatedAt: generatedAt(), sourceAsOf, type: "tw" as const, coverage,
    confidence: confidenceForSignal({ ...coverage, scaleComplete: Math.min(coverage.available, scaleComplete), requiredObservations: Math.min(20, dates.length || 20), actualObservations: dates.length, dominantShare: null, directionalRatio: null }),
    cards,
    pairwise: pairwiseRows(pairItems),
    methodology: { setOverlap: "intersection count 與 Jaccard similarity", weightedOverlap: "Σ min(weightA, weightB)", commonDateOnly: true, missingWeight: "缺少權重的持股只納入集合重疊，不納入權重重疊", exposureIdentity: "台灣持股以股票代碼與 Equity 類型識別" }
  };
}

async function latestGlobalSnapshot(db: Db, code: string, date?: string): Promise<GlobalEtfSnapshot | null> {
  return db.collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
    { etfCode: code, strategyType: { $ne: "13f" }, sourceStatus: "ok", ...(date ? { sourceAsOf: { $lte: date } } : {}) },
    { sort: { sourceAsOf: -1, fetchedAt: -1 } }
  );
}

async function previousGlobalSnapshot(db: Db, snapshot: GlobalEtfSnapshot): Promise<GlobalEtfSnapshot | null> {
  return db.collection<GlobalEtfSnapshot>("global_etf_snapshots").findOne(
    { etfCode: snapshot.etfCode, sourceAsOf: { $lt: snapshot.sourceAsOf }, sourceStatus: "ok" },
    { sort: { sourceAsOf: -1, fetchedAt: -1 } }
  );
}

function assetComposition(holdings: GlobalEtfHolding[]) {
  const totals = new Map<string, number>();
  for (const holding of holdings) {
    const raw = (holding.assetType ?? "Other").toLowerCase();
    const assetType = raw.includes("swap") ? "Swap" : raw.includes("cash") || raw.includes("money") ? "Cash" : raw.includes("equity") || holding.ticker ? "Equity" : "Other";
    totals.set(assetType, (totals.get(assetType) ?? 0) + (holding.weightPercent ?? 0));
  }
  return ["Equity", "Swap", "Cash", "Other"].map((assetType) => ({ assetType, weight: round(totals.get(assetType) ?? 0, 4) }));
}

function globalSectorExposure(holdings: GlobalEtfHolding[]) {
  const totals = new Map<string, number>();
  for (const holding of holdings) {
    if (holding.weightPercent === undefined) continue;
    const sector = holding.sector ?? "Unknown";
    totals.set(sector, (totals.get(sector) ?? 0) + holding.weightPercent);
  }
  return [...totals.entries()].map(([sector, weight]) => ({ sector, weight: round(weight, 4) })).sort((a, b) => b.weight - a.weight);
}

async function compareGlobalEtfs(db: Db, codes: string[], date?: string) {
  const snapshots = (await Promise.all(codes.map((code) => latestGlobalSnapshot(db, code, date)))).filter((row): row is GlobalEtfSnapshot => Boolean(row));
  const previous = new Map<string, GlobalEtfSnapshot>();
  for (const snapshot of snapshots) {
    const row = await previousGlobalSnapshot(db, snapshot);
    if (row) previous.set(snapshot.etfCode, row);
  }
  const sourceAsOf = snapshots.map((row) => row.sourceAsOf).sort((a, b) => b.localeCompare(a))[0] ?? null;
  const coverage = await globalCoverageForDate(db, sourceAsOf);
  const cards = codes.map((code) => {
    const config = findGlobalEtfConfig(code);
    const snapshot = snapshots.find((row) => row.etfCode === code);
    const holdings = snapshot?.holdings ?? [];
    const prior = previous.get(code);
    const priorByKey = new Map((prior?.holdings ?? []).map((row) => [positionKeyForGlobal(row), row]));
    const concentration = concentrationMetrics(holdings.map((row) => row.weightPercent));
    const changes = holdings.map((holding) => holding.weightPercent !== undefined && priorByKey.get(positionKeyForGlobal(holding))?.weightPercent !== undefined
      ? holding.weightPercent - (priorByKey.get(positionKeyForGlobal(holding))?.weightPercent as number)
      : null);
    return {
      code,
      name: snapshot?.fundName ?? config?.fundName ?? code,
      issuer: snapshot?.issuer ?? config?.issuer ?? "-",
      sourceAsOf: snapshot?.sourceAsOf ?? null,
      fetchedAt: snapshot?.fetchedAt instanceof Date ? snapshot.fetchedAt.toISOString() : snapshot?.fetchedAt ?? null,
      sourceUrl: snapshot?.sourceUrl ?? config?.sourceUrl ?? null,
      sourceStatus: snapshot?.sourceStatus ?? "unavailable",
      fundSize: null,
      holdingCount: holdings.length,
      top10Concentration: concentration.top10,
      hhi: concentration.hhi,
      sectorExposure: globalSectorExposure(holdings),
      assetComposition: assetComposition(holdings),
      weightAdjustmentIntensity: adjustmentIntensity(changes),
      topHoldings: [...holdings].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0)).slice(0, 15).map((holding) => ({ key: positionKeyForGlobal(holding), symbol: holding.ticker ?? null, name: holding.name, assetType: holding.assetType ?? "Unknown", weight: holding.weightPercent ?? null }))
    };
  });
  const pairItems = codes.map((code) => {
    const holdings = snapshots.find((row) => row.etfCode === code)?.holdings.filter((row) => row.weightPercent !== undefined) ?? [];
    const weights = new Map(holdings.map((row) => [positionKeyForGlobal(row), row.weightPercent as number]));
    return { code, keys: holdings.map(positionKeyForGlobal), weights, labels: new Map(holdings.map((row) => [positionKeyForGlobal(row), `${row.ticker ?? ""} ${row.name}`.trim()])) };
  });
  return {
    generatedAt: generatedAt(), sourceAsOf, type: "global" as const, coverage,
    confidence: confidenceForSignal({ ...coverage, scaleComplete: coverage.available, requiredObservations: 1, actualObservations: snapshots.length ? 1 : 0, dominantShare: null, directionalRatio: null }),
    cards,
    pairwise: pairwiseRows(pairItems),
    methodology: { setOverlap: "intersection count 與 Jaccard similarity", weightedOverlap: "Σ min(weightA, weightB)", commonDateOnly: false, missingWeight: "缺少權重的持股只納入集合重疊，不納入權重重疊", exposureIdentity: "Ticker/positionKey 與 assetType 共同識別；Equity、Swap、Cash 不會靜默合併" }
  };
}

export async function compareEtfs(db: Db, type: EtfComparisonType, codes: string[], date?: string) {
  return type === "tw" ? compareTaiwanEtfs(db, codes, date) : compareGlobalEtfs(db, codes, date);
}

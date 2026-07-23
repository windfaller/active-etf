import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import type { EtfDailyHolding } from "../../models/EtfDailyHolding.js";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { round } from "../../utils/number.js";
import { BoundedRequestCache } from "../cache/boundedRequestCache.js";
import { adjustmentIntensity, concentrationMetrics, confidenceForSignal, percentileRank } from "./calculations.js";
import { effectiveTaiwanDates, enabledTaiwanEtfCodes, generatedAt } from "./dataAccess.js";

function retentionRatio(current: EtfDailyHolding[], previous: EtfDailyHolding[]): number | null {
  if (!previous.length) return null;
  const currentIds = new Set(current.map((row) => row.stockId));
  return previous.filter((row) => currentIds.has(row.stockId)).length / previous.length;
}

function tendencyLabels(top10: number | null, averageDailyBreadth: number | null, intensity: number | null, retention20: number | null) {
  const labels: string[] = [];
  if (top10 !== null) labels.push(top10 >= 55 ? "集中持股" : "分散配置");
  if (averageDailyBreadth !== null || intensity !== null) labels.push((averageDailyBreadth ?? 0) >= 12 || (intensity ?? 0) >= 4 ? "調整頻率高" : "調整頻率低");
  if (retention20 !== null) labels.push(retention20 >= 0.8 ? "持股相對穩定" : "產業輪動明顯");
  return [...new Set(labels)];
}

function dailyBreadth(changes: EtfHoldingChange[]) {
  const byDate = new Map<string, EtfHoldingChange[]>();
  for (const row of changes) {
    const rows = byDate.get(row.tradeDate);
    if (rows) rows.push(row);
    else byDate.set(row.tradeDate, [row]);
  }
  const days = [...byDate.entries()].map(([date, rows]) => ({
    date,
    adjusted: rows.filter((row) => Math.abs(row.activeDiffLots ?? 0) > 0.01 || Math.abs(row.diffWeightPoint ?? 0) > 0.0001).length,
    increased: rows.filter((row) => (row.activeDiffLots ?? 0) > 0.01).length,
    decreased: rows.filter((row) => (row.activeDiffLots ?? 0) < -0.01).length,
    added: rows.filter((row) => row.status === "new").length,
    exited: rows.filter((row) => row.status === "exit").length
  })).sort((a, b) => b.date.localeCompare(a.date));
  const average = days.length ? round(days.reduce((sum, row) => sum + row.adjusted, 0) / days.length, 2) : null;
  return { average, days };
}

interface PeerMetric {
  etfCode: string;
  top10: number | null;
  intensity: number | null;
}

const peerMetricCaches = new WeakMap<Db, BoundedRequestCache>();

function peerMetricCacheFor(db: Db): BoundedRequestCache {
  const existing = peerMetricCaches.get(db);
  if (existing) return existing;
  const cache = new BoundedRequestCache(8);
  peerMetricCaches.set(db, cache);
  return cache;
}

async function peerMetricsForDates(db: Db, sourceAsOf: string | null, selectedDates: string[]): Promise<PeerMetric[]> {
  if (!sourceAsOf || !selectedDates.length) return [];
  const key = `${sourceAsOf}:${selectedDates[0]}:${selectedDates.at(-1)}:${selectedDates.length}`;
  return peerMetricCacheFor(db).getOrLoad(key, 300_000, async () => {
    const [allHoldings, allChanges] = await Promise.all([
      db.collection<EtfDailyHolding>("etf_daily_holdings").find(
        { etfCode: { $in: enabledTaiwanEtfCodes }, tradeDate: sourceAsOf },
        { projection: { _id: 0, etfCode: 1, weight: 1 } }
      ).toArray(),
      db.collection<EtfHoldingChange>("etf_holding_changes").find(
        { etfCode: { $in: enabledTaiwanEtfCodes }, tradeDate: { $in: selectedDates } },
        { projection: { _id: 0, etfCode: 1, diffWeightPoint: 1 } }
      ).toArray()
    ]);
    const holdingsByEtf = new Map<string, Array<number | null>>();
    const changesByEtf = new Map<string, Array<number | null>>();
    for (const row of allHoldings) {
      const values = holdingsByEtf.get(row.etfCode);
      if (values) values.push(row.weight);
      else holdingsByEtf.set(row.etfCode, [row.weight]);
    }
    for (const row of allChanges) {
      const values = changesByEtf.get(row.etfCode);
      if (values) values.push(row.diffWeightPoint);
      else changesByEtf.set(row.etfCode, [row.diffWeightPoint]);
    }
    return enabledTaiwanEtfCodes.map((etfCode) => ({
      etfCode,
      top10: concentrationMetrics(holdingsByEtf.get(etfCode) ?? []).top10,
      intensity: adjustmentIntensity(changesByEtf.get(etfCode) ?? [])
    })).filter((row) => row.top10 !== null || row.intensity !== null);
  });
}

export async function etfStyleProfile(db: Db, code: string, window: 20 | 60 = 20, date?: string) {
  const dates = await effectiveTaiwanDates(db, date, 60);
  const sourceAsOf = dates[0] ?? null;
  const selectedDates = dates.slice(0, window);
  const previous20Date = dates[19] ?? null;
  const previous60Date = dates[59] ?? null;
  const holdingDates = [sourceAsOf, previous20Date, previous60Date].filter((value): value is string => Boolean(value));
  const [holdings, changes] = await Promise.all([
    holdingDates.length ? db.collection<EtfDailyHolding>("etf_daily_holdings").find({ etfCode: code, tradeDate: { $in: holdingDates } }).toArray() : [],
    selectedDates.length ? db.collection<EtfHoldingChange>("etf_holding_changes").find({ etfCode: code, tradeDate: { $in: selectedDates } }).toArray() : []
  ]);
  const current = holdings.filter((row) => row.tradeDate === sourceAsOf).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const previous20 = holdings.filter((row) => row.tradeDate === previous20Date);
  const previous60 = holdings.filter((row) => row.tradeDate === previous60Date);
  const concentration = concentrationMetrics(current.map((row) => row.weight));
  const breadth = dailyBreadth(changes);
  const intensity = adjustmentIntensity(changes.map((row) => row.diffWeightPoint));

  const stockIds = [...new Set(changes.map((row) => row.stockId))];
  const profileRows = stockIds.length ? await db.collection<StockSectorProfile>("stock_sector_profiles").find({ stockId: { $in: stockIds } }).toArray() : [];
  const profileByStock = new Map(profileRows.map((row) => [row.stockId, row]));
  const sectorChanges = new Map<string, number>();
  for (const row of changes) {
    if (row.diffWeightPoint === null) continue;
    const sector = profileByStock.get(row.stockId)?.sector ?? "其他";
    sectorChanges.set(sector, (sectorChanges.get(sector) ?? 0) + row.diffWeightPoint);
  }
  const sectorRows = [...sectorChanges.entries()].map(([sector, change]) => ({ sector, change: round(change, 4) })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const sectorRotationIntensity = adjustmentIntensity(sectorRows.map((row) => row.change));

  const peerMetrics = await peerMetricsForDates(db, sourceAsOf, selectedDates);
  const availableDates = new Set(changes.map((row) => row.tradeDate)).size;
  const scaleCompleteDates = new Set(changes.filter((row) => row.activeDiffLots !== null).map((row) => row.tradeDate)).size;
  const coverage = { tracked: selectedDates.length, available: availableDates, delayed: Math.max(0, selectedDates.length - availableDates) };
  const config = configuredEtfs.find((row) => row.etfCode === code);
  const retention20 = retentionRatio(current, previous20);
  const retention60 = retentionRatio(current, previous60);
  return {
    generatedAt: generatedAt(),
    sourceAsOf,
    coverage,
    confidence: confidenceForSignal({ ...coverage, scaleComplete: scaleCompleteDates, requiredObservations: window, actualObservations: availableDates, dominantShare: null, directionalRatio: null }),
    etf: { code, name: config?.name ?? code, issuer: config?.issuer ?? "-", sourceUrl: config?.source.infoUrl ?? null },
    period: { window, effectiveTradingDays: selectedDates.length, startDate: selectedDates.at(-1) ?? null, endDate: sourceAsOf },
    concentration,
    adjustmentBreadth: {
      averageDailyAdjustedHoldings: breadth.average,
      latest: breadth.days[0] ?? null,
      trend: breadth.days.slice(0, 20)
    },
    adjustmentIntensity: intensity,
    sectorRotation: {
      intensity: sectorRotationIntensity,
      increased: sectorRows.filter((row) => row.change > 0).slice(0, 5),
      decreased: sectorRows.filter((row) => row.change < 0).slice(0, 5)
    },
    stability: {
      retention20,
      retention60,
      averageNewHoldingDuration: null,
      frequentEntryExitRatio: null
    },
    tendencies: tendencyLabels(concentration.top10, breadth.average, intensity, retention20),
    percentiles: {
      comparisonGroup: "台灣已啟用主動式 ETF",
      sampleSize: peerMetrics.length,
      calculationWindow: window,
      dataDate: sourceAsOf,
      top10Concentration: percentileRank(concentration.top10, peerMetrics.map((row) => row.top10)),
      adjustmentIntensity: percentileRank(intensity, peerMetrics.map((row) => row.intensity))
    },
    limitations: [
      previous20Date ? null : "資料不足，無法計算 20 個有效交易日持股保留比例。",
      previous60Date ? null : "資料不足，無法計算 60 個有效交易日持股保留比例。",
      "現有資料無法可靠推算新增持股平均維持時間與頻繁進出比例，因此保留為未知。",
      peerMetrics.length < 5 ? "同類有效樣本少於 5 檔，不顯示百分位。" : null
    ].filter(Boolean)
  };
}

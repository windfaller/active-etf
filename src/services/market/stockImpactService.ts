import type { Db } from "mongodb";
import type { EtfHoldingChange } from "../../models/EtfHoldingChange.js";
import type { SectorName } from "../../models/EtfSectorFlow.js";
import type { StockDailyMarket } from "../../models/StockDailyMarket.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import { round } from "../../utils/number.js";
import { sectorForStock } from "../sector/sectorMapping.js";

export interface StockImpactEtf {
  etfCode: string;
  diffLots: number;
  activeDiffLots: number | null;
  diffWeightPoint: number | null;
  currentWeight: number | null;
  status: string;
}

export interface StockImpactRow {
  stockId: string;
  stockName: string;
  sector: SectorName;
  etfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  totalDiffLots: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  maxAbsActiveDiffLots: number;
  maxAbsDiffWeightPoint: number;
  impactScore: number;
  market: Pick<
    StockDailyMarket,
    "market" | "closePrice" | "change" | "changePercent" | "volumeShares" | "turnover" | "transactionCount"
  > | null;
  institutional: Pick<
    StockInstitutionalFlow,
    "foreignNetShares" | "investmentTrustNetShares" | "dealerNetShares" | "totalNetShares"
  > | null;
  primaryImpactEtf: StockImpactEtf | null;
  etfs: StockImpactEtf[];
}

export interface StockImpactResponse {
  date: string;
  impacts: StockImpactRow[];
  sectorSummary: {
    date: string;
    sectors: Array<{
      sector: SectorName;
      stockCount: number;
      etfCount: number;
      totalActiveDiffLots: number;
      totalInstitutionalNetLots: number | null;
      totalTurnover: number | null;
      topStocks: Array<{
        stockId: string;
        stockName: string;
        impactScore: number;
        totalActiveDiffLots: number;
      }>;
    }>;
  };
}

function computeImpacts(changes: EtfHoldingChange[]): StockImpactRow[] {
  const rowsByStock = new Map<string, StockImpactRow>();

  for (const change of changes) {
    const row =
      rowsByStock.get(change.stockId) ??
      ({
        stockId: change.stockId,
        stockName: change.stockName,
        sector: sectorForStock(change.stockId, change.stockName),
        etfCount: 0,
        increaseEtfCount: 0,
        decreaseEtfCount: 0,
        totalDiffLots: 0,
        totalActiveDiffLots: 0,
        totalDiffWeightPoint: 0,
        maxAbsActiveDiffLots: 0,
        maxAbsDiffWeightPoint: 0,
        impactScore: 0,
        market: null,
        institutional: null,
        primaryImpactEtf: null,
        etfs: []
      } satisfies StockImpactRow);
    const activeDiffLots = change.activeDiffLots ?? change.diffLots;
    const diffWeightPoint = change.diffWeightPoint ?? 0;
    const etfImpact: StockImpactEtf = {
      etfCode: change.etfCode,
      diffLots: change.diffLots,
      activeDiffLots: change.activeDiffLots,
      diffWeightPoint: change.diffWeightPoint,
      currentWeight: change.currentWeight,
      status: change.status
    };
    const primaryMagnitude = Math.abs(row.primaryImpactEtf?.activeDiffLots ?? row.primaryImpactEtf?.diffLots ?? 0);

    row.etfs.push(etfImpact);
    row.etfCount += 1;
    row.increaseEtfCount += activeDiffLots > 0 ? 1 : 0;
    row.decreaseEtfCount += activeDiffLots < 0 ? 1 : 0;
    row.totalDiffLots = round(row.totalDiffLots + change.diffLots);
    row.totalActiveDiffLots = round(row.totalActiveDiffLots + activeDiffLots);
    row.totalDiffWeightPoint = round(row.totalDiffWeightPoint + diffWeightPoint);
    row.maxAbsActiveDiffLots = Math.max(row.maxAbsActiveDiffLots, Math.abs(activeDiffLots));
    row.maxAbsDiffWeightPoint = Math.max(row.maxAbsDiffWeightPoint, Math.abs(diffWeightPoint));
    if (!row.primaryImpactEtf || Math.abs(activeDiffLots) > primaryMagnitude) row.primaryImpactEtf = etfImpact;
    rowsByStock.set(change.stockId, row);
  }

  return [...rowsByStock.values()]
    .map((row) => ({
      ...row,
      impactScore: Math.round(row.maxAbsActiveDiffLots * 100 + row.maxAbsDiffWeightPoint * 10000) / 100
    }))
    .sort((a, b) => b.impactScore - a.impactScore);
}

function buildSectorSummary(date: string, impacts: StockImpactRow[]): StockImpactResponse["sectorSummary"] {
  const rowsBySector = new Map<
    SectorName,
    {
      sector: SectorName;
      stockIds: Set<string>;
      etfCodes: Set<string>;
      totalActiveDiffLots: number;
      totalInstitutionalNetShares: number;
      hasInstitutional: boolean;
      totalTurnover: number;
      hasTurnover: boolean;
      topStocks: StockImpactResponse["sectorSummary"]["sectors"][number]["topStocks"];
    }
  >();

  for (const impact of impacts) {
    const row =
      rowsBySector.get(impact.sector) ??
      {
        sector: impact.sector,
        stockIds: new Set<string>(),
        etfCodes: new Set<string>(),
        totalActiveDiffLots: 0,
        totalInstitutionalNetShares: 0,
        hasInstitutional: false,
        totalTurnover: 0,
        hasTurnover: false,
        topStocks: []
      };

    row.stockIds.add(impact.stockId);
    impact.etfs.forEach((etf) => row.etfCodes.add(etf.etfCode));
    row.totalActiveDiffLots = round(row.totalActiveDiffLots + impact.totalActiveDiffLots);
    if (impact.institutional?.totalNetShares !== null && impact.institutional?.totalNetShares !== undefined) {
      row.totalInstitutionalNetShares += impact.institutional.totalNetShares;
      row.hasInstitutional = true;
    }
    if (impact.market?.turnover !== null && impact.market?.turnover !== undefined) {
      row.totalTurnover += impact.market.turnover;
      row.hasTurnover = true;
    }
    row.topStocks.push({
      stockId: impact.stockId,
      stockName: impact.stockName,
      impactScore: impact.impactScore,
      totalActiveDiffLots: impact.totalActiveDiffLots
    });
    rowsBySector.set(impact.sector, row);
  }

  return {
    date,
    sectors: [...rowsBySector.values()]
      .map((row) => ({
        sector: row.sector,
        stockCount: row.stockIds.size,
        etfCount: row.etfCodes.size,
        totalActiveDiffLots: round(row.totalActiveDiffLots),
        totalInstitutionalNetLots: row.hasInstitutional ? round(row.totalInstitutionalNetShares / 1000) : null,
        totalTurnover: row.hasTurnover ? row.totalTurnover : null,
        topStocks: row.topStocks.sort((a, b) => b.impactScore - a.impactScore).slice(0, 3)
      }))
      .sort((a, b) => Math.abs(b.totalActiveDiffLots) - Math.abs(a.totalActiveDiffLots))
  };
}

export async function stockImpactsForDate(db: Db, date: string, changes: EtfHoldingChange[]): Promise<StockImpactResponse> {
  const impacts = computeImpacts(changes);
  const stockIds = impacts.map((row) => row.stockId);
  if (!stockIds.length) {
    return { date, impacts, sectorSummary: { date, sectors: [] } };
  }

  const [marketRows, institutionalRows] = await Promise.all([
    db.collection<StockDailyMarket>("stock_daily_market").find({ tradeDate: date, stockId: { $in: stockIds } }).toArray(),
    db
      .collection<StockInstitutionalFlow>("stock_institutional_flows")
      .find({ tradeDate: date, stockId: { $in: stockIds } })
      .toArray()
  ]);
  const marketByStockId = new Map(marketRows.map((row) => [row.stockId, row]));
  const institutionalByStockId = new Map(institutionalRows.map((row) => [row.stockId, row]));

  const enriched = impacts.map((impact) => {
    const market = marketByStockId.get(impact.stockId);
    const institutional = institutionalByStockId.get(impact.stockId);
    return {
      ...impact,
      market: market
        ? {
            market: market.market,
            closePrice: market.closePrice,
            change: market.change,
            changePercent: market.changePercent,
            volumeShares: market.volumeShares,
            turnover: market.turnover,
            transactionCount: market.transactionCount
          }
        : null,
      institutional: institutional
        ? {
            foreignNetShares: institutional.foreignNetShares,
            investmentTrustNetShares: institutional.investmentTrustNetShares,
            dealerNetShares: institutional.dealerNetShares,
            totalNetShares: institutional.totalNetShares
          }
        : null
    };
  });

  return {
    date,
    impacts: enriched,
    sectorSummary: buildSectorSummary(date, enriched)
  };
}

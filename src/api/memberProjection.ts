import {
  MEMBER_LOCKED_RESULT,
  maskAllMemberResults,
  maskMemberResults,
  shouldMaskMemberResult,
  type MemberResult
} from "../domain/memberAccess.js";
import type { EtfHoldingChange } from "../models/EtfHoldingChange.js";
import { configuredEtfs } from "../config/etfs.js";
import type { StockImpactResponse } from "../services/market/stockImpactService.js";
import type { EtfCoverageResponse } from "../web/contracts/dashboard.js";
import type { MarketMemberPreview } from "../web/contracts/memberPreview.js";
import { buildDailyBrief } from "../web/domain/dailyBrief.js";
import { buildPullPushPreview } from "../web/domain/pullPushRadar.js";

export function projectStockImpactForMember(response: StockImpactResponse, authenticated: boolean) {
  return {
    ...response,
    impacts: maskMemberResults(response.impacts, authenticated),
    sectorSummary: {
      ...response.sectorSummary,
      sectors: response.sectorSummary.sectors.map((sector) => ({
        ...sector,
        topStocks: maskAllMemberResults(sector.topStocks, authenticated)
      }))
    }
  };
}

export function projectMarketDashboardForMember<T extends {
  date: string;
  stockImpact: StockImpactResponse;
  coverage: {
    date: string | null;
    trackedCount: number;
    availableCount: number;
    staleCount: number;
    etfs: Array<{
      etfCode: string;
      name: string;
      issuer: string;
      providerId: string;
      latestTradeDate: string | null;
      hasSelectedDate: boolean;
      status: "available" | "stale" | "missing" | "newer_available";
      updatedAt: Date | string | null;
    }>;
  };
}>(dashboard: T, authenticated: boolean): Omit<T, "stockImpact"> & {
  stockImpact: ReturnType<typeof projectStockImpactForMember>;
  memberPreview: MarketMemberPreview;
} {
  const coverage: EtfCoverageResponse = {
    ...dashboard.coverage,
    etfs: dashboard.coverage.etfs.map((row) => ({
      ...row,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
    }))
  };
  const brief = buildDailyBrief(dashboard.stockImpact.impacts, dashboard.stockImpact.sectorSummary.sectors, coverage);
  const issuerByEtf = new Map(configuredEtfs.map((row) => [row.etfCode, row.issuer]));
  const pullPush = buildPullPushPreview(dashboard.stockImpact.impacts, coverage, dashboard.date, issuerByEtf);
  return {
    ...dashboard,
    stockImpact: projectStockImpactForMember(dashboard.stockImpact, authenticated),
    memberPreview: {
      brief: {
        ...brief,
        insights: maskMemberResults(brief.insights, authenticated, "after-first"),
        additions: maskMemberResults(brief.additions, authenticated, "human-odd"),
        reductions: maskMemberResults(brief.reductions, authenticated, "human-odd"),
        sectors: brief.sectors.map((sector) => ({
          ...sector,
          topStocks: maskAllMemberResults(sector.topStocks, authenticated)
        }))
      },
      pullPush: {
        ...pullPush,
        candidates: maskMemberResults(pullPush.candidates, authenticated, "after-first")
      }
    }
  };
}

type ChangeCollection = {
  topIncreases: EtfHoldingChange[];
  topDecreases: EtfHoldingChange[];
  topActiveIncreases: EtfHoldingChange[];
  topActiveDecreases: EtfHoldingChange[];
  newHoldings: EtfHoldingChange[];
  exitedHoldings: EtfHoldingChange[];
  tagMovements?: Array<{ topStocks: unknown[] }>;
};

export function projectChangeCollectionsForMember<T extends ChangeCollection>(changes: T, authenticated: boolean) {
  const orderedUnique = [
    ...changes.topActiveIncreases,
    ...changes.topActiveDecreases,
    ...changes.topIncreases,
    ...changes.topDecreases,
    ...changes.newHoldings,
    ...changes.exitedHoldings
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.stockId === row.stockId) === index);
  const memberOperationRows = orderedUnique
    .filter((row) => row.diffShares !== 0 || row.status === "new" || row.status === "exit")
    .sort((a, b) => Math.abs(b.activeDiffLots ?? b.diffLots) - Math.abs(a.activeDiffLots ?? a.diffLots));
  if (authenticated) return { ...changes, memberOperationRows };
  const lockedStockIds = new Set(orderedUnique.filter((_, index) => shouldMaskMemberResult(false, index)).map((row) => row.stockId));
  const project = (rows: EtfHoldingChange[]): Array<MemberResult<EtfHoldingChange>> =>
    rows.map((row) => lockedStockIds.has(row.stockId) ? MEMBER_LOCKED_RESULT : row);

  return {
    ...changes,
    memberOperationRows: project(memberOperationRows),
    topIncreases: project(changes.topIncreases),
    topDecreases: project(changes.topDecreases),
    topActiveIncreases: project(changes.topActiveIncreases),
    topActiveDecreases: project(changes.topActiveDecreases),
    newHoldings: project(changes.newHoldings),
    exitedHoldings: project(changes.exitedHoldings),
    tagMovements: changes.tagMovements?.map((row) => ({
      ...row,
      topStocks: maskMemberResults(row.topStocks, false)
    }))
  };
}

import type { GlobalEtfStrategyType } from "../config/globalEtfs.js";

export type GlobalEtfSourceStatus = "ok" | "unavailable" | "stale" | "error";

export interface GlobalEtfHolding {
  etfCode: string;
  fundName: string;
  issuer: string;
  sourceAsOf: string;
  fetchedAt: Date;
  sourceUrl: string;
  sourceStatus: GlobalEtfSourceStatus;
  productGroup: "global_etf";
  market: "US";
  strategyType?: GlobalEtfStrategyType;
  positionKey: string;
  ticker?: string;
  sourceTicker?: string;
  name: string;
  identifier?: string;
  weightPercent?: number;
  shares?: number;
  parValue?: number;
  marketValue?: number;
  notionalValue?: number;
  price?: number;
  country?: string;
  sector?: string;
  industry?: string;
  assetType?: string;
  exposureComponents?: Array<{
    ticker?: string;
    name: string;
    weightPercent?: number;
    assetType?: string;
  }>;
  raw?: unknown;
}

export interface GlobalEtfSnapshot {
  snapshotId: string;
  etfCode: string;
  fundName: string;
  issuer: string;
  sourceAsOf: string;
  fetchedAt: Date;
  sourceUrl: string;
  sourceStatus: GlobalEtfSourceStatus;
  productGroup: "global_etf";
  market: "US";
  strategyType?: GlobalEtfStrategyType;
  rowCount: number;
  rawRowCount: number;
  signature: string;
  holdings: GlobalEtfHolding[];
  rawSnapshotId?: string;
  unusableReason?: string;
}

export interface GlobalEtfHoldingChange {
  etfCode: string;
  sourceAsOf: string;
  prevSourceAsOf: string | null;
  positionKey: string;
  ticker?: string;
  name: string;
  sector?: string;
  country?: string;
  assetType?: string;
  prevWeightPercent?: number;
  currentWeightPercent?: number;
  deltaPp?: number;
  prevShares?: number;
  currentShares?: number;
  deltaShares?: number;
  prevMarketValue?: number;
  currentMarketValue?: number;
  deltaMarketValue?: number;
  status: "new" | "exit" | "increase" | "decrease" | "unchanged";
}

export interface GlobalEtfAggregateChange {
  name: string;
  prevWeightPercent: number;
  currentWeightPercent: number;
  deltaPp: number;
}

export interface GlobalEtfCommonHolding {
  positionKey: string;
  ticker?: string;
  name: string;
  sector?: string;
  assetType?: string;
  etfCount: number;
  totalWeightPercent: number;
  maxWeightPercent: number;
  etfs: Array<{
    etfCode: string;
    weightPercent?: number;
  }>;
}

export interface GlobalEtfReportSection {
  etfCode: string;
  fundName: string;
  issuer: string;
  strategyType?: GlobalEtfStrategyType;
  sourceAsOf: string;
  sourceUrl: string;
  sourceStatus: GlobalEtfSourceStatus;
  rowCount: number;
  topHoldings: GlobalEtfHolding[];
  newPositions: GlobalEtfHoldingChange[];
  exitedPositions: GlobalEtfHoldingChange[];
  weightChanges: GlobalEtfHoldingChange[];
  shareChanges: GlobalEtfHoldingChange[];
  marketValueChanges: GlobalEtfHoldingChange[];
  sectorChanges: GlobalEtfAggregateChange[];
  countryChanges: GlobalEtfAggregateChange[];
  takeaway: string;
}

export interface GlobalEtfDailyReport {
  productGroup: "global_etf";
  reportDate: string;
  coveredEtfs: string[];
  successCount: number;
  totalCount: number;
  highlights: string[];
  statusRows: Array<{
    etfCode: string;
    sourceAsOf: string;
    rowCount: number;
    sourceStatus: GlobalEtfSourceStatus;
  }>;
  commonHoldings: GlobalEtfCommonHolding[];
  globalMovers: GlobalEtfHoldingChange[];
  sections: GlobalEtfReportSection[];
  adContext: {
    tags: string[];
  };
  html: string;
  demoMode?: boolean;
}

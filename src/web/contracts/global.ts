import type { MemberResult } from "../../domain/memberAccess.js";

export interface GlobalHolding {
  ticker?: string;
  sourceTicker?: string;
  name: string;
  weightPercent?: number;
  marketValue?: number;
  sector?: string;
  assetType?: string;
  exposureComponents?: Array<{
    ticker?: string;
    name: string;
    weightPercent?: number;
    assetType?: string;
  }>;
}

export interface GlobalChange {
  etfCode: string;
  positionKey?: string;
  ticker?: string;
  name: string;
  currentWeightPercent?: number;
  prevWeightPercent?: number;
  deltaPp?: number;
  status: string;
}

export interface GlobalCommonHolding {
  positionKey: string;
  ticker?: string;
  name: string;
  sector?: string;
  assetType?: string;
  etfCount: number;
  totalWeightPercent: number;
  maxWeightPercent: number;
  etfs: Array<{ etfCode: string; weightPercent?: number }>;
}

export interface GlobalCommonWebRow {
  ticker?: string;
  name: string;
  etfs: Array<{ code: string; weight: number }>;
  total: number;
  max: number;
}

export interface GlobalCommonWeightChange {
  ticker?: string;
  name: string;
  etfs: string[];
  delta: number;
}

export interface GlobalReportSection {
  etfCode: string;
  fundName: string;
  issuer: string;
  strategyType?: string;
  sourceAsOf: string;
  filedAt?: string;
  capturedAt?: string;
  sourceUrl: string;
  sourceStatus: string;
  rowCount: number;
  topHoldings: Array<MemberResult<GlobalHolding>>;
  newPositions?: Array<MemberResult<GlobalChange>>;
  exitedPositions?: Array<MemberResult<GlobalChange>>;
  weightChanges: Array<MemberResult<GlobalChange>>;
  takeaway?: string;
}

export interface GlobalEtfOption {
  etfCode: string;
  fundName: string;
  strategyType?: string;
}

export interface GlobalEtfUniverseResponse {
  productGroup: "global_etf";
  enabled: GlobalEtfOption[];
  candidates: GlobalEtfOption[];
}

export interface GlobalReport {
  reportDate: string;
  coveredEtfs: string[];
  successCount: number;
  totalCount: number;
  highlights: string[];
  statusRows: Array<{ etfCode: string; sourceAsOf: string; rowCount: number; sourceStatus: string }>;
  commonHoldings?: Array<MemberResult<GlobalCommonWebRow>>;
  commonWeightChanges?: Array<MemberResult<GlobalCommonWeightChange>>;
  globalMovers?: Array<MemberResult<GlobalChange>>;
  sections: GlobalReportSection[];
  adContext: { tags: string[] };
  demoMode?: boolean;
}

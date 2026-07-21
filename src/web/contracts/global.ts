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
  topHoldings: GlobalHolding[];
  newPositions?: GlobalChange[];
  exitedPositions?: GlobalChange[];
  weightChanges: GlobalChange[];
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
  commonHoldings?: GlobalCommonHolding[];
  globalMovers?: GlobalChange[];
  sections: GlobalReportSection[];
  adContext: { tags: string[] };
  demoMode?: boolean;
}

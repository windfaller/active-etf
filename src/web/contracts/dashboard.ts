export type NullableNumber = number | null;

export interface Holding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: NullableNumber;
  marketValue: NullableNumber;
}

export interface Summary {
  tradeDate: string;
  nav: NullableNumber;
  marketPrice: NullableNumber;
  premiumDiscount: NullableNumber;
  totalUnits: NullableNumber;
  fundSize: NullableNumber;
  netCreationUnits: NullableNumber;
  cashRatio: NullableNumber;
  stockRatio: NullableNumber;
}

export interface Change {
  stockId: string;
  stockName: string;
  prevShares: number;
  currentShares: number;
  diffShares: number;
  diffLots: number;
  diffPct: NullableNumber;
  prevWeight: NullableNumber;
  currentWeight: NullableNumber;
  diffWeightPoint: NullableNumber;
  expectedSharesByScale: NullableNumber;
  activeDiffShares: NullableNumber;
  activeDiffLots: NullableNumber;
  activeDiffPct: NullableNumber;
  activeSignalScore: NullableNumber;
  status: string;
}

export interface TagMovement {
  tag: string;
  direction: "increase" | "decrease" | "mixed" | "flat";
  stockCount: number;
  increaseStockCount: number;
  decreaseStockCount: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  totalCurrentWeight: number;
  movementScore: number;
  topStocks: Array<{
    stockId: string;
    stockName: string;
    activeDiffLots: number;
    diffWeightPoint: number;
    currentWeight: NullableNumber;
    status: string;
  }>;
}

export interface ChangesResponse {
  topIncreases: Change[];
  topDecreases: Change[];
  topActiveIncreases: Change[];
  topActiveDecreases: Change[];
  newHoldings: Change[];
  exitedHoldings: Change[];
  tagMovements: TagMovement[];
}

export interface StockImpactEtf {
  etfCode: string;
  diffLots: number;
  activeDiffLots: NullableNumber;
  diffWeightPoint: NullableNumber;
  currentWeight: NullableNumber;
  status: string;
}

export interface StockImpact {
  stockId: string;
  stockName: string;
  sector: string;
  themeTags: string[];
  etfCount: number;
  increaseEtfCount: number;
  decreaseEtfCount: number;
  totalDiffLots: number;
  totalActiveDiffLots: number;
  totalDiffWeightPoint: number;
  maxAbsActiveDiffLots: number;
  maxAbsDiffWeightPoint: number;
  impactScore: number;
  market: {
    market: "TWSE" | "TPEx";
    closePrice: NullableNumber;
    change: NullableNumber;
    changePercent: NullableNumber;
    volumeShares: NullableNumber;
    turnover: NullableNumber;
    transactionCount: NullableNumber;
  } | null;
  institutional: {
    foreignNetShares: NullableNumber;
    investmentTrustNetShares: NullableNumber;
    dealerNetShares: NullableNumber;
    totalNetShares: NullableNumber;
  } | null;
  primaryImpactEtf: StockImpactEtf | null;
  etfs: StockImpactEtf[];
}

export interface SectorSummaryRow {
  sector: string;
  stockCount: number;
  etfCount: number;
  totalActiveDiffLots: number;
  totalInstitutionalNetLots: NullableNumber;
  totalTurnover: NullableNumber;
  topStocks: Array<{
    stockId: string;
    stockName: string;
    impactScore: number;
    totalActiveDiffLots: number;
  }>;
}

export interface EtfCoverageRow {
  etfCode: string;
  name: string;
  issuer: string;
  providerId: string;
  latestTradeDate: string | null;
  hasSelectedDate: boolean;
  status: "available" | "stale" | "missing" | "newer_available";
  updatedAt: string | null;
}

export interface EtfCoverageResponse {
  date: string | null;
  trackedCount: number;
  availableCount: number;
  staleCount: number;
  etfs: EtfCoverageRow[];
}

export interface DashboardResponse {
  holdings: Holding[];
  summary: Summary | null;
  changes: ChangesResponse;
  summaries: Summary[];
  stockImpact: {
    impacts: StockImpact[];
    sectorSummary: { sectors: SectorSummaryRow[] };
  };
  coverage: EtfCoverageResponse;
}

export const emptyChanges: ChangesResponse = {
  topIncreases: [],
  topDecreases: [],
  topActiveIncreases: [],
  topActiveDecreases: [],
  newHoldings: [],
  exitedHoldings: [],
  tagMovements: []
};

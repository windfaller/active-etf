import type { IntelligenceMeta, SignalDirection } from "./intelligence";

export type StockMarket = "tw" | "us";

export interface StockOverview extends IntelligenceMeta {
  found: boolean;
  stock: { market: StockMarket; symbol: string; normalizedSymbol: string; name: string; sector: string | null; industry: string | null };
  summary: { dataDate: string | null; lastUpdated: string | null; coveredEtfs: number; primarySources: string[] };
  today: null | {
    activeNetLots: number | null;
    surfaceNetLots: number;
    scaleAdjustedNetLots: number | null;
    increaseEtfCount: number;
    decreaseEtfCount: number;
    neutralEtfCount: number;
    unknownEtfCount: number;
    consensus: { formed: boolean; direction: SignalDirection; sameDirectionRatio: number | null };
    institutionRelation: "aligned" | "divergent" | "insufficient";
    primaryEtfs: Array<{ etfCode: string; activeDiffLots: number | null; diffLots: number; direction: SignalDirection }>;
  };
  overseasEtfExposure: null | { timeScale: string; rows: Array<{ etfCode: string; fundName: string; sourceAsOf: string; fetchedAt: string; sourceUrl: string; sourceStatus: string; assetType: string; weightPercent: number | null; shares: number | null }> };
  sec13f: null | { timeScale: string; rows: Array<{ institutionCode: string; institutionName: string; periodOfReport: string; filedAt: string | null; capturedAt: string; shares: number | null; marketValue: number | null; weightPercent: number | null; sourceUrl: string }> };
}

export interface StockHistory extends IntelligenceMeta {
  market: StockMarket;
  symbol: string;
  window: number;
  summary?: {
    cumulativeActiveNetLots: number | null;
    increaseTradingDays: number;
    decreaseTradingDays: number;
    consecutive: { direction: SignalDirection; tradingDays: number; startDate: string | null; latestDate: string | null; cumulativeActiveNetLots: number | null };
    reversal: { detected: boolean; date: string | null; from: SignalDirection; to: SignalDirection; priorTradingDays: number };
    sameDirectionEtfRatio: number | null;
    dataCoverageRate: number;
  };
  points: Array<{ date: string; activeNetLots?: number | null; surfaceNetLots?: number; direction?: SignalDirection; sameDirectionEtfRatio?: number | null; totalWeightPercent?: number; etfCount?: number }>;
  timeScale?: string;
}

export interface StockEtfs extends IntelligenceMeta {
  rows: Array<{ etfCode: string; name: string; latestWeight: number | null; weightChange: number | null; activeNetLots?: number | null; surfaceNetLots?: number | null; consecutiveDirection?: SignalDirection; consecutiveTradingDays?: number; dataDate: string | null; confidence: string; assetType?: string; sourceUrl?: string }>;
}

export interface StockInstitutions extends IntelligenceMeta {
  timeScale: string;
  row?: null | { foreignNetShares: number | null; investmentTrustNetShares: number | null; dealerNetShares: number | null; totalNetShares: number | null; source: string; relation: string };
  rows?: Array<{ institutionCode: string; institutionName: string; periodOfReport: string; filedAt: string | null; capturedAt: string; shares: number | null; marketValue: number | null; sourceUrl: string }>;
}

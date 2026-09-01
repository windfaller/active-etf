import type { IntelligenceMeta } from "./intelligence";
import type { MemberResult } from "../../domain/memberAccess.js";

export interface StyleProfile extends IntelligenceMeta {
  etf: { code: string; name: string; issuer: string; sourceUrl: string | null };
  period: { window: number; effectiveTradingDays: number; startDate: string | null; endDate: string | null };
  concentration: { top5: number | null; top10: number | null; hhi: number | null };
  adjustmentBreadth: MemberResult<{ averageDailyAdjustedHoldings: number | null; latest: null | { adjusted: number; increased: number; decreased: number; added: number; exited: number }; trend: Array<{ date: string; adjusted: number }> }>;
  adjustmentIntensity: number | null;
  sectorRotation: { intensity: number | null; increased: Array<{ sector: string; change: number }>; decreased: Array<{ sector: string; change: number }> };
  stability: MemberResult<{ retention20: number | null; retention60: number | null; averageNewHoldingDuration: null; frequentEntryExitRatio: null }>;
  tendencies: string[];
  percentiles: MemberResult<{ comparisonGroup: string; sampleSize: number; calculationWindow: number; dataDate: string | null; top10Concentration: number | null; adjustmentIntensity: number | null }>;
  limitations: string[];
}

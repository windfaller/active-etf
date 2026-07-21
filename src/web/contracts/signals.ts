import type { IntelligenceCoverage, IntelligenceMeta, SignalDirection } from "./intelligence";

interface SignalStock { market: "tw"; symbol: string; name: string; path: string }
interface SignalRowMeta { stock: SignalStock; coverage: IntelligenceCoverage; confidence: { level: "high" | "medium" | "low"; reason: string } }

export interface SignalsResponse extends IntelligenceMeta {
  market: "tw";
  window: 3 | 5 | 20;
  kind: "all" | "consecutive" | "reversals" | "divergence";
  methodology: Record<string, string>;
  consecutive: Array<SignalRowMeta & { direction: SignalDirection; consecutiveTradingDays: number; cumulativeActiveNetLots: number | null; participatingEtfs: number; sameDirectionEtfRatio: number | null; neutralEtfs: number; startDate: string | null; latestDate: string | null; actualObservationCount: number; missingObservationCount: number }>;
  reversals: Array<SignalRowMeta & { reversalType: string; from: SignalDirection; to: SignalDirection; priorTradingDays: number; reversalDate: string | null; beforeActiveNetLots: number | null; afterActiveNetLots: number | null; majorityEtfDirectionFlip: boolean; participatingEtfs: number; sameDirectionEtfRatio: number | null }>;
  divergences: Array<SignalRowMeta & { etfDirection: SignalDirection; institutionNetShares: number | null; relation: string; changedFromAligned: boolean; date: string | null }>;
}

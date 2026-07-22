import type { IntelligenceMeta } from "./intelligence";

export interface EtfComparison extends IntelligenceMeta {
  type: "tw" | "global";
  cards: Array<{
    code: string;
    name: string;
    issuer: string;
    sourceAsOf: string | null;
    fundSize: number | null;
    premiumDiscount?: number | null;
    holdingCount: number;
    top10Concentration: number | null;
    hhi: number | null;
    sectorExposure: Array<{ sector: string; weight: number }>;
    activeAdjustments?: Array<{ window: number; cumulativeActiveNetLots: number | null; adjustmentIntensity: number | null; increaseHoldingChangeCount: number; decreaseHoldingChangeCount: number }>;
    addedHoldings?: number;
    exitedHoldings?: number;
    dataCoverageRate?: number;
    assetComposition?: Array<{ assetType: string; weight: number }>;
    weightAdjustmentIntensity?: number | null;
    fetchedAt?: string | null;
    sourceUrl?: string | null;
    sourceStatus?: string;
    topHoldings: Array<{ key: string; symbol: string | null; name: string; assetType: string; weight: number | null }>;
  }>;
  pairwise: Array<{ left: string; right: string; intersectionCount: number; unionCount: number; similarity: number | null; weightedOverlap: number | null; common: Array<{ key: string; label: string; leftWeight: number | null; rightWeight: number | null }> }>;
  dateAlignment?: { commonDateOnly: boolean; commonDate: string | null; rows: Array<{ etfCode: string; sourceAsOf: string | null; fetchedAt: string | null }> };
  methodology: { setOverlap: string; weightedOverlap: string; commonDateOnly: boolean; missingWeight: string; exposureIdentity: string; dateBasis?: string };
}

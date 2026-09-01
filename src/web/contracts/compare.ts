import type { IntelligenceMeta } from "./intelligence";
import type { MemberResult } from "../../domain/memberAccess.js";

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
    sectorExposure: Array<MemberResult<{ sector: string; weight: number }>>;
    activeAdjustments?: Array<MemberResult<{ window: number; cumulativeActiveNetLots: number | null; adjustmentIntensity: number | null; increaseHoldingChangeCount: number; decreaseHoldingChangeCount: number }>>;
    addedHoldings?: MemberResult<number>;
    exitedHoldings?: MemberResult<number>;
    dataCoverageRate?: number;
    assetComposition?: Array<MemberResult<{ assetType: string; weight: number }>>;
    weightAdjustmentIntensity?: MemberResult<number | null>;
    fetchedAt?: string | null;
    sourceUrl?: string | null;
    sourceStatus?: string;
    topHoldings: Array<MemberResult<{ key: string; symbol: string | null; name: string; assetType: string; weight: number | null }>>;
  }>;
  pairwise: Array<MemberResult<{ left: string; right: string; intersectionCount: number; unionCount: number; similarity: number | null; weightedOverlap: number | null; common: Array<MemberResult<{ key: string; label: string; leftWeight: number | null; rightWeight: number | null }>> }>>;
  dateAlignment?: { commonDateOnly: false; commonDate: string | null; rows: Array<{ code: string; sourceAsOf: string | null; fetchedAt: string | null }> };
  methodology: { setOverlap: string; weightedOverlap: string; commonDateOnly: boolean; missingWeight: string; exposureIdentity: string; dateBasis?: string };
}

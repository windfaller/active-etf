import type { MemberResult } from "../../domain/memberAccess.js";
import type { DailyBriefResult, DailyInsight } from "../domain/dailyBrief.js";
import type { PullPushPreview, PullPushPreviewCandidate } from "../domain/pullPushRadar.js";
import type { SectorSummaryRow, StockImpact } from "./dashboard.js";

type SectorTopStock = SectorSummaryRow["topStocks"][number];

export type MemberPreviewSector = Omit<SectorSummaryRow, "topStocks"> & {
  topStocks: Array<MemberResult<SectorTopStock>>;
};

export type MemberDailyBrief = Omit<DailyBriefResult, "insights" | "additions" | "reductions" | "sectors"> & {
  insights: Array<MemberResult<DailyInsight>>;
  additions: Array<MemberResult<StockImpact>>;
  reductions: Array<MemberResult<StockImpact>>;
  sectors: MemberPreviewSector[];
};

export type MemberPullPushPreview = Omit<PullPushPreview, "candidates"> & {
  candidates: Array<MemberResult<PullPushPreviewCandidate>>;
};

export interface MarketMemberPreview {
  brief: MemberDailyBrief;
  pullPush: MemberPullPushPreview;
}

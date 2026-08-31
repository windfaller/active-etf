import type { EtfCoverageResponse, StockImpact } from "../contracts/dashboard.js";

export type CrossSourceState = "aligned" | "divergent" | "missing";

export interface PullPushPreviewCandidate {
  stockId: string;
  stockName: string;
  adjustedActiveLots: number;
  rawDiffLots: number;
  flowCorrectionCoverage: number;
  totalEtfCount: number;
  adjustedEtfCount: number;
  activeEtfCount: number;
  issuerCount: number;
  investmentTrustNetShares: number | null;
  crossSourceState: CrossSourceState;
  statusLabel: "推力初篩同向" | "ETF／投信分歧" | "ETF 單側訊號";
  decision: "僅觀察";
  pullScore: null;
  pushScoreV21: null;
  investableScore: null;
  blockers: string[];
}

export interface PullPushPreview {
  selectedDate: string;
  coverageLabel: string;
  candidates: PullPushPreviewCandidate[];
  readiness: Array<{ label: string; status: "ready" | "partial" | "missing"; detail: string }>;
}

function candidateForImpact(
  row: StockImpact,
  issuerByEtf: ReadonlyMap<string, string>
): PullPushPreviewCandidate | null {
  const adjustedRows = row.etfs.filter((item) => item.activeDiffLots !== null);
  const positiveRows = adjustedRows.filter((item) => (item.activeDiffLots ?? 0) > 0);
  const adjustedActiveLots = adjustedRows.reduce((sum, item) => sum + (item.activeDiffLots ?? 0), 0);
  if (adjustedActiveLots <= 0 || positiveRows.length === 0) return null;

  const rawDiffLots = row.etfs.reduce((sum, item) => sum + item.diffLots, 0);
  const issuers = new Set(positiveRows.map((item) => issuerByEtf.get(item.etfCode)).filter((value): value is string => Boolean(value)));
  const investmentTrustNetShares = row.institutional?.investmentTrustNetShares ?? null;
  const crossSourceState: CrossSourceState = investmentTrustNetShares === null || investmentTrustNetShares === 0
    ? "missing"
    : investmentTrustNetShares > 0
      ? "aligned"
      : "divergent";
  const flowCorrectionCoverage = row.etfs.length > 0 ? adjustedRows.length / row.etfs.length : 0;
  const blockers = [
    "缺少分析師共識、可驗證催化與獲利改善資料，拉力不計分。",
    "缺少自由流通股、投信持股比率與 20 日平均成交額，投信 35 分不計算。",
    "缺少經理人穩定 ID 與所有持有該股 ETF 的完整分母，manager breadth 與 single-source cap 尚未完成。",
    "尚未依揭露時間確認訊號形成日與最早可交易日。"
  ];
  if (flowCorrectionCoverage < 1) {
    blockers.unshift("部分 ETF 缺流通單位，原始張數已排除於主動增持。");
  }
  if (positiveRows.length > issuers.size) {
    blockers.unshift("同投信旗下多檔 ETF 已保守視為重疊來源，不當成完全獨立資金。");
  }

  return {
    stockId: row.stockId,
    stockName: row.stockName,
    adjustedActiveLots,
    rawDiffLots,
    flowCorrectionCoverage,
    totalEtfCount: row.etfs.length,
    adjustedEtfCount: adjustedRows.length,
    activeEtfCount: positiveRows.length,
    issuerCount: issuers.size,
    investmentTrustNetShares,
    crossSourceState,
    statusLabel: crossSourceState === "aligned" && positiveRows.length >= 2 && issuers.size >= 2
      ? "推力初篩同向"
      : crossSourceState === "divergent"
        ? "ETF／投信分歧"
        : "ETF 單側訊號",
    decision: "僅觀察",
    pullScore: null,
    pushScoreV21: null,
    investableScore: null,
    blockers
  };
}

export function buildPullPushPreview(
  impacts: StockImpact[],
  coverage: EtfCoverageResponse | null,
  selectedDate: string,
  issuerByEtf: ReadonlyMap<string, string>
): PullPushPreview {
  const candidates = impacts
    .map((row) => candidateForImpact(row, issuerByEtf))
    .filter((row): row is PullPushPreviewCandidate => row !== null)
    .sort((left, right) => {
      const alignedDelta = Number(right.crossSourceState === "aligned") - Number(left.crossSourceState === "aligned");
      return alignedDelta
        || right.issuerCount - left.issuerCount
        || right.activeEtfCount - left.activeEtfCount
        || Math.abs(right.adjustedActiveLots) - Math.abs(left.adjustedActiveLots);
    })
    .slice(0, 3);
  const coverageLabel = coverage && coverage.trackedCount > 0
    ? `${coverage.availableCount}/${coverage.trackedCount} 檔 ETF 已更新`
    : "ETF 涵蓋未知";

  return {
    selectedDate,
    coverageLabel,
    candidates,
    readiness: [
      { label: "忠實四榜", status: "missing", detail: "需最近 4 個完整交易日與四榜各 Top 10；首頁當日快照不冒充完整榜。" },
      { label: "ETF 流量校正", status: candidates.length ? "ready" : "partial", detail: "只納入 activeDiffLots 可計算的 ETF；缺流通單位時不回填原始張數。" },
      { label: "投信獨立因子", status: "partial", detail: "目前只有單日投信買賣超，不足以計算 Institution_35。" },
      { label: "拉力／交易閘門", status: "missing", detail: "拉力、基本面、技術面與報酬風險比未齊，不產生可交易分或買進結論。" }
    ]
  };
}

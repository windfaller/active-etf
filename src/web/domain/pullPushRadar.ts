import type { EtfCoverageResponse, StockImpact } from "../contracts/dashboard.js";

export type CrossSourceState = "aligned" | "divergent" | "missing";

export interface PullPushPreviewCandidate {
  stockId: string;
  stockName: string;
  pullSignals: string[];
  marketChangePercent: number | null;
  adjustedActiveLots: number;
  activeEtfCount: number;
  issuerCount: number;
  investmentTrustNetShares: number | null;
  crossSourceState: CrossSourceState;
  statusLabel: "ETF 與投信同向" | "ETF 加碼、投信賣超" | "ETF 加碼觀察";
}

export interface PullPushPreview {
  selectedDate: string;
  coverageLabel: string;
  candidates: PullPushPreviewCandidate[];
}

function candidateForImpact(
  row: StockImpact,
  issuerByEtf: ReadonlyMap<string, string>
): PullPushPreviewCandidate | null {
  const adjustedRows = row.etfs.filter((item) => item.activeDiffLots !== null);
  const positiveRows = adjustedRows.filter((item) => (item.activeDiffLots ?? 0) > 0);
  const adjustedActiveLots = adjustedRows.reduce((sum, item) => sum + (item.activeDiffLots ?? 0), 0);
  if (adjustedActiveLots <= 0 || positiveRows.length === 0) return null;

  const issuers = new Set(positiveRows.map((item) => issuerByEtf.get(item.etfCode)).filter((value): value is string => Boolean(value)));
  const investmentTrustNetShares = row.institutional?.investmentTrustNetShares ?? null;
  const crossSourceState: CrossSourceState = investmentTrustNetShares === null || investmentTrustNetShares === 0
    ? "missing"
    : investmentTrustNetShares > 0
      ? "aligned"
      : "divergent";
  return {
    stockId: row.stockId,
    stockName: row.stockName,
    pullSignals: [...new Set([row.sector, ...row.themeTags].filter((value) => value && value !== "其他" && value !== "未分類"))].slice(0, 3),
    marketChangePercent: row.market?.changePercent ?? null,
    adjustedActiveLots,
    activeEtfCount: positiveRows.length,
    issuerCount: issuers.size,
    investmentTrustNetShares,
    crossSourceState,
    statusLabel: crossSourceState === "aligned" && positiveRows.length >= 2 && issuers.size >= 2
      ? "ETF 與投信同向"
      : crossSourceState === "divergent"
        ? "ETF 加碼、投信賣超"
        : "ETF 加碼觀察"
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
    candidates
  };
}

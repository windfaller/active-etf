import type { EtfCoverageResponse, SectorSummaryRow, StockImpact } from "../contracts/dashboard.js";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  label: "高" | "中" | "低";
  explanation: string;
}

export interface DailyInsight {
  id: string;
  title: string;
  description: string;
  tone: "increase" | "decrease" | "divergence" | "neutral";
}

export interface DailyBriefResult {
  confidence: ConfidenceResult;
  insights: DailyInsight[];
  additions: StockImpact[];
  reductions: StockImpact[];
  sectors: SectorSummaryRow[];
  latestUpdatedAt: string | null;
}

export interface DirectionAgreement {
  sameDirectionCount: number;
  oppositeDirectionCount: number;
  ratio: number;
  isConsensus: boolean;
}

export function coverageConfidence(coverage: EtfCoverageResponse | null, sampleCount: number): ConfidenceResult {
  if (!coverage || coverage.trackedCount === 0 || sampleCount < 3) {
    return { level: "low", label: "低", explanation: "跨 ETF 結論樣本不足，或尚無完整涵蓋資料。" };
  }
  const ratio = coverage.availableCount / coverage.trackedCount;
  if (ratio >= 0.9 && coverage.staleCount <= 1) {
    return { level: "high", label: "高", explanation: "相關 ETF 幾乎全數更新，關鍵持股與規模資料完整。" };
  }
  if (ratio >= 0.65) {
    return { level: "medium", label: "中", explanation: "部分來源延遲或規模資料缺失，跨 ETF 結論需保留解讀。" };
  }
  return { level: "low", label: "低", explanation: "大量 ETF 尚未更新，或跨 ETF 結論樣本不足。" };
}

export function directionAgreement(row: StockImpact, direction: "increase" | "decrease"): DirectionAgreement {
  const sameDirectionCount = direction === "increase" ? row.increaseEtfCount : row.decreaseEtfCount;
  const oppositeDirectionCount = direction === "increase" ? row.decreaseEtfCount : row.increaseEtfCount;
  const ratio = row.etfCount > 0 ? sameDirectionCount / row.etfCount : 0;
  return {
    sameDirectionCount,
    oppositeDirectionCount,
    ratio,
    isConsensus: sameDirectionCount >= 2 && sameDirectionCount > oppositeDirectionCount && row.etfCount > 0 && ratio >= 0.6
  };
}

export function hasDirectionConsensus(row: StockImpact, direction: "increase" | "decrease"): boolean {
  return directionAgreement(row, direction).isConsensus;
}

function commonDirectionRows(rows: StockImpact[], direction: "increase" | "decrease"): StockImpact[] {
  return [...rows]
    .filter((row) => {
      const agreement = directionAgreement(row, direction);
      const activeDirectionMatches = direction === "increase" ? row.totalActiveDiffLots > 0 : row.totalActiveDiffLots < 0;
      return activeDirectionMatches && agreement.sameDirectionCount >= 2;
    })
    .sort((a, b) => {
      const aAgreement = directionAgreement(a, direction);
      const bAgreement = directionAgreement(b, direction);
      return bAgreement.ratio - aAgreement.ratio
        || bAgreement.sameDirectionCount - aAgreement.sameDirectionCount
        || Math.abs(b.totalActiveDiffLots) - Math.abs(a.totalActiveDiffLots);
    })
    .slice(0, 8);
}

export function buildDailyBrief(
  impacts: StockImpact[],
  sectorRows: SectorSummaryRow[],
  coverage: EtfCoverageResponse | null
): DailyBriefResult {
  const confidence = coverageConfidence(coverage, impacts.length);
  const additions = commonDirectionRows(impacts, "increase");
  const reductions = commonDirectionRows(impacts, "decrease");
  const sectors = [...sectorRows]
    .filter((row) => row.sector && row.sector !== "其他")
    .sort((a, b) => Math.abs(b.totalActiveDiffLots) - Math.abs(a.totalActiveDiffLots))
    .slice(0, 6);
  const latestUpdatedAt = coverage?.etfs
    .map((row) => row.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  if (confidence.level === "low") {
    return {
      confidence,
      additions,
      reductions,
      sectors,
      latestUpdatedAt,
      insights: [{
        id: "insufficient",
        title: "目前資料涵蓋不足",
        description: "目前僅反映已更新 ETF，尚不能視為完整市場方向；以下內容均為已更新樣本中的觀察。",
        tone: "neutral"
      }]
    };
  }

  const insights: DailyInsight[] = [];
  const leadSector = sectors[0];
  if (leadSector && leadSector.totalActiveDiffLots !== 0) {
    const direction = leadSector.totalActiveDiffLots > 0 ? "淨加碼" : "淨減碼";
    insights.push({
      id: "sector",
      title: `${leadSector.sector}為今日主要產業方向`,
      description: `${leadSector.etfCount} 檔 ETF 影響 ${leadSector.stockCount} 檔股票，規模校正後${direction} ${Math.abs(Math.round(leadSector.totalActiveDiffLots)).toLocaleString("zh-TW")} 張。`,
      tone: leadSector.totalActiveDiffLots > 0 ? "increase" : "decrease"
    });
  }

  const leadConsensus = additions[0] ?? reductions[0];
  if (leadConsensus) {
    const increasing = leadConsensus.totalActiveDiffLots > 0;
    const count = increasing ? leadConsensus.increaseEtfCount : leadConsensus.decreaseEtfCount;
    const isConsensus = hasDirectionConsensus(leadConsensus, increasing ? "increase" : "decrease");
    insights.push({
      id: isConsensus ? "consensus" : "common-action",
      title: isConsensus
        ? `${leadConsensus.stockId} ${leadConsensus.stockName}出現跨 ETF 共識`
        : `${leadConsensus.stockId} ${leadConsensus.stockName}出現多檔 ETF 共同${increasing ? "加碼" : "減碼"}`,
      description: `${count} 檔 ETF 同向${increasing ? "加碼" : "減碼"}，主動淨變動 ${Math.abs(Math.round(leadConsensus.totalActiveDiffLots)).toLocaleString("zh-TW")} 張；${isConsensus ? "同向占比與多數門檻皆已達標" : "尚未達到跨 ETF 共識門檻"}。`,
      tone: increasing ? "increase" : "decrease"
    });
  }

  const comparable = impacts
    .filter((row) => row.totalActiveDiffLots !== 0 && (row.institutional?.totalNetShares ?? 0) !== 0)
    .slice(0, 12);
  const divergent = comparable.filter((row) => Math.sign(row.totalActiveDiffLots) !== Math.sign(row.institutional?.totalNetShares ?? 0));
  if (comparable.length >= 3) {
    const isDivergent = divergent.length > comparable.length / 2;
    insights.push({
      id: "institutional",
      title: isDivergent ? "ETF 經理人與三大法人偏分歧" : "ETF 與三大法人方向偏一致",
      description: `可比 ${comparable.length} 檔重點個股中，${divergent.length} 檔出現方向分歧。三大法人為當日交易資料，與 ETF 揭露時點可能不同。`,
      tone: isDivergent ? "divergence" : "neutral"
    });
  }

  if (confidence.level === "medium") {
    if (insights.length < 3) {
      insights.push({ id: "coverage", title: `訊號可信度：${confidence.label}`, description: confidence.explanation, tone: "neutral" });
    }
    for (const insight of insights) {
      if (!insight.description.includes(confidence.explanation)) {
        insight.description = `涵蓋限制：${confidence.explanation} ${insight.description}`;
      }
    }
  }

  return { confidence, insights: insights.slice(0, 3), additions, reductions, sectors, latestUpdatedAt };
}

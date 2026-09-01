import type {
  GlobalEtfDailyReport,
  GlobalEtfHolding,
  GlobalEtfHoldingChange,
  GlobalEtfReportSection
} from "../../models/GlobalEtf.js";

export type GlobalEtfWebHolding = Pick<
  GlobalEtfHolding,
  "ticker" | "name" | "weightPercent" | "marketValue" | "sector" | "assetType" | "exposureComponents"
>;

export type GlobalEtfWebChange = Pick<
  GlobalEtfHoldingChange,
  "etfCode" | "positionKey" | "ticker" | "name" | "currentWeightPercent" | "prevWeightPercent" | "deltaPp" | "status"
>;

export type GlobalEtfWebSection = Pick<
  GlobalEtfReportSection,
  | "etfCode"
  | "fundName"
  | "issuer"
  | "strategyType"
  | "sourceAsOf"
  | "filedAt"
  | "capturedAt"
  | "sourceUrl"
  | "sourceStatus"
  | "rowCount"
> & {
  topHoldings: GlobalEtfWebHolding[];
  weightChanges: GlobalEtfWebChange[];
};

export interface GlobalEtfWebCommonHolding {
  ticker?: string;
  name: string;
  etfs: Array<{ code: string; weight: number }>;
  total: number;
  max: number;
}

export interface GlobalEtfWebCommonWeightChange {
  ticker?: string;
  name: string;
  etfs: string[];
  delta: number;
}

export interface GlobalEtfWebReport {
  reportDate: string;
  coveredEtfs: string[];
  successCount: number;
  totalCount: number;
  highlights: string[];
  statusRows: GlobalEtfDailyReport["statusRows"];
  commonHoldings: GlobalEtfWebCommonHolding[];
  commonWeightChanges: GlobalEtfWebCommonWeightChange[];
  sections: GlobalEtfWebSection[];
  adContext: GlobalEtfDailyReport["adContext"];
  demoMode?: boolean;
}

function webHolding(holding: GlobalEtfHolding): GlobalEtfWebHolding {
  return {
    ticker: holding.ticker,
    name: holding.name,
    weightPercent: holding.weightPercent,
    marketValue: holding.marketValue,
    sector: holding.sector,
    assetType: holding.assetType,
    exposureComponents: holding.exposureComponents
  };
}

function webChange(change: GlobalEtfHoldingChange): GlobalEtfWebChange {
  return {
    etfCode: change.etfCode,
    positionKey: change.positionKey,
    ticker: change.ticker,
    name: change.name,
    currentWeightPercent: change.currentWeightPercent,
    prevWeightPercent: change.prevWeightPercent,
    deltaPp: change.deltaPp,
    status: change.status
  };
}

function commonHoldings(sections: GlobalEtfWebSection[]): GlobalEtfWebCommonHolding[] {
  const rows = new Map<string, GlobalEtfWebCommonHolding>();
  for (const section of sections.filter((row) => row.strategyType !== "13f")) {
    for (const holding of section.topHoldings) {
      const key = holding.ticker ?? holding.name;
      const weight = holding.weightPercent ?? 0;
      const current = rows.get(key) ?? { ticker: holding.ticker, name: holding.name, etfs: [], total: 0, max: 0 };
      current.etfs.push({ code: section.etfCode, weight });
      current.total += weight;
      current.max = Math.max(current.max, weight);
      rows.set(key, current);
    }
  }
  return [...rows.values()].filter((row) => row.etfs.length >= 2)
    .sort((left, right) => right.etfs.length - left.etfs.length || right.total - left.total)
    .slice(0, 30);
}

function commonWeightChanges(sections: GlobalEtfWebSection[]): GlobalEtfWebCommonWeightChange[] {
  const rows = new Map<string, GlobalEtfWebCommonWeightChange>();
  for (const section of sections.filter((row) => row.strategyType !== "13f")) {
    for (const change of section.weightChanges) {
      const key = change.positionKey ?? change.ticker ?? change.name;
      const current = rows.get(key) ?? { ticker: change.ticker, name: change.name, etfs: [], delta: 0 };
      current.etfs.push(section.etfCode);
      current.delta += change.deltaPp ?? 0;
      rows.set(key, current);
    }
  }
  return [...rows.values()].filter((row) => row.etfs.length >= 2)
    .sort((left, right) => right.etfs.length - left.etfs.length || Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 24);
}

export function projectGlobalEtfWebReport(report: GlobalEtfDailyReport): GlobalEtfWebReport {
  const sections = report.sections.map((section) => ({
    etfCode: section.etfCode,
    fundName: section.fundName,
    issuer: section.issuer,
    strategyType: section.strategyType,
    sourceAsOf: section.sourceAsOf,
    filedAt: section.filedAt,
    capturedAt: section.capturedAt,
    sourceUrl: section.sourceUrl,
    sourceStatus: section.sourceStatus,
    rowCount: section.rowCount,
    topHoldings: section.topHoldings.map(webHolding),
    weightChanges: section.weightChanges.map(webChange)
  }));
  return {
    reportDate: report.reportDate,
    coveredEtfs: report.coveredEtfs,
    successCount: report.successCount,
    totalCount: report.totalCount,
    highlights: report.highlights,
    statusRows: report.statusRows,
    commonHoldings: commonHoldings(sections),
    commonWeightChanges: commonWeightChanges(sections),
    sections,
    adContext: report.adContext,
    demoMode: report.demoMode
  };
}

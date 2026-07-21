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

export interface GlobalEtfWebReport {
  reportDate: string;
  coveredEtfs: string[];
  successCount: number;
  totalCount: number;
  highlights: string[];
  statusRows: GlobalEtfDailyReport["statusRows"];
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

export function projectGlobalEtfWebReport(report: GlobalEtfDailyReport): GlobalEtfWebReport {
  return {
    reportDate: report.reportDate,
    coveredEtfs: report.coveredEtfs,
    successCount: report.successCount,
    totalCount: report.totalCount,
    highlights: report.highlights,
    statusRows: report.statusRows,
    sections: report.sections.map((section) => ({
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
    })),
    adContext: report.adContext,
    demoMode: report.demoMode
  };
}

export type PerformanceMarket = "tw" | "global";
export type PerformancePeriod = "d1" | "w1" | "m1" | "m3";

export interface PerformanceRow {
  market: PerformanceMarket;
  etfCode: string;
  fundName: string;
  issuer: string;
  currency: "TWD" | "USD";
  latestDate: string;
  latestPrice: number;
  priceSource: "market_price" | "nav" | "nasdaq_close";
  returns: Record<PerformancePeriod, number | null>;
  observations: number;
}

export interface PerformanceSection {
  market: PerformanceMarket;
  sourceName: string;
  sourceUrl: string;
  trackedCount: number;
  availableCount: number;
  unavailableCodes: string[];
  rows: PerformanceRow[];
}

export interface PerformanceResponse {
  generatedAt: string;
  requestedDate: string | null;
  periods: Array<{ key: PerformancePeriod; label: string; methodology: string }>;
  sections: Record<PerformanceMarket, PerformanceSection>;
  methodology: {
    returnType: string;
    dateAlignment: string;
    dividendTreatment: string;
    missingData: string;
  };
}

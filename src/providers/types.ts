import type { SourceFetchResult } from "../services/source/httpClient.js";

export type ProviderId =
  | "uniPresident"
  | "nomura"
  | "capital"
  | "ctbc"
  | "cathay"
  | "yuanta"
  | "taishin"
  | "jpmorgan"
  | "fh"
  | "first"
  | "allianz"
  | "mega";

export type ProviderImplementationStatus = "verified" | "pending_reverse_engineering";

export interface EtfInfo {
  etfCode: string;
  name: string;
  issuer: string;
  providerId: ProviderId;
  currency: "TWD" | "USD";
  enabled: boolean;
  implementationStatus: ProviderImplementationStatus;
  fundCode?: string;
  notes?: string;
}

export interface RawHoldingResponse {
  providerId: ProviderId;
  etfCode: string;
  tradeDate: string;
  dataType: "holdings" | "pcf";
  fetchResult: SourceFetchResult;
}

export interface RawSummaryResponse {
  providerId: ProviderId;
  etfCode: string;
  tradeDate: string;
  dataType: "summary" | "pcf";
  fetchResult: SourceFetchResult;
}

export interface NormalizedHolding {
  etfCode: string;
  tradeDate: string;
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
  sourceProvider: ProviderId;
}

export interface NormalizedSummary {
  etfCode: string;
  tradeDate: string;
  nav: number | null;
  marketPrice: number | null;
  premiumDiscount: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits?: number | null;
  cashRatio?: number | null;
  stockRatio?: number | null;
  sourceProvider: ProviderId;
}

export interface EtfProvider {
  readonly providerId: ProviderId;
  readonly implementationStatus: ProviderImplementationStatus;
  getEtfList(): Promise<EtfInfo[]>;
  fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse>;
  fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse>;
  normalizeHoldings(raw: RawHoldingResponse): NormalizedHolding[];
  normalizeSummary(raw: RawSummaryResponse): NormalizedSummary;
}

export class ProviderEndpointNotVerifiedError extends Error {
  constructor(providerId: ProviderId, etfCode: string, dataType: string) {
    super(`${providerId} ${etfCode} ${dataType} endpoint is not reverse-engineered yet`);
    this.name = "ProviderEndpointNotVerifiedError";
  }
}

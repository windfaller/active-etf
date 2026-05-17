import {
  ProviderEndpointNotVerifiedError,
  type EtfInfo,
  type EtfProvider,
  type NormalizedHolding,
  type NormalizedSummary,
  type ProviderId,
  type RawHoldingResponse,
  type RawSummaryResponse
} from "./types.js";

export function createPendingProvider(providerId: ProviderId, etfs: EtfInfo[]): EtfProvider {
  return {
    providerId,
    implementationStatus: "pending_reverse_engineering",
    async getEtfList() {
      return etfs;
    },
    async fetchDailyHoldings(etfCode: string): Promise<RawHoldingResponse> {
      throw new ProviderEndpointNotVerifiedError(providerId, etfCode, "holdings");
    },
    async fetchDailySummary(etfCode: string): Promise<RawSummaryResponse> {
      throw new ProviderEndpointNotVerifiedError(providerId, etfCode, "summary");
    },
    normalizeHoldings(): NormalizedHolding[] {
      throw new ProviderEndpointNotVerifiedError(providerId, "unknown", "holdings");
    },
    normalizeSummary(): NormalizedSummary {
      throw new ProviderEndpointNotVerifiedError(providerId, "unknown", "summary");
    }
  };
}

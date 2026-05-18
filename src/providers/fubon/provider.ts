import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeFubonHoldings, normalizeFubonSummary } from "./normalizer.js";
import { detectFubonTradeDate } from "./parser.js";
import { fubonEtfs } from "./types.js";

function buildFubonAssetsUrl(etfCode: string): string {
  const params = new URLSearchParams({ stkId: etfCode });
  return `https://websys.fsit.com.tw/FubonETF/Fund/Assets.aspx?${params.toString()}`;
}

async function fetchAssets(etfCode: string): Promise<RawHoldingResponse> {
  if (!fubonEtfs.some((item) => item.etfCode === etfCode)) {
    throw new Error(`Fubon ETF is not configured: ${etfCode}`);
  }

  const url = buildFubonAssetsUrl(etfCode);
  const fetchResult = await fetchSource({
    url,
    headers: {
      ...defaultCrawlerHeaders(url),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const detectedTradeDate = detectFubonTradeDate(fetchResult.rawBody);

  return {
    providerId: "fubon",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "holdings",
    fetchResult
  };
}

export const fubonProvider: EtfProvider = {
  providerId: "fubon",
  implementationStatus: "verified",
  async getEtfList() {
    return fubonEtfs;
  },
  async fetchDailyHoldings(etfCode: string, _tradeDate: string): Promise<RawHoldingResponse> {
    return fetchAssets(etfCode);
  },
  async fetchDailySummary(etfCode: string, _tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchAssets(etfCode);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeFubonHoldings,
  normalizeSummary: normalizeFubonSummary
};

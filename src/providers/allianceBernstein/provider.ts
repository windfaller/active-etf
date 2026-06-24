import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeAllianceBernsteinHoldings, normalizeAllianceBernsteinSummary } from "./normalizer.js";
import { detectAllianceBernsteinTradeDate } from "./parser.js";
import { allianceBernsteinEtfs } from "./types.js";

const apiBase = "https://webapi.alliancebernstein.com/v2/funds/tw/zh-tw/investor";

function fundCodeFor(etfCode: string): string {
  const etf = allianceBernsteinEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`AllianceBernstein ETF is not configured: ${etfCode}`);
  }

  return etf.fundCode;
}

function apiUrl(fundCode: string, endpoint: "holdings" | "basket"): string {
  return `${apiBase}/${fundCode}/${endpoint}`;
}

function pcfPageUrl(fundCode: string): string {
  return `https://www.abfunds.com.tw/zh-tw/etfs/pcf.${fundCode}.html`;
}

async function fetchJson(fundCode: string, endpoint: "holdings" | "basket"): Promise<SourceFetchResult> {
  return fetchSource({
    url: apiUrl(fundCode, endpoint),
    headers: {
      ...defaultCrawlerHeaders(pcfPageUrl(fundCode)),
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.abfunds.com.tw"
    }
  });
}

function combineFetchResults(holdings: SourceFetchResult, basket: SourceFetchResult): SourceFetchResult {
  return {
    ...holdings,
    rawContentType: "application/json",
    rawBody: JSON.stringify({
      holdings: JSON.parse(holdings.rawBody),
      basket: JSON.parse(basket.rawBody),
      sourceResponses: {
        holdings: {
          url: holdings.url,
          responseStatus: holdings.responseStatus,
          responseHeaders: holdings.responseHeaders,
          rawContentType: holdings.rawContentType
        },
        basket: {
          url: basket.url,
          responseStatus: basket.responseStatus,
          responseHeaders: basket.responseHeaders,
          rawContentType: basket.rawContentType
        }
      }
    })
  };
}

async function fetchPcf(etfCode: string): Promise<RawHoldingResponse> {
  const fundCode = fundCodeFor(etfCode);
  const [holdings, basket] = await Promise.all([fetchJson(fundCode, "holdings"), fetchJson(fundCode, "basket")]);
  const fetchResult = combineFetchResults(holdings, basket);
  const detectedTradeDate = detectAllianceBernsteinTradeDate(fetchResult.rawBody);

  return {
    providerId: "allianceBernstein",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

export const allianceBernsteinProvider: EtfProvider = {
  providerId: "allianceBernstein",
  implementationStatus: "verified",
  async getEtfList() {
    return allianceBernsteinEtfs;
  },
  async fetchDailyHoldings(etfCode: string, _tradeDate: string): Promise<RawHoldingResponse> {
    return fetchPcf(etfCode);
  },
  async fetchDailySummary(etfCode: string, _tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchPcf(etfCode);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeAllianceBernsteinHoldings,
  normalizeSummary: normalizeAllianceBernsteinSummary
};

import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeMegaHoldings, normalizeMegaSummary } from "./normalizer.js";
import { detectMegaTradeDate } from "./parser.js";
import { megaEtfs } from "./types.js";

const megaProductUrl = "https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx";

function buildMegaProductUrl(fundCode: string): string {
  const params = new URLSearchParams({ id: fundCode });
  return `${megaProductUrl}?${params.toString()}`;
}

function fundCodeFor(etfCode: string): string {
  const etf = megaEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`Mega ETF is not configured: ${etfCode}`);
  }

  return etf.fundCode;
}

async function fetchProduct(etfCode: string): Promise<RawHoldingResponse> {
  const url = buildMegaProductUrl(fundCodeFor(etfCode));
  const fetchResult = await fetchSource({
    url,
    headers: {
      ...defaultCrawlerHeaders(url),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const detectedTradeDate = detectMegaTradeDate(fetchResult.rawBody);

  return {
    providerId: "mega",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "holdings",
    fetchResult
  };
}

export const megaProvider: EtfProvider = {
  providerId: "mega",
  implementationStatus: "verified",
  async getEtfList() {
    return megaEtfs;
  },
  async fetchDailyHoldings(etfCode: string, _tradeDate: string): Promise<RawHoldingResponse> {
    return fetchProduct(etfCode);
  },
  async fetchDailySummary(etfCode: string, _tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchProduct(etfCode);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeMegaHoldings,
  normalizeSummary: normalizeMegaSummary
};

import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeKgiHoldings, normalizeKgiSummary } from "./normalizer.js";
import { detectKgiPcfTradeDate } from "./parser.js";
import { kgiEtfs } from "./types.js";

const redemptionUrl = "https://www.kgifund.com.tw/Fund/RedemptionVC";
const redemptionListUrl = "https://www.kgifund.com.tw/Fund/RedemptionList";

function toKgiQueryDate(tradeDate: string): string {
  const match = tradeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : tradeDate;
}

function getFundId(etfCode: string): string {
  const etf = kgiEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`KGI ETF is not configured: ${etfCode}`);
  }

  return etf.fundCode;
}

async function fetchRedemption(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  const fundId = getFundId(etfCode);
  const body = new URLSearchParams({ fundID: fundId, queryDate: toKgiQueryDate(tradeDate) }).toString();
  const fetchResult = await fetchSource({
    url: redemptionUrl,
    method: "POST",
    body,
    headers: {
      ...defaultCrawlerHeaders(redemptionListUrl),
      Accept: "text/html, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  const detectedTradeDate = detectKgiPcfTradeDate(fetchResult.rawBody);

  return {
    providerId: "kgi",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

export const kgiProvider: EtfProvider = {
  providerId: "kgi",
  implementationStatus: "verified",
  async getEtfList() {
    return kgiEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchRedemption(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchRedemption(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeKgiHoldings,
  normalizeSummary: normalizeKgiSummary
};

import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeTaishinHoldings, normalizeTaishinSummary } from "./normalizer.js";
import { detectTaishinPcfTradeDate } from "./parser.js";
import { taishinEtfs } from "./types.js";

function buildTaishinPcfUrl(etfCode: string, tradeDate: string): string {
  const params = new URLSearchParams({
    FundType: "ALL",
    DataDate: tradeDate
  });
  return `https://www.tsit.com.tw/ETF/Home/Pcf/${etfCode}?${params.toString()}`;
}

async function fetchPcf(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  const url = buildTaishinPcfUrl(etfCode, tradeDate);
  const fetchResult = await fetchSource({
    url,
    headers: {
      ...defaultCrawlerHeaders("https://www.tsit.com.tw/ETF/Home/Pcf"),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const detectedTradeDate = detectTaishinPcfTradeDate(fetchResult.rawBody);

  return {
    providerId: "taishin",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

export const taishinProvider: EtfProvider = {
  providerId: "taishin",
  implementationStatus: "verified",
  async getEtfList() {
    return taishinEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchPcf(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchPcf(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeTaishinHoldings,
  normalizeSummary: normalizeTaishinSummary
};

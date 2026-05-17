import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeNomuraHoldings, normalizeNomuraSummary } from "./normalizer.js";
import { detectNomuraFundAssetsTradeDate } from "./parser.js";
import { nomuraEtfs } from "./types.js";

const nomuraApiBase = "https://www.nomurafunds.com.tw/API/ETFAPI/api";

function toNomuraSearchDate(tradeDate: string): string {
  return new Date(`${tradeDate}T00:00:00.000Z`).toISOString();
}

async function fetchFundAssets(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  const url = `${nomuraApiBase}/Fund/GetFundAssets`;
  const referer = `https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=${etfCode}&tab=Shareholding`;
  const body = JSON.stringify({
    FundID: etfCode,
    SearchDate: toNomuraSearchDate(tradeDate)
  });
  const fetchResult = await fetchSource({
    url,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders(referer),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body
  });
  const detectedTradeDate = detectNomuraFundAssetsTradeDate(fetchResult.rawBody);

  return {
    providerId: "nomura",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "holdings",
    fetchResult
  };
}

export const nomuraProvider: EtfProvider = {
  providerId: "nomura",
  implementationStatus: "verified",
  async getEtfList() {
    return nomuraEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchFundAssets(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchFundAssets(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeNomuraHoldings,
  normalizeSummary: normalizeNomuraSummary
};

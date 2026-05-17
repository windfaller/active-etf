import { getConfiguredEtf } from "../../config/etfs.js";
import { EzmoneyClient } from "../../services/source/ezmoneyClient.js";
import { isoDateToRocDate } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeUniPresidentHoldings, normalizeUniPresidentSummary } from "./normalizer.js";
import { detectEzmoneyPcfTradeDate } from "./parser.js";
import { uniPresidentEtfs } from "./types.js";

async function fetchPcf(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  const etf = getConfiguredEtf(etfCode);
  if (!etf) {
    throw new Error(`ETF is not configured: ${etfCode}`);
  }

  const client = new EzmoneyClient();
  const fetchResult = await client.fetchPcfJson(etf, isoDateToRocDate(tradeDate), true);
  const detectedTradeDate = detectEzmoneyPcfTradeDate(fetchResult.rawBody);

  return {
    providerId: "uniPresident",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

async function fetchPcfSummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
  const raw = await fetchPcf(etfCode, tradeDate);
  return {
    ...raw,
    dataType: "pcf"
  };
}

export const uniPresidentProvider: EtfProvider = {
  providerId: "uniPresident",
  implementationStatus: "verified",
  async getEtfList() {
    return uniPresidentEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string) {
    return fetchPcf(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    return fetchPcfSummary(etfCode, tradeDate);
  },
  normalizeHoldings: normalizeUniPresidentHoldings,
  normalizeSummary: normalizeUniPresidentSummary
};

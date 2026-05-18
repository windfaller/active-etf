import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import { todayInTaipei } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeCtbcHoldings, normalizeCtbcSummary } from "./normalizer.js";
import { detectCtbcBuybackTradeDate, parseCtbcAuthToken } from "./parser.js";
import { ctbcEtfs } from "./types.js";

const ctbcApiBase = "https://www.ctbcinvestments.com.tw/API";
const bootstrapToken = "www.ctbcinvestments.com";

function fundIdForEtf(etfCode: string): string {
  const etf = ctbcEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`CTBC FID is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

async function getAuthToken(): Promise<string> {
  const params = new URLSearchParams({ token: bootstrapToken });
  const fetchResult = await fetchSource({
    url: `${ctbcApiBase}/home/AuthToken?${params.toString()}`,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders("https://www.ctbcinvestments.com.tw/"),
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://www.ctbcinvestments.com.tw"
    },
    body: "{}"
  });

  return parseCtbcAuthToken(fetchResult.rawBody);
}

async function requestBuyback(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const token = await getAuthToken();
  const params = new URLSearchParams({ token });
  const fetchResult = await fetchSource({
    url: `${ctbcApiBase}/etf/Buyback?${params.toString()}`,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders("https://www.ctbcinvestments.com.tw/ETF/Buyback"),
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://www.ctbcinvestments.com.tw"
    },
    body: JSON.stringify({
      FID: fundIdForEtf(etfCode),
      StartDate: queryDate
    })
  });
  const detectedTradeDate = detectCtbcBuybackTradeDate(fetchResult.rawBody);

  return {
    providerId: "ctbc",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

async function fetchBuyback(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  if (tradeDate === todayInTaipei()) {
    return requestBuyback(etfCode, tradeDate);
  }

  let queryDate = tradeDate;
  for (let attempts = 0; attempts < 7; attempts += 1) {
    const raw = await requestBuyback(etfCode, queryDate);
    if (raw.tradeDate === tradeDate) {
      return raw;
    }
    queryDate = addDays(queryDate, 1);
  }

  throw new Error(`CTBC Buyback API did not return requested tradeDate ${tradeDate} for ${etfCode}`);
}

export const ctbcProvider: EtfProvider = {
  providerId: "ctbc",
  implementationStatus: "verified",
  async getEtfList() {
    return ctbcEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchBuyback(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchBuyback(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeCtbcHoldings,
  normalizeSummary: normalizeCtbcSummary
};

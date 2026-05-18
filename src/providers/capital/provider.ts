import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import { todayInTaipei } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeCapitalHoldings, normalizeCapitalSummary } from "./normalizer.js";
import { detectCapitalBuybackTradeDate } from "./parser.js";
import { capitalEtfs } from "./types.js";

const capitalApiBase = "https://www.capitalfund.com.tw/CFWeb/api";

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function nextBusinessDay(date: string): string {
  let candidate = addDays(date, 1);
  while ([0, 6].includes(new Date(`${candidate}T00:00:00.000Z`).getUTCDay())) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function toCapitalDate(date: string): string {
  return date.replaceAll("-", "/");
}

function fundIdForEtf(etfCode: string): string {
  const etf = capitalEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`Capital fundId is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

async function requestBuyback(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const fundId = fundIdForEtf(etfCode);
  const url = `${capitalApiBase}/etf/buyback`;
  const referer = `https://www.capitalfund.com.tw/etf/product/detail/${fundId}/buyback`;
  const body = JSON.stringify({
    fundId,
    date: toCapitalDate(queryDate)
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
  const detectedTradeDate = detectCapitalBuybackTradeDate(fetchResult.rawBody);

  return {
    providerId: "capital",
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

  let queryDate = nextBusinessDay(tradeDate);
  for (let attempts = 0; attempts < 6; attempts += 1) {
    const raw = await requestBuyback(etfCode, queryDate);
    if (raw.tradeDate === tradeDate) {
      return raw;
    }
    queryDate = nextBusinessDay(queryDate);
  }

  throw new Error(`Capital buyback API did not return requested tradeDate ${tradeDate} for ${etfCode}`);
}

export const capitalProvider: EtfProvider = {
  providerId: "capital",
  implementationStatus: "verified",
  async getEtfList() {
    return capitalEtfs;
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
  normalizeHoldings: normalizeCapitalHoldings,
  normalizeSummary: normalizeCapitalSummary
};

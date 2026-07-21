import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "../../services/source/httpClient.js";
import { todayInTaipei } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeFirstHoldings, normalizeFirstSummary } from "./normalizer.js";
import { detectFirstPcfTradeDate } from "./parser.js";
import { firstEtfs } from "./types.js";

const firstApiBase = "https://www.fsitc.com.tw/WebAPI.aspx";

function productUrlForFundId(fundId: string): string {
  return `https://www.fsitc.com.tw/FundDetail.aspx?ID=${encodeURIComponent(fundId)}`;
}

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

function fundIdForEtf(etfCode: string): string {
  const etf = firstEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`First fundId is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

async function postFirstWebApi(endpoint: "Get_BuySellA" | "Get_hd", fundId: string, queryDate: string) {
  const productUrl = productUrlForFundId(fundId);
  return fetchSource({
    url: `${firstApiBase}/${endpoint}`,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders(productUrl),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json; charset=utf-8",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify({
      pStrFundID: fundId,
      pStrDate: queryDate
    })
  });
}

async function requestPcf(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const fundId = fundIdForEtf(etfCode);
  const productUrl = productUrlForFundId(fundId);
  const [summary, holdings] = await Promise.all([
    postFirstWebApi("Get_BuySellA", fundId, queryDate),
    postFirstWebApi("Get_hd", fundId, queryDate)
  ]);
  const rawBody = JSON.stringify({
    summary: JSON.parse(summary.rawBody),
    holdings: JSON.parse(holdings.rawBody)
  });
  const fetchResult: SourceFetchResult = {
    url: productUrl,
    method: "POST",
    requestHeaders: summary.requestHeaders,
    requestBody: JSON.stringify({
      summaryEndpoint: summary.url,
      holdingsEndpoint: holdings.url,
      pStrFundID: fundId,
      pStrDate: queryDate
    }),
    responseStatus: summary.responseStatus === 200 && holdings.responseStatus === 200 ? 200 : 502,
    responseHeaders: {
      summary: JSON.stringify(summary.responseHeaders),
      holdings: JSON.stringify(holdings.responseHeaders)
    },
    rawContentType: "application/json",
    rawBody
  };

  return {
    providerId: "first",
    etfCode,
    tradeDate: detectFirstPcfTradeDate(rawBody),
    dataType: "pcf",
    fetchResult
  };
}

async function fetchPcf(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  if (tradeDate === todayInTaipei()) {
    return requestPcf(etfCode, tradeDate);
  }

  let queryDate = nextBusinessDay(tradeDate);
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const raw = await requestPcf(etfCode, queryDate);
    if (raw.tradeDate === tradeDate) {
      return raw;
    }
    queryDate = nextBusinessDay(queryDate);
  }

  throw new Error(`First WebAPI did not return requested tradeDate ${tradeDate} for ${etfCode}`);
}

export const firstProvider: EtfProvider = {
  providerId: "first",
  implementationStatus: "verified",
  async getEtfList() {
    return firstEtfs;
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
  normalizeHoldings: normalizeFirstHoldings,
  normalizeSummary: normalizeFirstSummary
};

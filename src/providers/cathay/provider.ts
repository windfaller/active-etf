import { defaultCrawlerHeaders, type SourceFetchResult } from "../../services/source/httpClient.js";
import { addDaysIsoDate } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeCathayHoldings, normalizeCathaySummary } from "./normalizer.js";
import { detectCathayTradeDate } from "./parser.js";
import { cathayEtfs } from "./types.js";

const cathayApiBase = "https://cwapi.cathaysite.com.tw/api/ETF/DownloadETFWeightExcel";
const cathayReferer =
  "https://www.cathaysite.com.tw/ETF/purchase?code=EA&name=%E5%9C%8B%E6%B3%B0%E5%8F%B0%E8%82%A1%E5%8B%95%E8%83%BD%E9%AB%98%E6%81%AF%E4%B8%BB%E5%8B%95%E5%BC%8FETF%E5%9F%BA%E9%87%91";

function fundCodeForEtf(etfCode: string): string {
  const etf = cathayEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`Cathay fundCode is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

async function requestCathayWorkbook(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const fundCode = fundCodeForEtf(etfCode);
  const url = new URL(cathayApiBase);
  url.searchParams.set("FundCode", fundCode);
  url.searchParams.set("SearchDate", queryDate);
  const headers = {
    ...defaultCrawlerHeaders(cathayReferer),
    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "follow"
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const fetchResult: SourceFetchResult = {
    url: url.toString(),
    method: "GET",
    requestHeaders: headers,
    responseStatus: response.status,
    responseHeaders: Object.fromEntries(response.headers.entries()),
    rawContentType: response.headers.get("content-type") ?? "",
    rawBody: buffer.toString("base64")
  };

  return {
    providerId: "cathay",
    etfCode,
    tradeDate: detectCathayTradeDate(fetchResult.rawBody),
    dataType: "pcf",
    fetchResult
  };
}

async function fetchCathayWorkbook(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  let queryDate = tradeDate;
  const maxAttempts = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestCathayWorkbook(etfCode, queryDate);
    } catch (error) {
      lastError = error;
      queryDate = addDaysIsoDate(queryDate, -1);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const cathayProvider: EtfProvider = {
  providerId: "cathay",
  implementationStatus: "verified",
  async getEtfList() {
    return cathayEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchCathayWorkbook(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchCathayWorkbook(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeCathayHoldings,
  normalizeSummary: normalizeCathaySummary
};

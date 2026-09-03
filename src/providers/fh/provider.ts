import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "../../services/source/httpClient.js";
import { addDaysIsoDate } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeFhHoldings, normalizeFhSummary } from "./normalizer.js";
import { detectFhTradeDate } from "./parser.js";
import { fhEtfs } from "./types.js";

const fhBaseUrl = "https://www.fhtrust.com.tw";

function fhDetailUrl(fundId: string): string {
  return `${fhBaseUrl}/ETF/etf_detail/${fundId}`;
}

function fundIdForEtf(etfCode: string): string {
  const etf = fhEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`Fuh Hwa fundID is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

function toFhDate(value: string): string {
  return value.replace(/-/gu, "/");
}

function toFhPcfDate(value: string): string {
  return value.replace(/-/gu, "");
}

function nextBusinessDay(date: string): string {
  let candidate = addDaysIsoDate(date, 1);
  while ([0, 6].includes(new Date(`${candidate}T00:00:00.000Z`).getUTCDay())) {
    candidate = addDaysIsoDate(candidate, 1);
  }
  return candidate;
}

async function fetchFhJson(path: string, params: Record<string, string>, referer: string): Promise<SourceFetchResult> {
  const url = new URL(path, fhBaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return fetchSource({
    url: url.toString(),
    method: "GET",
    headers: {
      ...defaultCrawlerHeaders(referer),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
}

async function requestFhAssets(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const fundID = fundIdForEtf(etfCode);
  const referer = fhDetailUrl(fundID);
  const assets = await fetchFhJson("/api/assets", {
    fundID,
    qDate: toFhDate(queryDate)
  }, referer);

  let tradeDate: string;
  try {
    tradeDate = detectFhTradeDate(
      JSON.stringify({
        assets: JSON.parse(assets.rawBody),
        pcf: null
      })
    );
  } catch (error) {
    throw new Error(`Fuh Hwa assets response has no holdings for ${queryDate}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const pcf = await fetchFhJson("/api/ETFPcf", {
    fundID,
    pcfDate: toFhPcfDate(nextBusinessDay(tradeDate))
  }, referer);

  const rawBody = JSON.stringify({
    assets: JSON.parse(assets.rawBody),
    pcf: JSON.parse(pcf.rawBody)
  });

  const fetchResult: SourceFetchResult = {
    url: assets.url,
    method: "GET",
    requestHeaders: assets.requestHeaders,
    requestBody: JSON.stringify({
      assetsEndpoint: assets.url,
      pcfEndpoint: pcf.url
    }),
    responseStatus: assets.responseStatus === 200 && pcf.responseStatus === 200 ? 200 : 502,
    responseHeaders: {
      assets: JSON.stringify(assets.responseHeaders),
      pcf: JSON.stringify(pcf.responseHeaders)
    },
    rawContentType: "application/json",
    rawBody
  };

  return {
    providerId: "fh",
    etfCode,
    tradeDate,
    dataType: "pcf",
    fetchResult
  };
}

async function fetchFhPcf(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  let queryDate = tradeDate;
  const maxAttempts = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestFhAssets(etfCode, queryDate);
    } catch (error) {
      lastError = error;
      queryDate = addDaysIsoDate(queryDate, -1);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const fhProvider: EtfProvider = {
  providerId: "fh",
  implementationStatus: "verified",
  async getEtfList() {
    return fhEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchFhPcf(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchFhPcf(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeFhHoldings,
  normalizeSummary: normalizeFhSummary
};

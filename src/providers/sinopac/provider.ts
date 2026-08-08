import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import { todayInTaipei } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeSinopacHoldings, normalizeSinopacSummary } from "./normalizer.js";
import { detectSinopacPcfTradeDate } from "./parser.js";
import { sinopacEtfs } from "./types.js";

const pcfBaseUrl = "https://sitc.sinopac.com/SinopacEtfs/Etfs/Pcf";

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

function assertConfigured(etfCode: string): void {
  if (!sinopacEtfs.some((etf) => etf.etfCode === etfCode)) {
    throw new Error(`SinoPac ETF is not configured: ${etfCode}`);
  }
}

async function requestPcf(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  assertConfigured(etfCode);
  const url = `${pcfBaseUrl}/${encodeURIComponent(etfCode)}`;
  const body = new URLSearchParams({ fundId: etfCode, hDate: queryDate, op: "1" }).toString();
  const fetchResult = await fetchSource({
    url,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders(`${pcfBaseUrl}/${encodeURIComponent(etfCode)}`),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  return {
    providerId: "sinopac",
    etfCode,
    tradeDate: detectSinopacPcfTradeDate(fetchResult.rawBody),
    dataType: "pcf",
    fetchResult
  };
}

async function fetchPcf(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  let queryDate = tradeDate;
  for (let attempts = 0; attempts < 8; attempts += 1) {
    const raw = await requestPcf(etfCode, queryDate);
    if (raw.tradeDate === tradeDate || tradeDate === todayInTaipei()) return raw;
    queryDate = nextBusinessDay(queryDate);
  }
  throw new Error(`SinoPac PCF did not return requested tradeDate ${tradeDate} for ${etfCode}`);
}

export const sinopacProvider: EtfProvider = {
  providerId: "sinopac",
  implementationStatus: "verified",
  async getEtfList() {
    return sinopacEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchPcf(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    return { ...(await fetchPcf(etfCode, tradeDate)), dataType: "summary" };
  },
  normalizeHoldings: normalizeSinopacHoldings,
  normalizeSummary: normalizeSinopacSummary
};

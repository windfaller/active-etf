import type { SourceFetchResult } from "../../services/source/httpClient.js";
import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import { addDaysIsoDate, todayInTaipei } from "../../utils/date.js";
import { withRetry } from "../../utils/retry.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeAllianzHoldings, normalizeAllianzSummary } from "./normalizer.js";
import { detectAllianzTradeDate } from "./parser.js";
import { allianzEtfs } from "./types.js";

const allianzOrigin = "https://etf.allianzgi.com.tw";
const apiBase = `${allianzOrigin}/webapi/api`;

function fundNoForEtf(etfCode: string): string {
  const etf = allianzEtfs.find((item) => item.etfCode === etfCode);
  if (!etf?.fundCode) {
    throw new Error(`Allianz FundNo is not configured for ${etfCode}`);
  }

  return etf.fundCode;
}

function nextBusinessDay(date: string): string {
  let candidate = addDaysIsoDate(date, 1);
  while ([0, 6].includes(new Date(`${candidate}T00:00:00.000Z`).getUTCDay())) {
    candidate = addDaysIsoDate(candidate, 1);
  }
  return candidate;
}

function toAllianzDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function splitSetCookieHeader(value: string): string[] {
  return value.split(/,(?=\s*[^;,\s]+=)/u).map((item) => item.trim());
}

function cookieHeaderFromSetCookies(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie ? getSetCookie.call(headers) : splitSetCookieHeader(headers.get("set-cookie") ?? "");

  return setCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function getAntiForgerySession(): Promise<{ token: string; cookie: string }> {
  return withRetry(async () => {
    const response = await fetch(`${apiBase}/AntiForgery/GetAntiForgeryToken`, {
      method: "GET",
      headers: {
        ...defaultCrawlerHeaders(`${allianzOrigin}/list-trade`),
        Accept: "application/json"
      },
      redirect: "follow"
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Allianz anti-forgery request failed: ${response.status} ${rawBody.slice(0, 120)}`);
    }

    const parsed = JSON.parse(rawBody) as { token?: string };
    if (!parsed.token) {
      throw new Error("Allianz anti-forgery response did not include token");
    }

    return {
      token: parsed.token,
      cookie: cookieHeaderFromSetCookies(response.headers)
    };
  });
}

async function requestTradeInfo(etfCode: string, queryDate: string): Promise<RawHoldingResponse> {
  const session = await getAntiForgerySession();
  const body = JSON.stringify({
    FundNo: fundNoForEtf(etfCode),
    Date: toAllianzDate(queryDate)
  });
  const fetchResult: SourceFetchResult = await fetchSource({
    url: `${apiBase}/Fund/GetFundTradeInfo`,
    method: "POST",
    headers: {
      ...defaultCrawlerHeaders(`${allianzOrigin}/list-trade`),
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": session.token,
      Cookie: session.cookie
    },
    body
  });
  const tradeDate = detectAllianzTradeDate(fetchResult.rawBody);

  return {
    providerId: "allianz",
    etfCode,
    tradeDate,
    dataType: "pcf",
    fetchResult
  };
}

async function fetchTradeInfo(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  if (tradeDate === todayInTaipei()) {
    return requestTradeInfo(etfCode, tradeDate);
  }

  let queryDate = nextBusinessDay(tradeDate);
  for (let attempts = 0; attempts < 7; attempts += 1) {
    const raw = await requestTradeInfo(etfCode, queryDate);
    if (raw.tradeDate === tradeDate) {
      return raw;
    }
    queryDate = nextBusinessDay(queryDate);
  }

  throw new Error(`Allianz GetFundTradeInfo did not return requested tradeDate ${tradeDate} for ${etfCode}`);
}

export const allianzProvider: EtfProvider = {
  providerId: "allianz",
  implementationStatus: "verified",
  async getEtfList() {
    return allianzEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchTradeInfo(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchTradeInfo(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeAllianzHoldings,
  normalizeSummary: normalizeAllianzSummary
};

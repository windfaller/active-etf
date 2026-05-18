import type { SourceFetchResult } from "../../services/source/httpClient.js";
import { defaultCrawlerHeaders } from "../../services/source/httpClient.js";
import { withRetry } from "../../utils/retry.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeJpmorganHoldings, normalizeJpmorganSummary } from "./normalizer.js";
import { detectJpmorganPcfTradeDate } from "./parser.js";
import { jpmorganEtfs } from "./types.js";

const productUrl =
  "https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-TW00000401A1";

const pcfXlsxUrl =
  "https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx";

async function fetchXlsx(url: string): Promise<SourceFetchResult> {
  const method = "GET" as const;
  const headers = {
    ...defaultCrawlerHeaders(productUrl),
    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin"
  };

  return withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.CRAWLER_TIMEOUT_MS ?? 30000));

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        redirect: "follow"
      });
      const body = Buffer.from(await response.arrayBuffer());
      const textPreview = body.subarray(0, 80).toString("utf8");

      if (!response.ok || body.length < 4 || body.readUInt32LE(0) !== 0x04034b50) {
        throw new Error(`JPMorgan PCF XLSX request failed: ${response.status} ${textPreview}`);
      }

      return {
        url,
        method,
        requestHeaders: headers,
        responseStatus: response.status,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        rawContentType: response.headers.get("content-type") ?? "",
        rawBody: body.toString("base64")
      };
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function fetchPcf(etfCode: string): Promise<RawHoldingResponse> {
  const fetchResult = await fetchXlsx(pcfXlsxUrl);
  const tradeDate = detectJpmorganPcfTradeDate(fetchResult.rawBody);

  return {
    providerId: "jpmorgan",
    etfCode,
    tradeDate,
    dataType: "pcf",
    fetchResult
  };
}

export const jpmorganProvider: EtfProvider = {
  providerId: "jpmorgan",
  implementationStatus: "verified",
  async getEtfList() {
    return jpmorganEtfs;
  },
  async fetchDailyHoldings(etfCode: string): Promise<RawHoldingResponse> {
    return fetchPcf(etfCode);
  },
  async fetchDailySummary(etfCode: string): Promise<RawSummaryResponse> {
    const raw = await fetchPcf(etfCode);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeJpmorganHoldings,
  normalizeSummary: normalizeJpmorganSummary
};

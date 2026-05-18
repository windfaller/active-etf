import { defaultCrawlerHeaders, fetchSource } from "../../services/source/httpClient.js";
import { todayInTaipei } from "../../utils/date.js";
import type { EtfProvider, RawHoldingResponse, RawSummaryResponse } from "../types.js";
import { normalizeYuantaHoldings, normalizeYuantaSummary } from "./normalizer.js";
import { detectYuantaPcfTradeDate } from "./parser.js";
import { yuantaEtfs } from "./types.js";

const yuantaBridgeUrl = "https://etfapi.yuantaetfs.com/ectranslation/api/bridge";

function toYuantaDate(tradeDate: string): string {
  return tradeDate.replaceAll("-", "");
}

async function fetchPcfDaily(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
  const params = new URLSearchParams({
    APIType: "ETFAPI",
    CompanyName: "YUANTAFUNDS",
    PageName: `/tradeInfo/pcf/${etfCode}`,
    DeviceId: "null",
    FuncId: "PCF/Daily",
    AppName: "ETF",
    Device: "3",
    Platform: "ETF",
    ticker: etfCode
  });

  if (tradeDate !== todayInTaipei()) {
    params.set("ndate", toYuantaDate(tradeDate));
  }

  const url = `${yuantaBridgeUrl}?${params.toString()}`;
  const referer = `https://www.yuantaetfs.com/tradeInfo/pcf/${etfCode}`;
  const fetchResult = await fetchSource({
    url,
    headers: {
      ...defaultCrawlerHeaders(referer),
      Accept: "application/json",
      Origin: "https://www.yuantaetfs.com"
    }
  });
  const detectedTradeDate = detectYuantaPcfTradeDate(fetchResult.rawBody);

  return {
    providerId: "yuanta",
    etfCode,
    tradeDate: detectedTradeDate,
    dataType: "pcf",
    fetchResult
  };
}

export const yuantaProvider: EtfProvider = {
  providerId: "yuanta",
  implementationStatus: "verified",
  async getEtfList() {
    return yuantaEtfs;
  },
  async fetchDailyHoldings(etfCode: string, tradeDate: string): Promise<RawHoldingResponse> {
    return fetchPcfDaily(etfCode, tradeDate);
  },
  async fetchDailySummary(etfCode: string, tradeDate: string): Promise<RawSummaryResponse> {
    const raw = await fetchPcfDaily(etfCode, tradeDate);
    return {
      ...raw,
      dataType: "summary"
    };
  },
  normalizeHoldings: normalizeYuantaHoldings,
  normalizeSummary: normalizeYuantaSummary
};

import type { EtfMaster } from "../../models/EtfMaster.js";
import { todayRocInTaipei } from "../../utils/date.js";
import { defaultCrawlerHeaders, fetchSource, type SourceFetchResult } from "./httpClient.js";

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function cookieFromSetCookie(setCookie: string | null): string | undefined {
  return setCookie?.split(";")[0];
}

export class EzmoneyClient {
  async fetchInfoPage(etf: EtfMaster): Promise<SourceFetchResult> {
    if (!etf.source.infoUrl) {
      throw new Error(`Missing infoUrl for ${etf.etfCode}`);
    }

    return fetchSource({ url: etf.source.infoUrl });
  }

  async fetchPcfPage(etf: EtfMaster): Promise<SourceFetchResult> {
    if (!etf.source.pcfUrl) {
      throw new Error(`Missing pcfUrl for ${etf.etfCode}`);
    }

    return fetchSource({ url: etf.source.pcfUrl });
  }

  async fetchUnitMarketRatioPage(etf: EtfMaster): Promise<SourceFetchResult> {
    if (!etf.source.unitMarketRatioUrl) {
      throw new Error(`Missing unitMarketRatioUrl for ${etf.etfCode}`);
    }

    return fetchSource({ url: etf.source.unitMarketRatioUrl });
  }

  async fetchPcfJson(
    etf: EtfMaster,
    date = todayRocInTaipei(),
    specificDate = false
  ): Promise<SourceFetchResult> {
    const url = "https://www.ezmoney.com.tw/ETF/Transaction/GetPCF";
    const body = JSON.stringify({
      fundCode: etf.fundCode,
      date,
      specificDate
    });
    const headers = {
      ...defaultCrawlerHeaders(etf.source.pcfUrl),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    };

    const first = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual"
    });
    const cookie = cookieFromSetCookie(first.headers.get("set-cookie"));
    const response =
      first.status === 307 && cookie
        ? await fetch(url, {
            method: "POST",
            headers: {
              ...headers,
              Cookie: cookie
            },
            body,
            redirect: "follow"
          })
        : first;

    return {
      url,
      method: "POST",
      requestHeaders: cookie ? { ...headers, Cookie: cookie } : headers,
      requestBody: body,
      responseStatus: response.status,
      responseHeaders: headersToRecord(response.headers),
      rawContentType: response.headers.get("content-type") ?? "",
      rawBody: await response.text()
    };
  }
}

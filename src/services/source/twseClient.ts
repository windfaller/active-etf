import { fetchSource, type SourceFetchResult } from "./httpClient.js";

export class TwseClient {
  async fetchEtfInfo(etfCode: string): Promise<SourceFetchResult> {
    return fetchSource({
      url: `https://www.twse.com.tw/zh/ETFortune/etfInfo/${encodeURIComponent(etfCode)}`
    });
  }
}

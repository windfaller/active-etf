import { fetchSource, type SourceFetchResult } from "./httpClient.js";

export class BackupWantgooClient {
  async fetchConstituentPage(etfCode: string): Promise<SourceFetchResult> {
    return fetchSource({
      url: `https://www.wantgoo.com/stock/etf/${encodeURIComponent(etfCode.toLowerCase())}/constituent`
    });
  }
}

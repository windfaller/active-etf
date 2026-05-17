import { fetchSource, type SourceFetchResult } from "./httpClient.js";

export class BackupMoneyDjClient {
  async fetchHoldingPage(etfCode: string): Promise<SourceFetchResult> {
    return fetchSource({
      url: `https://www.moneydj.com/etf/x/basic/basic0007.xdjhtm?etfid=${encodeURIComponent(
        etfCode.toLowerCase()
      )}.tw`
    });
  }
}

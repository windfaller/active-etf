import { assertTradeDate } from "../../utils/date.js";
import { fetchSource, type SourceFetchResult } from "./httpClient.js";

function twseDate(value: string): string {
  return assertTradeDate(value).replace(/-/gu, "");
}

function slashDate(value: string): string {
  return assertTradeDate(value).replace(/-/gu, "/");
}

export class MarketDataClient {
  async fetchTwseDailyQuotes(tradeDate: string): Promise<SourceFetchResult> {
    const params = new URLSearchParams({
      date: twseDate(tradeDate),
      type: "ALLBUT0999",
      response: "json"
    });

    return fetchSource({
      url: `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?${params.toString()}`,
      headers: {
        Referer: "https://www.twse.com.tw/zh/trading/historical/mi-index.html"
      }
    });
  }

  async fetchTwseInstitutionalFlows(tradeDate: string): Promise<SourceFetchResult> {
    const params = new URLSearchParams({
      date: twseDate(tradeDate),
      selectType: "ALLBUT0999",
      response: "json"
    });

    return fetchSource({
      url: `https://www.twse.com.tw/rwd/zh/fund/T86?${params.toString()}`,
      headers: {
        Referer: "https://www.twse.com.tw/zh/trading/foreign/t86.html"
      }
    });
  }

  async fetchTpexDailyQuotes(tradeDate: string): Promise<SourceFetchResult> {
    const params = new URLSearchParams({
      date: slashDate(tradeDate),
      type: "EW",
      response: "json"
    });

    return fetchSource({
      url: `https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?${params.toString()}`,
      headers: {
        Referer: "https://www.tpex.org.tw/www/zh-tw/afterTrading/otc"
      }
    });
  }

  async fetchTpexInstitutionalFlows(tradeDate: string): Promise<SourceFetchResult> {
    const params = new URLSearchParams({
      date: slashDate(tradeDate),
      type: "Daily",
      response: "json"
    });

    return fetchSource({
      url: `https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade?${params.toString()}`,
      headers: {
        Referer: "https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade"
      }
    });
  }
}

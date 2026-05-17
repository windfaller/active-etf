import { fetchSource, type SourceFetchResult } from "./httpClient.js";

function stockDayMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/u.exec(value);
  if (!match) {
    throw new Error(`Invalid tradeDate: ${value}`);
  }

  return `${match[1]}${match[2]}01`;
}

export class TwseClient {
  async fetchEtfInfo(etfCode: string): Promise<SourceFetchResult> {
    return fetchSource({
      url: `https://www.twse.com.tw/zh/ETFortune/etfInfo/${encodeURIComponent(etfCode)}`
    });
  }

  async fetchStockDay(etfCode: string, tradeDate: string): Promise<SourceFetchResult> {
    const params = new URLSearchParams({
      response: "json",
      date: stockDayMonth(tradeDate),
      stockNo: etfCode
    });

    return fetchSource({
      url: `https://www.twse.com.tw/exchangeReport/STOCK_DAY?${params.toString()}`,
      headers: {
        Referer: "https://www.twse.com.tw/zh/trading/historical/stock-day.html"
      }
    });
  }
}

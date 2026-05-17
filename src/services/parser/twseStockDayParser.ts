import { rocDateToIsoDate } from "../../utils/date.js";

export interface TwseClosingPrice {
  tradeDate: string;
  closePrice: number;
}

interface TwseStockDayResponse {
  stat?: string;
  fields?: string[];
  data?: string[][];
}

function parseTwseNumber(value: string): number {
  const normalized = value.replace(/,/gu, "").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid TWSE number: ${value}`);
  }
  return parsed;
}

export function parseTwseStockDayClosingPrice(rawBody: string, tradeDate: string): TwseClosingPrice {
  const parsed = JSON.parse(rawBody) as TwseStockDayResponse;
  if (parsed.stat !== "OK") {
    throw new Error(`TWSE STOCK_DAY response is not OK: ${parsed.stat ?? "unknown"}`);
  }

  const fields = parsed.fields ?? [];
  const dateIndex = fields.indexOf("日期");
  const closeIndex = fields.indexOf("收盤價");
  if (dateIndex < 0 || closeIndex < 0) {
    throw new Error("TWSE STOCK_DAY response is missing 日期 or 收盤價 field");
  }

  const row = (parsed.data ?? []).find((item) => rocDateToIsoDate(item[dateIndex] ?? "") === tradeDate);
  if (!row) {
    throw new Error(`TWSE STOCK_DAY response has no row for ${tradeDate}`);
  }

  return {
    tradeDate,
    closePrice: parseTwseNumber(row[closeIndex] ?? "")
  };
}

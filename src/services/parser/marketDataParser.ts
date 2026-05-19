import type { StockDailyMarket, StockMarket } from "../../models/StockDailyMarket.js";
import type { StockInstitutionalFlow } from "../../models/StockInstitutionalFlow.js";
import { round } from "../../utils/number.js";

interface TwseTable {
  title?: string;
  fields?: string[];
  data?: unknown[][];
}

interface TwseMiIndexResponse {
  stat?: string;
  tables?: TwseTable[];
}

interface FlatTableResponse {
  stat?: string;
  fields?: string[];
  data?: unknown[][];
}

interface TpexTable {
  title?: string;
  fields?: string[];
  data?: unknown[][];
}

interface TpexResponse {
  stat?: string;
  tables?: TpexTable[];
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/gu, "")
    .trim();
}

function parseNumber(value: unknown): number | null {
  const normalized = stripHtml(value)
    .replace(/,/gu, "")
    .replace(/\u00a0/gu, "")
    .trim();
  if (!normalized || ["-", "--", "---", "----", "除息", "除權", "除權息"].includes(normalized)) return null;
  const parsed = Number(normalized.replace(/^\+/u, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function indexByField(fields: string[], target: string): number {
  const normalizedTarget = target.replace(/\s+/gu, "");
  return fields.findIndex((field) => field.replace(/<br>/giu, "").replace(/\s+/gu, "") === normalizedTarget);
}

function changePercent(closePrice: number | null, change: number | null): number | null {
  if (closePrice === null || change === null) return null;
  const previousClose = closePrice - change;
  if (previousClose === 0) return null;
  return round((change / previousClose) * 100, 2);
}

function rowValue(row: unknown[], index: number): unknown {
  return index >= 0 ? row[index] : undefined;
}

function parseMarketRows(
  market: StockMarket,
  tradeDate: string,
  fields: string[],
  rows: unknown[][],
  fieldMap: {
    stockId: string;
    stockName: string;
    volumeShares: string;
    transactionCount: string;
    turnover: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    change: string;
  },
  source: string
): StockDailyMarket[] {
  const indexes = Object.fromEntries(Object.entries(fieldMap).map(([key, field]) => [key, indexByField(fields, field)]));
  const now = new Date();
  const parsedRows: StockDailyMarket[] = [];

  for (const row of rows) {
    const stockId = stripHtml(rowValue(row, indexes.stockId));
    const stockName = stripHtml(rowValue(row, indexes.stockName));
    const closePrice = parseNumber(rowValue(row, indexes.closePrice));
    const change = parseNumber(rowValue(row, indexes.change));
    if (!stockId || !stockName || closePrice === null) continue;

    parsedRows.push({
      tradeDate,
      stockId,
      stockName,
      market,
      openPrice: parseNumber(rowValue(row, indexes.openPrice)),
      highPrice: parseNumber(rowValue(row, indexes.highPrice)),
      lowPrice: parseNumber(rowValue(row, indexes.lowPrice)),
      closePrice,
      change,
      changePercent: changePercent(closePrice, change),
      volumeShares: parseNumber(rowValue(row, indexes.volumeShares)),
      turnover: parseNumber(rowValue(row, indexes.turnover)),
      transactionCount: parseNumber(rowValue(row, indexes.transactionCount)),
      source,
      createdAt: now,
      updatedAt: now
    });
  }

  return parsedRows;
}

export function parseTwseDailyMarket(rawBody: string, tradeDate: string): StockDailyMarket[] {
  const parsed = JSON.parse(rawBody) as TwseMiIndexResponse;
  if (parsed.stat !== "OK") throw new Error(`TWSE MI_INDEX response is not OK: ${parsed.stat ?? "unknown"}`);

  const table = (parsed.tables ?? []).find(
    (item) => (item.fields ?? []).includes("證券代號") && (item.fields ?? []).includes("收盤價")
  );
  if (!table?.fields?.length) throw new Error("TWSE MI_INDEX response is missing stock quote table");

  return parseMarketRows(
    "TWSE",
    tradeDate,
    table.fields,
    table.data ?? [],
    {
      stockId: "證券代號",
      stockName: "證券名稱",
      volumeShares: "成交股數",
      transactionCount: "成交筆數",
      turnover: "成交金額",
      openPrice: "開盤價",
      highPrice: "最高價",
      lowPrice: "最低價",
      closePrice: "收盤價",
      change: "漲跌價差"
    },
    "twse_mi_index"
  );
}

export function parseTpexDailyMarket(rawBody: string, tradeDate: string): StockDailyMarket[] {
  const parsed = JSON.parse(rawBody) as TpexResponse;
  if (parsed.stat !== "ok") throw new Error(`TPEx daily quote response is not ok: ${parsed.stat ?? "unknown"}`);

  const table = (parsed.tables ?? []).find(
    (item) => (item.fields ?? []).some((field) => field.trim() === "代號") && (item.fields ?? []).some((field) => field.trim() === "收盤")
  );
  if (!table?.fields?.length) throw new Error("TPEx daily quote response is missing stock quote table");

  return parseMarketRows(
    "TPEx",
    tradeDate,
    table.fields,
    table.data ?? [],
    {
      stockId: "代號",
      stockName: "名稱",
      volumeShares: "成交股數",
      transactionCount: "成交筆數",
      turnover: "成交金額(元)",
      openPrice: "開盤",
      highPrice: "最高",
      lowPrice: "最低",
      closePrice: "收盤",
      change: "漲跌"
    },
    "tpex_after_trading_otc"
  );
}

function flowRow(
  market: StockMarket,
  tradeDate: string,
  row: unknown[],
  indexes: {
    stockId: number;
    stockName: number;
    foreignNetShares: number;
    investmentTrustNetShares: number;
    dealerNetShares: number;
    totalNetShares: number;
  },
  source: string
): StockInstitutionalFlow | null {
  const stockId = stripHtml(rowValue(row, indexes.stockId));
  const stockName = stripHtml(rowValue(row, indexes.stockName));
  if (!stockId || !stockName) return null;

  const now = new Date();
  return {
    tradeDate,
    stockId,
    stockName,
    market,
    foreignNetShares: parseNumber(rowValue(row, indexes.foreignNetShares)),
    investmentTrustNetShares: parseNumber(rowValue(row, indexes.investmentTrustNetShares)),
    dealerNetShares: parseNumber(rowValue(row, indexes.dealerNetShares)),
    totalNetShares: parseNumber(rowValue(row, indexes.totalNetShares)),
    source,
    createdAt: now,
    updatedAt: now
  };
}

export function parseTwseInstitutionalFlows(rawBody: string, tradeDate: string): StockInstitutionalFlow[] {
  const parsed = JSON.parse(rawBody) as FlatTableResponse;
  if (parsed.stat !== "OK") throw new Error(`TWSE T86 response is not OK: ${parsed.stat ?? "unknown"}`);

  const fields = parsed.fields ?? [];
  const foreignExDealerIndex = indexByField(fields, "外陸資買賣超股數(不含外資自營商)");
  const foreignDealerIndex = indexByField(fields, "外資自營商買賣超股數");
  const investmentIndex = indexByField(fields, "投信買賣超股數");
  const dealerIndex = indexByField(fields, "自營商買賣超股數");
  const totalIndex = indexByField(fields, "三大法人買賣超股數");
  const now = new Date();

  const rows: StockInstitutionalFlow[] = [];
  for (const row of parsed.data ?? []) {
    const stockId = stripHtml(rowValue(row, indexByField(fields, "證券代號")));
    const stockName = stripHtml(rowValue(row, indexByField(fields, "證券名稱")));
    if (!stockId || !stockName) continue;

    const foreignExDealer = parseNumber(rowValue(row, foreignExDealerIndex)) ?? 0;
    const foreignDealer = parseNumber(rowValue(row, foreignDealerIndex)) ?? 0;
    rows.push({
      tradeDate,
      stockId,
      stockName,
      market: "TWSE",
      foreignNetShares: foreignExDealer + foreignDealer,
      investmentTrustNetShares: parseNumber(rowValue(row, investmentIndex)),
      dealerNetShares: parseNumber(rowValue(row, dealerIndex)),
      totalNetShares: parseNumber(rowValue(row, totalIndex)),
      source: "twse_t86",
      createdAt: now,
      updatedAt: now
    });
  }

  return rows;
}

export function parseTpexInstitutionalFlows(rawBody: string, tradeDate: string): StockInstitutionalFlow[] {
  const parsed = JSON.parse(rawBody) as TpexResponse;
  if (parsed.stat !== "ok") throw new Error(`TPEx institutional response is not ok: ${parsed.stat ?? "unknown"}`);

  const table = (parsed.tables ?? []).find((item) => item.title === "三大法人買賣明細資訊");
  if (!table?.data?.length) throw new Error("TPEx institutional response is missing daily trade table");

  return table.data
    .map((row) =>
      flowRow(
        "TPEx",
        tradeDate,
        row,
        {
          stockId: 0,
          stockName: 1,
          foreignNetShares: 10,
          investmentTrustNetShares: 13,
          dealerNetShares: 22,
          totalNetShares: 23
        },
        "tpex_insti_daily_trade"
      )
    )
    .filter((row): row is StockInstitutionalFlow => row !== null);
}

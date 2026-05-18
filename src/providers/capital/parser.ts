import { z } from "zod";

const numberishSchema = z.union([z.number(), z.string(), z.null()]);

const capitalPcfSchema = z.object({
  date1: z.string(),
  date2: z.string(),
  nav: numberishSchema,
  totUnit: numberishSchema,
  disUnit: numberishSchema,
  pUnit: numberishSchema,
  totStock: numberishSchema.optional(),
  fundName: z.string().optional()
});

const capitalStockSchema = z.object({
  stocNo: z.string(),
  stocName: z.string(),
  weight: numberishSchema,
  share: numberishSchema,
  shareFormat: z.string().optional()
});

const capitalAssetSchema = z.object({
  asDesc: z.string(),
  asMoney: z.string()
});

const capitalBuybackResponseSchema = z.object({
  code: z.number(),
  data: z.object({
    pcf: capitalPcfSchema,
    stocks: z.array(capitalStockSchema).default([]),
    assets: z.array(capitalAssetSchema).default([])
  }),
  message: z.string().nullable().optional()
});

export type CapitalBuybackResponse = z.infer<typeof capitalBuybackResponseSchema>;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/TWD|,|%/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(date: string): string {
  const trimmed = date.trim();
  const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  const match = dashMatch ?? slashMatch;

  if (!match) {
    throw new Error(`Unsupported Capital date format: ${date}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseCapitalBuyback(rawBody: string): CapitalBuybackResponse["data"] {
  const parsed = capitalBuybackResponseSchema.parse(JSON.parse(rawBody));
  if (parsed.code !== 200) {
    throw new Error(`Capital API returned code ${parsed.code}: ${parsed.message ?? ""}`.trim());
  }

  return parsed.data;
}

export function detectCapitalBuybackTradeDate(rawBody: string): string {
  return toIsoDate(parseCapitalBuyback(rawBody).pcf.date2);
}

export interface ParsedCapitalHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedCapitalSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
  cashRatio: number | null;
}

export function parseCapitalHoldings(rawBody: string): ParsedCapitalHolding[] {
  const data = parseCapitalBuyback(rawBody);
  const fundSize = parseNumber(data.pcf.nav);

  return data.stocks
    .map((stock) => {
      const shares = parseNumber(stock.share) ?? parseNumber(stock.shareFormat) ?? 0;
      const weight = parseNumber(stock.weight);

      return {
        stockId: stock.stocNo.trim(),
        stockName: stock.stocName.trim(),
        shares,
        lots: shares / 1000,
        weight,
        marketValue: fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null
      };
    })
    .filter((row) => row.stockId && row.stockName);
}

export function parseCapitalSummary(rawBody: string): ParsedCapitalSummary {
  const data = parseCapitalBuyback(rawBody);
  const fundSize = parseNumber(data.pcf.nav);
  const cashValue = data.assets
    .filter((asset) => asset.asDesc.includes("現金"))
    .reduce((sum, asset) => sum + (parseNumber(asset.asMoney) ?? 0), 0);

  return {
    tradeDate: toIsoDate(data.pcf.date2),
    nav: parseNumber(data.pcf.pUnit),
    totalUnits: parseNumber(data.pcf.totUnit),
    fundSize,
    netCreationUnits: parseNumber(data.pcf.disUnit),
    stockRatio: parseNumber(data.pcf.totStock),
    cashRatio: fundSize && cashValue ? (cashValue / fundSize) * 100 : null
  };
}

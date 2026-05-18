import { z } from "zod";

const numberishSchema = z.union([z.number(), z.string(), z.null()]);

const ctbcSummarySchema = z.object({
  FundName: z.string(),
  ETF_ID: z.string(),
  FID: z.string(),
  公告日: z.string(),
  基金淨資產價值: numberishSchema,
  已發行受益權單位總數: numberishSchema,
  與前日已發行單位差異數: numberishSchema,
  每受益權單位淨資產價值: numberishSchema,
  淨值日期: z.string(),
  NAV_DATE: z.string().optional()
});

const ctbcHoldingSchema = z.object({
  invtp_: z.string(),
  code_: z.string(),
  name_: z.string(),
  ename_: z.string().optional(),
  cur_: z.string().optional(),
  qty_: numberishSchema,
  weights_: numberishSchema,
  amount_: numberishSchema.optional()
});

const ctbcDetailSectionSchema = z.object({
  Code: z.string(),
  Name: z.string(),
  SumTitle: z.string().optional(),
  Sum: numberishSchema.optional(),
  Data: z.array(ctbcHoldingSchema).default([])
});

const ctbcBuybackResponseSchema = z.object({
  ResultCode: z.number(),
  ResultMsg: z.string().optional(),
  Data: z.object({
    Data: z.array(ctbcSummarySchema).default([]),
    Detail: z.array(ctbcDetailSectionSchema).default([])
  })
});

const ctbcAuthTokenResponseSchema = z.object({
  ResultCode: z.number(),
  ResultMsg: z.string().optional(),
  Data: z.object({
    token: z.string()
  })
});

export type CtbcBuybackData = z.infer<typeof ctbcBuybackResponseSchema>["Data"];

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/TWD|USD|JPY|HKD|,|%/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (!match) {
    throw new Error(`Unsupported CTBC date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseCtbcAuthToken(rawBody: string): string {
  const parsed = ctbcAuthTokenResponseSchema.parse(JSON.parse(rawBody));
  if (parsed.ResultCode !== 0) {
    throw new Error(`CTBC AuthToken returned code ${parsed.ResultCode}: ${parsed.ResultMsg ?? ""}`.trim());
  }

  return parsed.Data.token;
}

export function parseCtbcBuyback(rawBody: string): CtbcBuybackData {
  const parsed = ctbcBuybackResponseSchema.parse(JSON.parse(rawBody));
  if (parsed.ResultCode !== 0) {
    throw new Error(`CTBC Buyback returned code ${parsed.ResultCode}: ${parsed.ResultMsg ?? ""}`.trim());
  }
  if (!parsed.Data.Data.length) {
    throw new Error("CTBC Buyback returned no summary rows");
  }

  return parsed.Data;
}

export function detectCtbcBuybackTradeDate(rawBody: string): string {
  const data = parseCtbcBuyback(rawBody);
  return toIsoDate(data.Data[0].NAV_DATE ?? data.Data[0].淨值日期);
}

export interface ParsedCtbcHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedCtbcSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
  cashRatio: number | null;
}

export function parseCtbcHoldings(rawBody: string): ParsedCtbcHolding[] {
  const data = parseCtbcBuyback(rawBody);
  const stockSection = data.Detail.find((section) => section.Code === "STOCK" || section.Name.includes("股票"));
  const fundSize = parseNumber(data.Data[0].基金淨資產價值);

  return (stockSection?.Data ?? [])
    .filter((row) => row.invtp_ === "STOCK")
    .map((row) => {
      const shares = parseNumber(row.qty_) ?? 0;
      const weight = parseNumber(row.weights_);
      const sourceAmount = parseNumber(row.amount_);

      return {
        stockId: row.code_.trim(),
        stockName: row.name_.trim(),
        shares,
        lots: shares / 1000,
        weight,
        marketValue: sourceAmount ?? (fundSize !== null && weight !== null ? (fundSize * weight) / 100 : null)
      };
    })
    .filter((row) => row.stockId && row.stockName);
}

export function parseCtbcSummary(rawBody: string): ParsedCtbcSummary {
  const data = parseCtbcBuyback(rawBody);
  const summary = data.Data[0];
  const fundSize = parseNumber(summary.基金淨資產價值);
  const stockSection = data.Detail.find((section) => section.Code === "STOCK" || section.Name.includes("股票"));
  const cashValue = data.Detail.flatMap((section) => section.Data)
    .filter((row) => row.invtp_ === "CASH")
    .reduce((sum, row) => sum + (parseNumber(row.amount_) ?? 0), 0);

  return {
    tradeDate: toIsoDate(summary.NAV_DATE ?? summary.淨值日期),
    nav: parseNumber(summary.每受益權單位淨資產價值),
    totalUnits: parseNumber(summary.已發行受益權單位總數),
    fundSize,
    netCreationUnits: parseNumber(summary.與前日已發行單位差異數),
    stockRatio: parseNumber(stockSection?.Sum ?? null),
    cashRatio: fundSize && cashValue ? (cashValue / fundSize) * 100 : null
  };
}

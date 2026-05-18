import { z } from "zod";

const yuantaPcfSchema = z.object({
  PCF: z.object({
    trandate: z.string(),
    anndate: z.string().optional(),
    totalav: z.number().nullable(),
    osunit: z.number().nullable(),
    issuesdiff: z.number().nullable(),
    nav: z.number().nullable()
  }),
  Cash: z
    .object({
      CashPosition: z
        .array(
          z.object({
            name: z.string(),
            amt: z.number().nullable(),
            rto: z.number().nullable().optional()
          })
        )
        .default([])
    })
    .optional(),
  FundWeights: z.object({
    Summary: z
      .object({
        fundsize: z.number().nullable().optional(),
        stkvalues: z.number().nullable().optional()
      })
      .optional(),
    StockWeights: z
      .array(
        z.object({
          code: z.string(),
          name: z.string(),
          ename: z.string().nullable().optional(),
          qty: z.number(),
          weights: z.number().nullable()
        })
      )
      .default([])
  })
});

export type YuantaPcfResponse = z.infer<typeof yuantaPcfSchema>;

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const match = compact ?? slash;

  if (!match) {
    throw new Error(`Unsupported Yuanta date format: ${value}`);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseYuantaPcf(rawBody: string): YuantaPcfResponse {
  return yuantaPcfSchema.parse(JSON.parse(rawBody));
}

export function detectYuantaPcfTradeDate(rawBody: string): string {
  return toIsoDate(parseYuantaPcf(rawBody).PCF.trandate);
}

export interface ParsedYuantaHolding {
  stockId: string;
  stockName: string;
  shares: number;
  lots: number;
  weight: number | null;
  marketValue: number | null;
}

export interface ParsedYuantaSummary {
  tradeDate: string;
  nav: number | null;
  totalUnits: number | null;
  fundSize: number | null;
  netCreationUnits: number | null;
  stockRatio: number | null;
  cashRatio: number | null;
}

export function parseYuantaHoldings(rawBody: string): ParsedYuantaHolding[] {
  const data = parseYuantaPcf(rawBody);
  const fundSize = data.PCF.totalav ?? data.FundWeights.Summary?.fundsize ?? null;

  return data.FundWeights.StockWeights.map((stock) => ({
    stockId: stock.code.trim(),
    stockName: stock.name.trim(),
    shares: stock.qty,
    lots: stock.qty / 1000,
    weight: stock.weights,
    marketValue: fundSize !== null && stock.weights !== null ? (fundSize * stock.weights) / 100 : null
  })).filter((stock) => stock.stockId && stock.stockName);
}

export function parseYuantaSummary(rawBody: string): ParsedYuantaSummary {
  const data = parseYuantaPcf(rawBody);
  const fundSize = data.PCF.totalav ?? data.FundWeights.Summary?.fundsize ?? null;
  const stockValue = data.FundWeights.Summary?.stkvalues ?? null;
  const cashValue =
    data.Cash?.CashPosition.filter((item) => item.name.includes("現金")).reduce((sum, item) => sum + (item.amt ?? 0), 0) ??
    null;

  return {
    tradeDate: toIsoDate(data.PCF.trandate),
    nav: data.PCF.nav,
    totalUnits: data.PCF.osunit,
    fundSize,
    netCreationUnits: data.PCF.issuesdiff,
    stockRatio: fundSize && stockValue !== null ? (stockValue / fundSize) * 100 : null,
    cashRatio: fundSize && cashValue !== null ? (cashValue / fundSize) * 100 : null
  };
}

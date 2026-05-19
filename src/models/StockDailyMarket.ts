import { z } from "zod";

export const stockMarketSchema = z.enum(["TWSE", "TPEx"]);

export const stockDailyMarketSchema = z.object({
  tradeDate: z.string(),
  stockId: z.string(),
  stockName: z.string(),
  market: stockMarketSchema,
  openPrice: z.number().nullable(),
  highPrice: z.number().nullable(),
  lowPrice: z.number().nullable(),
  closePrice: z.number().nullable(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
  volumeShares: z.number().nullable(),
  turnover: z.number().nullable(),
  transactionCount: z.number().nullable(),
  source: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type StockMarket = z.infer<typeof stockMarketSchema>;
export type StockDailyMarket = z.infer<typeof stockDailyMarketSchema>;

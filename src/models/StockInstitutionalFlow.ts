import { z } from "zod";
import { stockMarketSchema } from "./StockDailyMarket.js";

export const stockInstitutionalFlowSchema = z.object({
  tradeDate: z.string(),
  stockId: z.string(),
  stockName: z.string(),
  market: stockMarketSchema,
  foreignNetShares: z.number().nullable(),
  investmentTrustNetShares: z.number().nullable(),
  dealerNetShares: z.number().nullable(),
  totalNetShares: z.number().nullable(),
  source: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type StockInstitutionalFlow = z.infer<typeof stockInstitutionalFlowSchema>;

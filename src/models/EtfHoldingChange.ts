import { z } from "zod";

export const holdingChangeStatusSchema = z.enum([
  "increase",
  "decrease",
  "unchanged",
  "new",
  "exit",
  "scale_adjusted_increase",
  "scale_adjusted_decrease"
]);

export const etfHoldingChangeSchema = z.object({
  etfCode: z.string(),
  tradeDate: z.string(),
  stockId: z.string(),
  stockName: z.string(),
  prevTradeDate: z.string().nullable(),
  prevShares: z.number(),
  currentShares: z.number(),
  diffShares: z.number(),
  diffLots: z.number(),
  diffPct: z.number().nullable(),
  prevWeight: z.number().nullable(),
  currentWeight: z.number().nullable(),
  diffWeightPoint: z.number().nullable(),
  prevTotalUnits: z.number().nullable(),
  currentTotalUnits: z.number().nullable(),
  scaleRatio: z.number().nullable(),
  expectedSharesByScale: z.number().nullable(),
  activeDiffShares: z.number().nullable(),
  activeDiffLots: z.number().nullable(),
  activeDiffPct: z.number().nullable(),
  activeSignalScore: z.number().nullable(),
  status: holdingChangeStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

export type HoldingChangeStatus = z.infer<typeof holdingChangeStatusSchema>;
export type EtfHoldingChange = z.infer<typeof etfHoldingChangeSchema>;

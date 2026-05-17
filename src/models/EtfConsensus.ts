import { z } from "zod";

export const etfConsensusSchema = z.object({
  tradeDate: z.string(),
  stockId: z.string(),
  stockName: z.string(),
  etfCount: z.number(),
  increaseEtfCount: z.number(),
  decreaseEtfCount: z.number(),
  totalActiveDiffLots: z.number(),
  totalDiffWeightPoint: z.number(),
  consensusScore: z.number(),
  etfs: z.array(
    z.object({
      etfCode: z.string(),
      activeDiffLots: z.number().nullable(),
      diffWeightPoint: z.number().nullable(),
      currentWeight: z.number().nullable()
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type EtfConsensus = z.infer<typeof etfConsensusSchema>;

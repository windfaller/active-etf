import { z } from "zod";

export const sectorNameSchema = z.enum([
  "AI Server",
  "PCB",
  "CPO",
  "散熱",
  "ASIC",
  "金融",
  "航運",
  "其他"
]);

export const etfSectorFlowSchema = z.object({
  tradeDate: z.string(),
  sector: sectorNameSchema,
  stockCount: z.number(),
  etfCount: z.number(),
  totalActiveDiffLots: z.number(),
  totalDiffWeightPoint: z.number(),
  flowScore: z.number(),
  stocks: z.array(
    z.object({
      stockId: z.string(),
      stockName: z.string(),
      totalActiveDiffLots: z.number(),
      totalDiffWeightPoint: z.number()
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type SectorName = z.infer<typeof sectorNameSchema>;
export type EtfSectorFlow = z.infer<typeof etfSectorFlowSchema>;

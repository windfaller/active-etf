import { z } from "zod";

export const sectorNameSchema = z.enum([
  "AI Server",
  "PCB",
  "CPO",
  "散熱",
  "ASIC",
  "半導體",
  "半導體設備",
  "光通訊",
  "金融",
  "航運",
  "電源",
  "記憶體",
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
